"""
Inspects images once now so a demonstration does not pay for them later.

Point this at the packets you intend to show. Each one is processed normally
and the result is stored, so during the demonstration the same photograph
comes back instantly and costs no API request at all — whatever the day's
allowance looks like by then.

    python warm_cache.py demo-images/*.jpg

Nothing here fakes a result: each image goes through the ordinary pipeline
and only a genuinely successful inspection is stored.
"""

import mimetypes
import os
import sys
import time

import requests

API = "http://127.0.0.1:8000/product/scan"


def main(paths: list[str]) -> int:
    if not paths:
        print(__doc__)
        return 1

    warmed = 0

    for path in paths:
        started = time.perf_counter()

        try:
            # The endpoint checks the declared type, so the file is sent with
            # the one its extension implies rather than as raw bytes.
            mime = mimetypes.guess_type(path)[0] or "image/jpeg"

            with open(path, "rb") as handle:
                response = requests.post(
                    API,
                    files={"file": (os.path.basename(path), handle, mime)},
                    timeout=180,
                )

        except Exception as e:
            print(f"  FAILED   {path} - {e}")
            continue

        elapsed = time.perf_counter() - started

        if response.status_code != 200:
            detail = response.json().get("detail")
            code = detail.get("code") if isinstance(detail, dict) else detail
            print(f"  FAILED   {path} ({elapsed:.1f}s) - {code}")
            continue

        body = response.json()
        compliance = body.get("compliance") or {}

        print(
            f"  {'cached' if body.get('processing_path') == 'cache' else 'warmed'}   "
            f"{path} ({elapsed:.1f}s) - "
            f"{compliance.get('status')} {compliance.get('score')}"
        )
        warmed += 1

    print(f"\n{warmed}/{len(paths)} ready to demonstrate without an API request.")
    return 0 if warmed else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
