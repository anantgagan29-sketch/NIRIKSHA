"""
Application settings, read once from the environment.

Nothing else in the backend calls os.getenv directly, so every deployment knob
is visible in one file and a missing one fails in a predictable place.
"""

import os

from dotenv import load_dotenv

load_dotenv()


def _csv(name: str, default: str) -> list[str]:
    """Read a comma-separated environment variable into a clean list."""
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


# --------------------------------------------------------------------------
# CORS
# --------------------------------------------------------------------------
# The browser sends credentials on same-site requests, so a wildcard origin is
# not acceptable here: the allowed origins are listed explicitly and come from
# the environment, which keeps development and deployment honest about who may
# call this API.

ALLOWED_ORIGINS: list[str] = _csv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5180,http://127.0.0.1:5180",
)


# --------------------------------------------------------------------------
# Uploads
# --------------------------------------------------------------------------

UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads")

# Hard ceiling enforced server-side, whatever the client claims.
MAX_UPLOAD_BYTES: int = int(os.getenv("MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))


# --------------------------------------------------------------------------
# Gemini
# --------------------------------------------------------------------------

GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY")

# Tried in order, so the first entry decides how fast a normal scan feels.
#
# Vision models, fastest first.
#
# Measured on this project's key, one call each with the same image:
#     gemini-3.5-flash        18.6s
#     gemini-3.7-flash        35.2s
#     gemini-3.6-flash       144.8s
#     gemini-3.5-flash-lite  414.1s
#
# The list is long on purpose. The free tier meters requests per model per
# day, so each additional model carries its own allowance and a demo does not
# end when the first one is spent. This is the provider's published capacity
# being used as published — there is no account or key rotation here, and no
# attempt to get more out of a model than it offers.
#
# Order still matters more than length: the first model that answers is the
# one that decides how long an inspection takes.
AI_MODELS: list[str] = _csv(
    "AI_MODELS",
    "gemini-3.5-flash,"
    "gemini-3.7-flash,"
    "gemini-2.5-flash,"
    "gemini-3.8-flash,"
    "gemini-3-flash-preview,"
    "gemini-3.6-flash,"
    "gemini-3.1-flash-lite,"
    "gemini-2.5-flash-lite"
)

# Kept as the previous name so nothing that imported it breaks.
GEMINI_MODELS: list[str] = AI_MODELS


# How long a model is left alone after refusing.
#
# A spent daily allowance will still be spent in a minute, so standing down
# for an hour costs nothing and saves a request on every inspection in
# between. A per-minute limit clears on its own. A 503 is the provider having
# a bad moment and is worth returning to quickly.
# How long any single model gets before the next one is tried. A healthy
# model answers well inside this; one having a slow spell is set aside so the
# remaining models still get their turn within the request's own deadline.
PER_MODEL_TIMEOUT_SECONDS: float = float(
    os.getenv("PER_MODEL_TIMEOUT_SECONDS", "22")
)


QUOTA_COOLDOWN_SECONDS: float = float(
    os.getenv("QUOTA_COOLDOWN_SECONDS", "3600")
)

RATE_LIMIT_COOLDOWN_SECONDS: float = float(
    os.getenv("RATE_LIMIT_COOLDOWN_SECONDS", "60")
)

UNAVAILABLE_COOLDOWN_SECONDS: float = float(
    os.getenv("UNAVAILABLE_COOLDOWN_SECONDS", "45")
)


# The readability pass is a SECOND full vision call on the same image, and it
# only adds per-declaration confidence figures and bounding boxes — the
# compliance result does not depend on it. Leaving it off halves the requests
# an inspection costs, which doubles how many inspections a day's allowance
# buys. Turn it on when the extra detail matters more than the budget.
ENABLE_READABILITY: bool = os.getenv(
    "ENABLE_READABILITY", "false"
).strip().lower() in ("1", "true", "yes", "on")


# Identical images are answered from the store instead of being sent again.
SCAN_CACHE_ENABLED: bool = os.getenv(
    "SCAN_CACHE_ENABLED", "true"
).strip().lower() in ("1", "true", "yes", "on")

SCAN_CACHE_TTL_SECONDS: float = float(
    os.getenv("SCAN_CACHE_TTL_SECONDS", "86400")
)

SCAN_CACHE_MAX_ENTRIES: int = int(
    os.getenv("SCAN_CACHE_MAX_ENTRIES", "200")
)

# Kept on disk so a restart does not throw away inspections already paid for.
SCAN_CACHE_PATH: str = os.getenv("SCAN_CACHE_PATH", "uploads/scan-cache.json")


GEMINI_MAX_RETRIES: int = int(os.getenv("GEMINI_MAX_RETRIES", "1"))
GEMINI_RETRY_DELAY: float = float(os.getenv("GEMINI_RETRY_DELAY", "0.8"))

# Hard ceiling on one model call. Without it a hanging request hangs the whole
# scan, with nothing to show the user and no way to recover.
# Measured end-to-end scan times against the live model: 40s, 44s, 65s.
# A 45s deadline cut off scans that were about to succeed and returned a 504
# instead of a result, so the budget is set above the observed spread. It
# still bounds the request — without a deadline a hung call takes the whole
# request with it — but it no longer discards work that was nearly done.
# With the readability pass off, an inspection is a single call, and a
# healthy model answers in roughly 20-30s. The deadline sits above that but
# well below the point where a demonstration stalls: passing it hands the
# inspection to the on-device path, which finishes rather than failing.
GEMINI_TIMEOUT_SECONDS: float = float(os.getenv("GEMINI_TIMEOUT_SECONDS", "70"))

# Deadline for the readability pass specifically. It only adds per-declaration
# confidence and bounding boxes, so it is allowed to be dropped rather than
# hold up a result the user can already act on.
# Readability runs beside the parse call, and what is left of this budget
# once the parse returns is what it gets. At 25s a parse taking 40s left it
# no time at all, so the confidence figures were usually dropped even though
# the call had already finished.
READABILITY_TIMEOUT_SECONDS: float = float(os.getenv("READABILITY_TIMEOUT_SECONDS", "60"))


# --------------------------------------------------------------------------
# Image preparation
# --------------------------------------------------------------------------

# Longest edge sent to the vision model. Label text stays legible well below
# camera resolution, and a smaller upload is a faster upload.
VISION_MAX_EDGE: int = int(os.getenv("VISION_MAX_EDGE", "1280"))
VISION_JPEG_QUALITY: int = int(os.getenv("VISION_JPEG_QUALITY", "85"))
