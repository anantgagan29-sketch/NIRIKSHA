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
                result_json   TEXT NOT NULL
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


def _next_reference(table: str, prefix: str) -> str:
    """Sequential, human-quotable reference: NIR-2026-00001."""
    year = datetime.now(timezone.utc).year
    with _connect() as db:
        count = db.execute(f"SELECT COUNT(*) AS n FROM {table}").fetchone()["n"]
    return f"{prefix}-{year}-{count + 1:05d}"


# ============================================================
# SCANS
# ============================================================

def record_scan(result: dict[str, Any]) -> str:
    """
    Stores one completed scan and returns its reference.

    The whole response is kept as JSON so a past scan can be re-opened exactly
    as it was assessed, rather than reconstructed from summary columns.
    """
    scan_id = _next_reference("scans", "NIR")

    product = result.get("product") or {}
    compliance = result.get("compliance") or {}

    with _lock, _connect() as db:
        db.execute(
            """
            INSERT INTO scans (id, created_at, filename, product_name, net_quantity,
                               scan_status, status, score, result_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            ),
        )

    return scan_id


def list_scans(limit: int = 100) -> list[dict[str, Any]]:
    with _connect() as db:
        rows = db.execute(
            """
            SELECT id, created_at, filename, product_name, net_quantity,
                   scan_status, status, score
            FROM scans ORDER BY created_at DESC LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]


def get_scan(scan_id: str) -> Optional[dict[str, Any]]:
    with _connect() as db:
        row = db.execute("SELECT result_json FROM scans WHERE id = ?", (scan_id,)).fetchone()
    return json.loads(row["result_json"]) if row else None


def scan_stats() -> dict[str, int]:
    """Counts by outcome, for the dashboard and history headers."""
    with _connect() as db:
        rows = db.execute(
            "SELECT status, scan_status, COUNT(*) AS n FROM scans GROUP BY status, scan_status"
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
