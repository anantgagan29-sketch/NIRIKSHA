"""
A physical scale for the photograph, taken from the barcode on the pack.

Rule 7 is a requirement in millimetres, and a photograph has no millimetres
in it. Until now the only way to supply them was to ask the person to measure
the pack with a ruler, which almost nobody does — so every lettering finding
stayed under review.

A retail barcode is a reference object that is already in the frame. What it
gives is not an exact size, though, and the difference matters:

  * An EAN-13 symbol is 95 modules wide. At magnification 1.00 a module is
    0.330 mm, so the symbol is 31.35 mm across, excluding quiet zones.
  * GS1 permits that symbol to be printed at any magnification from 0.80 to
    2.00 for retail scanning. The same 95 modules may therefore span
    25.1 mm on a sachet or 62.7 mm on a carton.

So the barcode bounds the scale rather than fixing it, and this module
returns the bounds. What the caller may conclude from them is asymmetric,
and `letter_height` relies on it:

  * At the *largest* plausible magnification every character measures as
    large as it possibly could. Text that is still below the minimum there
    is below the minimum at every magnification — that is a conclusion, and
    it is the only one this scale supports.
  * Text that clears the minimum at some magnification may be too small at
    another, so it concludes nothing and stays under review.

A wrong FAIL here is an accusation about a manufacturer. The bound above is
chosen so the arithmetic can only ever be too generous to the pack.
"""

from __future__ import annotations

import math
from typing import Any, Optional

import cv2
import numpy as np

# EAN-13: 95 modules at the 0.330 mm nominal module width.
EAN13_NOMINAL_WIDTH_MM = 31.35

# The magnifications GS1 permits for a retail symbol.
MAGNIFICATION_MIN = 0.80
MAGNIFICATION_MAX = 2.00

# Below this the symbol is too few pixels for its width to mean anything.
MIN_SYMBOL_WIDTH_PX = 48

# A retail symbol is wider than it is tall, and truncated symbols are
# common — but a long thin streak is not a barcode, and neither is a square.
MIN_ASPECT = 1.1
MAX_ASPECT = 12.0

# Opposite sides of the detected quadrilateral should agree; a shape whose
# sides disagree by more than this is not a printed rectangle seen slightly
# off-square.
MAX_SIDE_DISAGREEMENT = 0.25


def _quad_sides(quad: np.ndarray) -> tuple[float, float, float, float]:
    """The four side lengths of a quadrilateral, in order."""
    return tuple(  # type: ignore[return-value]
        float(np.linalg.norm(quad[(index + 1) % 4] - quad[index])) for index in range(4)
    )


def detect_symbol(image_path: str) -> Optional[dict[str, Any]]:
    """
    The barcode's geometry in the photograph, or None.

    Only geometry is wanted, so a symbol that will not decode is still
    useful: the number it carries is read elsewhere, from the video, and
    what matters here is how many pixels 95 modules span.

    Every guard below rejects rather than guesses. A missed barcode costs a
    scan nothing — the finding stays under review, which is where it was.
    """
    try:
        image = cv2.imread(image_path)

        if image is None:
            return None

        height_px, width_px = image.shape[:2]

        detector = cv2.barcode.BarcodeDetector()
        found, quads = detector.detect(image)

        if not found or quads is None:
            return None

        best: Optional[dict[str, Any]] = None

        for raw in np.array(quads).reshape(-1, 4, 2):
            quad = np.array(raw, dtype=float)
            sides = _quad_sides(quad)

            # A rectangle's opposite sides are equal; these are adjacent
            # pairs, so the long pair and the short pair are compared.
            long_pair = (sides[0], sides[2]) if sides[0] > sides[1] else (sides[1], sides[3])
            short_pair = (sides[1], sides[3]) if sides[0] > sides[1] else (sides[0], sides[2])

            symbol_width = sum(long_pair) / 2
            symbol_height = sum(short_pair) / 2

            if symbol_width < MIN_SYMBOL_WIDTH_PX or symbol_height <= 0:
                continue

            if max(long_pair) > 0 and abs(long_pair[0] - long_pair[1]) / max(long_pair) > MAX_SIDE_DISAGREEMENT:
                continue

            aspect = symbol_width / symbol_height

            if not (MIN_ASPECT <= aspect <= MAX_ASPECT):
                continue

            # The widest plausible symbol is the one whose scale is most
            # trustworthy: it spans the most pixels per module.
            if best is None or symbol_width > best["symbol_width_px"]:
                best = {
                    "symbol_width_px": round(symbol_width, 1),
                    "symbol_height_px": round(symbol_height, 1),
                    "aspect": round(aspect, 2),
                    "image_width_px": width_px,
                    "image_height_px": height_px,
                }

        return best

    except Exception as error:
        # Detection is an optional convenience; it never fails a scan.
        print("Barcode scale: detection skipped -", str(error)[:120])
        return None


def scale_from_symbol(symbol: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
    """
    Millimetres per vertical unit, as a range, from a detected symbol.

    Bounding boxes reach this application in thousandths of the image
    height, which is the unit `letter_height` compares against — so the
    conversion is carried through to that unit here rather than leaving two
    places to get it wrong.
    """
    if not symbol:
        return None

    width_px = symbol["symbol_width_px"]
    image_height_px = symbol["image_height_px"]

    if width_px <= 0 or not image_height_px:
        return None

    # Pixels are square, so the symbol's width sets the scale for heights.
    per_unit = image_height_px / 1000

    def mm_per_unit(magnification: float) -> float:
        mm_per_pixel = (EAN13_NOMINAL_WIDTH_MM * magnification) / width_px
        return mm_per_pixel * per_unit

    return {
        "source": "barcode",
        "symbol_width_px": width_px,
        "symbol_width_share": round(width_px / max(1, symbol["image_width_px"]), 3),
        # The generous end: every character measures as large as it could.
        # A shortfall here is a shortfall at any permitted magnification.
        "mm_per_unit_max": mm_per_unit(MAGNIFICATION_MAX),
        # The other end, reported so a reader can see the spread.
        "mm_per_unit_min": mm_per_unit(MAGNIFICATION_MIN),
        "mm_per_unit_nominal": mm_per_unit(1.0),
        "magnification_range": [MAGNIFICATION_MIN, MAGNIFICATION_MAX],
        "note": (
            f"Scale estimated from the barcode: 95 modules span "
            f"{width_px:.0f} px. GS1 permits a retail symbol at magnifications "
            f"{MAGNIFICATION_MIN:g} to {MAGNIFICATION_MAX:g}, so the symbol is "
            f"between {EAN13_NOMINAL_WIDTH_MM * MAGNIFICATION_MIN:.0f} mm and "
            f"{EAN13_NOMINAL_WIDTH_MM * MAGNIFICATION_MAX:.0f} mm wide on the pack. "
            f"Heights are therefore judged at the largest of those, where a "
            f"character measures as tall as it possibly could."
        ),
    }


def scale_for_image(image_path: str) -> Optional[dict[str, Any]]:
    """The whole step: find the symbol, and report what scale it supports."""
    return scale_from_symbol(detect_symbol(image_path))
