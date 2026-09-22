"""
Product identification from a barcode, through Open Food Facts.

Open Food Facts is a public, community-maintained database of packaged
products, queried by GTIN with no key and no account. It is used here for
what it is: a way to put a likely product name, brand and declared quantity
beside a scanned barcode. It is not an authority — a record may be stale,
partial or wrong — so every answer names its source and the interface says
to check it against the pack. The compliance assessment never reads from
it; that comes from the photograph of the packaging, as before.

The call is bounded and cached. A directory that is slow or down costs a
scan nothing: the barcode is still recorded and the inspection carries on.
"""

from __future__ import annotations

import json
import ssl
import threading
import time
import urllib.parse
import urllib.request
from typing import Any, Optional

from app.core.config import (
    PRODUCT_DIRECTORY_ENABLED,
    PRODUCT_DIRECTORY_TIMEOUT_SECONDS,
)

SOURCE = "Open Food Facts (community database)"
_ENDPOINT = "https://world.openfoodfacts.org/api/v2/product/{code}.json"
_FIELDS = "product_name,product_name_en,brands,quantity,image_front_small_url,countries_tags,packaging"
_USER_AGENT = "NIRIKSHA/1.0 (packaged-commodity compliance checker; SIH 2026)"

# Records are remembered for a day. The directory changes slowly and a demo
# scans the same packet many times.
_TTL_SECONDS = 24 * 3600
_cache: dict[str, tuple[float, Optional[dict[str, Any]]]] = {}
_lock = threading.Lock()


def _ssl_context() -> Optional[ssl.SSLContext]:
    """
    A context that trusts the usual public authorities.

    A Python installed from python.org carries no system roots, so the
    default context rejects every HTTPS host with CERTIFICATE_VERIFY_FAILED
    — which looked exactly like the directory being down. certifi's bundle
    is what the HTTP libraries in this project already use.
    """
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        # A host with real system roots (the container) needs nothing here.
        return None


def _cached(code: str) -> Optional[tuple[float, Optional[dict[str, Any]]]]:
    with _lock:
        entry = _cache.get(code)
        if entry and time.time() - entry[0] < _TTL_SECONDS:
            return entry
        return None


def _remember(code: str, record: Optional[dict[str, Any]]) -> None:
    with _lock:
        _cache[code] = (time.time(), record)


def _fetch(code: str) -> Optional[dict[str, Any]]:
    url = _ENDPOINT.format(code=urllib.parse.quote(code)) + "?fields=" + _FIELDS
    request = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})

    with urllib.request.urlopen(
        request,
        timeout=PRODUCT_DIRECTORY_TIMEOUT_SECONDS,
        context=_ssl_context(),
    ) as response:
        body = json.loads(response.read().decode("utf-8"))

    if body.get("status") != 1:
        return None

    product = body.get("product") or {}
    name = (product.get("product_name") or product.get("product_name_en") or "").strip()

    if not name:
        return None

    countries = [
        tag.split(":", 1)[-1].replace("-", " ").title()
        for tag in product.get("countries_tags") or []
    ]

    return {
        "product_name": name,
        "brand": (product.get("brands") or "").strip() or None,
        "quantity": (product.get("quantity") or "").strip() or None,
        "image_url": product.get("image_front_small_url") or None,
        "countries": countries[:5],
        "source": SOURCE,
        "source_url": f"https://world.openfoodfacts.org/product/{code}",
    }


def identify(code: str) -> tuple[Optional[dict[str, Any]], Optional[str]]:
    """
    The directory's record for a GTIN, or None with a reason.

    Returns (record, problem). `problem` is set when the directory could not
    be asked — off, slow, down — as distinct from asked and found nothing.
    """
    if not PRODUCT_DIRECTORY_ENABLED:
        return None, "disabled"

    cached = _cached(code)
    if cached:
        return cached[1], None

    try:
        record = _fetch(code)
    except Exception as error:
        print("Product directory: unreachable -", str(error)[:120])
        return None, "unreachable"

    _remember(code, record)
    return record, None
