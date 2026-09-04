"""
Answers a repeated image from the last result instead of the model.

A demonstration inspects the same packet several times — once while
explaining the pipeline, again to show the compliance panel, again because
someone at the back asked. Each of those was a fresh pair of API requests for
an answer we already had.

The key is a SHA-256 of the image bytes, so a hit means the same file, not a
similar one. Two photographs of the same packet hash differently and are both
processed; there is no similarity matching here, because a cache that guessed
which products were "the same" would eventually attach one product's
compliance result to another.

Entries expire, and only successful inspections are stored — a failure is
never served back as though it were an answer.

The store is also written to disk. A demonstration does not survive in memory
across a laptop restart, and the morning of a demo is the worst time to
rediscover that every cached inspection has to be paid for again.
"""

from __future__ import annotations

import hashlib
import json
import pathlib
import threading
import time
from collections import OrderedDict
from copy import deepcopy
from typing import Optional

from app.core.config import (
    SCAN_CACHE_ENABLED,
    SCAN_CACHE_MAX_ENTRIES,
    SCAN_CACHE_PATH,
    SCAN_CACHE_TTL_SECONDS,
)


def image_fingerprint(data: bytes) -> str:
    """The cache key: the exact bytes that were uploaded."""

    return hashlib.sha256(data).hexdigest()


class ScanCache:
    """A small, bounded, in-process store of completed inspections."""

    def __init__(
        self,
        ttl: float = SCAN_CACHE_TTL_SECONDS,
        max_entries: int = SCAN_CACHE_MAX_ENTRIES,
        path: str = SCAN_CACHE_PATH,
    ) -> None:
        self._ttl = ttl
        self._max = max_entries
        self._path = pathlib.Path(path)
        self._lock = threading.Lock()
        self._entries: "OrderedDict[str, tuple[float, dict]]" = OrderedDict()
        self.hits = 0
        self.misses = 0
        self._load()

    # ------------------------------------------------------------ on disk

    def _load(self) -> None:
        """
        Reads the store back at startup, dropping anything already expired.

        A corrupt or unreadable file is not worth failing to start over: the
        cache is an optimisation, so it begins empty and fills again.
        """

        if not SCAN_CACHE_ENABLED or not self._path.exists():
            return

        try:
            stored = json.loads(self._path.read_text())
            now = time.time()

            for key, entry in stored.items():
                stored_at = entry.get("stored_at", 0)

                if now - stored_at <= self._ttl:
                    self._entries[key] = (stored_at, entry["result"])

            print(f"Scan cache: {len(self._entries)} inspections restored from disk.")

        except Exception as e:
            print("Scan cache: could not read the store, starting empty -", str(e))

    def _save(self) -> None:
        """Writes the store out. Called with the lock already held."""

        if not SCAN_CACHE_ENABLED:
            return

        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)

            payload = {
                key: {"stored_at": stored_at, "result": result}
                for key, (stored_at, result) in self._entries.items()
            }

            # Written beside the target and moved into place, so an
            # interrupted write cannot leave a half-file behind.
            temporary = self._path.with_suffix(".tmp")
            temporary.write_text(json.dumps(payload))
            temporary.replace(self._path)

        except Exception as e:
            print("Scan cache: could not write the store -", str(e))

    def get(self, key: str) -> Optional[dict]:
        if not SCAN_CACHE_ENABLED:
            return None

        with self._lock:
            entry = self._entries.get(key)

            if entry is None:
                self.misses += 1
                return None

            stored_at, result = entry

            if time.time() - stored_at > self._ttl:
                del self._entries[key]
                self.misses += 1
                return None

            self._entries.move_to_end(key)
            self.hits += 1

            # A copy, so a caller stamping its own scan id onto the result
            # cannot alter what the next caller receives.
            return deepcopy(result)

    def put(self, key: str, result: dict) -> None:
        if not SCAN_CACHE_ENABLED:
            return

        with self._lock:
            self._entries[key] = (time.time(), deepcopy(result))
            self._entries.move_to_end(key)

            while len(self._entries) > self._max:
                self._entries.popitem(last=False)

            self._save()

    def stats(self) -> dict:
        with self._lock:
            return {
                "enabled": SCAN_CACHE_ENABLED,
                "entries": len(self._entries),
                "hits": self.hits,
                "misses": self.misses,
            }

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()
            self.hits = 0
            self.misses = 0
            self._save()


cache = ScanCache()
