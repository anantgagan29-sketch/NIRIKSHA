"""
Persistence for scans and complaints.

SQLite through the standard library: no new dependency, no server to run, and
the file sits beside the application. It is deliberately small — this stores
what the product has already assessed, it does not re-implement any of the
analysis.

Swapping this for PostgreSQL later means replacing `_connect` and the SQL; the
functions below are the contract the API routes use.
"""

import json
import os
import sqlite3
import threading
from datetime import datetime, timezone
from typing import Any, Optional

DB_PATH = os.getenv("DATABASE_PATH", "niriksha.db")

# SQLite allows one writer at a time; serialising writes in-process keeps
# concurrent uploads from tripping over each other.
_lock = threading.Lock()


def _connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    return connection


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db() -> None:
    """Creates the schema. Safe to call on every start."""
    with _lock, _connect() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS scans (
                id            TEXT PRIMARY KEY,
                created_at    TEXT NOT NULL,
                filename      TEXT,
                product_name  TEXT,
                net_quantity  TEXT,
                scan_status   TEXT NOT NULL,
                status        TEXT,
                score         INTEGER,
                result_json   TEXT NOT NULL,
                -- The Supabase user whose scan this is, taken from the `sub`
                -- claim of a verified access token. Null for rows written
                -- before scans had owners, and for an unconfigured local run.
                user_id       TEXT,
                -- The client's identifier for one scan action. Two requests
                -- carrying the same one are the same event -- a retry, a
                -- double submit -- and must not become two rows.
                scan_event_id TEXT
            );

            CREATE TABLE IF NOT EXISTS complaints (
                id             TEXT PRIMARY KEY,
                scan_id        TEXT,
                product        TEXT,
                violation_type TEXT NOT NULL,
                description    TEXT NOT NULL,
                location       TEXT,
                contact        TEXT,
                status         TEXT NOT NULL,
                created_at     TEXT NOT NULL,
                updated_at     TEXT NOT NULL
            );

            -- Append-only: the audit trail behind every status change.
            CREATE TABLE IF NOT EXISTS complaint_events (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                complaint_id TEXT NOT NULL,
                status       TEXT NOT NULL,
                note         TEXT,
                created_at   TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_scans_created ON scans (created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_complaints_created ON complaints (created_at DESC);
            """
        )

        # A database created before scans had owners already has the table, so
        # the CREATE above left it untouched and the new columns have to be
        # added on their own.
        #
        # Existing rows keep a null owner. Nobody can say now whose they were,
        # and assigning them to whoever asks first would put one person's
        # inspections in another person's history -- the failure this column
        # exists to prevent.
        columns = {
            row["name"]
            for row in db.execute("PRAGMA table_info(scans)").fetchall()
        }

        if "user_id" not in columns:
            db.execute("ALTER TABLE scans ADD COLUMN user_id TEXT")

        if "scan_event_id" not in columns:
            db.execute("ALTER TABLE scans ADD COLUMN scan_event_id TEXT")

        # Indexed here, not in the script above: on an older database neither
        # column exists until the lines above add it.
        db.execute(
            "CREATE INDEX IF NOT EXISTS idx_scans_user "
            "ON scans (user_id, created_at DESC)"
        )

        # The rule that makes recording a scan idempotent. Partial, because
        # every row written before this existed has no event id and they must
        # not all collide with each other.
        db.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_scans_event "
            "ON scans (scan_event_id) WHERE scan_event_id IS NOT NULL"
        )


def _next_reference(table: str, prefix: str) -> str:
    """Sequential, human-quotable reference: NIR-2026-00001."""
    year = datetime.now(timezone.utc).year
    with _connect() as db:
        count = db.execute(f"SELECT COUNT(*) AS n FROM {table}").fetchone()["n"]
    return f"{prefix}-{year}-{count + 1:05d}"


# ============================================================
# SCANS
# ============================================================

def record_scan(
    result: dict[str, Any],
    user_id: Optional[str] = None,
    event_id: Optional[str] = None,
) -> str:
    """
    Stores one completed scan and returns its reference.

    The whole response is kept as JSON so a past scan can be re-opened exactly
    as it was assessed, rather than reconstructed from summary columns.

    One scan action produces one row. The client names the action in
    `event_id`, and a second request carrying an id already on file returns
    the reference that was issued the first time instead of minting another.
    That covers a retried request, a double submit, and a repeat of an
    identical image answered from the cache -- all of which used to leave the
    same product in the history several times over.

    Scanning the same packet again deliberately is a different action with a
    different id, and gets a row and a reference of its own. The identity here
    is the event, never the product.
    """
    product = result.get("product") or {}
    compliance = result.get("compliance") or {}

    with _lock, _connect() as db:

        if event_id:
            existing = db.execute(
                "SELECT id FROM scans WHERE scan_event_id = ?",
                (event_id,),
            ).fetchone()

            if existing is not None:
                return existing["id"]

        scan_id = _next_reference("scans", "NIR")

        try:
            db.execute(
                """
                INSERT INTO scans (id, created_at, filename, product_name, net_quantity,
                                   scan_status, status, score, result_json,
                                   user_id, scan_event_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    scan_id,
                    _now(),
                    result.get("filename"),
                    product.get("product_name"),
                    product.get("net_quantity"),
                    result.get("scan_status", "UNKNOWN"),
                    compliance.get("status"),
                    compliance.get("score"),
                    json.dumps(result),
                    user_id,
                    event_id,
                ),
            )

        except sqlite3.IntegrityError:
            # Two requests for the same event arrived close enough together
            # that both passed the check above. The unique index settles it;
            # the loser reports the reference the winner was given.
            existing = db.execute(
                "SELECT id FROM scans WHERE scan_event_id = ?",
                (event_id,),
            ).fetchone()

            if existing is None:
                raise

            return existing["id"]

    return scan_id


def list_scans(
    limit: int = 100,
    user_id: Optional[str] = None,
) -> list[dict[str, Any]]:
    """
    One user's scans, newest first.

    The owner is always part of the query. A null owner is a scope of its own
    -- the rows recorded without a signed-in user -- and not a wildcard, so
    there is no argument to this function that returns everybody's history.
    """
    with _connect() as db:
        rows = db.execute(
            """
            SELECT id, created_at, filename, product_name, net_quantity,
                   scan_status, status, score
            FROM scans
            WHERE user_id IS ?
            ORDER BY created_at DESC LIMIT ?
            """,
            (user_id, limit),
        ).fetchall()
    return [dict(row) for row in rows]


def get_scan(
    scan_id: str,
    user_id: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    """
    One stored scan, if it belongs to this user.

    Scoped for the same reason the listing is: a reference is short and
    guessable, and without the owner in the query anyone could read anyone
    else's inspection by typing a number.
    """
    with _connect() as db:
        row = db.execute(
            "SELECT result_json FROM scans WHERE id = ? AND user_id IS ?",
            (scan_id, user_id),
        ).fetchone()
    return json.loads(row["result_json"]) if row else None


def scan_stats(user_id: Optional[str] = None) -> dict[str, int]:
    """
    Counts by outcome, for the dashboard and history headers.

    Scoped exactly as the listing is: a total that counts rows the page does
    not show is a page contradicting itself.
    """
    with _connect() as db:
        rows = db.execute(
            "SELECT status, scan_status, COUNT(*) AS n FROM scans "
            "WHERE user_id IS ? GROUP BY status, scan_status",
            (user_id,),
        ).fetchall()
        complaints = db.execute("SELECT COUNT(*) AS n FROM complaints").fetchone()["n"]

    stats = {
        "inspected": 0,
        "compliant": 0,
        "nonCompliant": 0,
        "needsReview": 0,
        "retakeRequired": 0,
        "complaints": complaints,
    }

    for row in rows:
        stats["inspected"] += row["n"]
        if row["scan_status"] == "RETAKE_REQUIRED":
            stats["retakeRequired"] += row["n"]
        elif row["status"] == "COMPLIANT":
            stats["compliant"] += row["n"]
        elif row["status"] == "NON_COMPLIANT":
            stats["nonCompliant"] += row["n"]
        elif row["status"] == "PARTIALLY_COMPLIANT":
            stats["needsReview"] += row["n"]

    return stats


# ============================================================
# COMPLAINTS
# ============================================================

VALID_STATUSES = ["submitted", "under_review", "verified", "action_taken", "rejected"]

# A complaint cannot jump straight to a conclusion: each move is recorded.
TRANSITIONS: dict[str, list[str]] = {
    "submitted": ["under_review", "rejected"],
    "under_review": ["verified", "rejected"],
    "verified": ["action_taken", "rejected"],
    "action_taken": [],
    "rejected": ["under_review"],
}


def create_complaint(
    scan_id: Optional[str],
    product: Optional[str],
    violation_type: str,
    description: str,
    location: Optional[str],
    contact: Optional[str],
) -> dict[str, Any]:
    complaint_id = _next_reference("complaints", "NIR-CMP")
    now = _now()

    with _lock, _connect() as db:
        db.execute(
            """
            INSERT INTO complaints (id, scan_id, product, violation_type, description,
                                    location, contact, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?)
            """,
            (complaint_id, scan_id, product, violation_type, description, location, contact, now, now),
        )
        db.execute(
            "INSERT INTO complaint_events (complaint_id, status, note, created_at) VALUES (?, ?, ?, ?)",
            (
                complaint_id,
                "submitted",
                "Complaint recorded in the NIRIKSHA system with the assessment findings attached.",
                now,
            ),
        )

    return get_complaint(complaint_id)  # type: ignore[return-value]


def get_complaint(complaint_id: str) -> Optional[dict[str, Any]]:
    with _connect() as db:
        row = db.execute("SELECT * FROM complaints WHERE id = ?", (complaint_id,)).fetchone()
        if not row:
            return None
        events = db.execute(
            "SELECT status, note, created_at FROM complaint_events "
            "WHERE complaint_id = ? ORDER BY id",
            (complaint_id,),
        ).fetchall()

    complaint = dict(row)
    complaint["timeline"] = [dict(event) for event in events]
    return complaint


def list_complaints(limit: int = 200) -> list[dict[str, Any]]:
    with _connect() as db:
        rows = db.execute(
            "SELECT id FROM complaints ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
    return [complaint for row in rows if (complaint := get_complaint(row["id"]))]


class TransitionError(ValueError):
    """Raised when a status change is not allowed from the current state."""


def update_complaint_status(complaint_id: str, status: str, note: Optional[str]) -> dict[str, Any]:
    complaint = get_complaint(complaint_id)
    if complaint is None:
        raise LookupError(f"No complaint with reference {complaint_id}.")

    current = complaint["status"]
    if status not in VALID_STATUSES:
        raise TransitionError(f"'{status}' is not a valid complaint status.")
    if status not in TRANSITIONS[current]:
        raise TransitionError(f"A complaint cannot move from '{current}' to '{status}'.")

    now = _now()
    with _lock, _connect() as db:
        db.execute(
            "UPDATE complaints SET status = ?, updated_at = ? WHERE id = ?",
            (status, now, complaint_id),
        )
        db.execute(
            "INSERT INTO complaint_events (complaint_id, status, note, created_at) VALUES (?, ?, ?, ?)",
            (complaint_id, status, note, now),
        )

    return get_complaint(complaint_id)  # type: ignore[return-value]
