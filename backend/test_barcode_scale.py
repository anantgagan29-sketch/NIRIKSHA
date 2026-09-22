"""
The barcode as a physical scale, and what Rule 7 may conclude from it.

The arithmetic matters less than the direction of its error: a bound that
is too generous to the pack misses a violation, and one that is too harsh
accuses a manufacturer from a guess. These check the bound is the generous
one, that only a shortfall is concluded, and that a measured dimension wins
when both are present.
"""
import math
import os
import sys
import tempfile

os.environ["REQUIRE_AUTH"] = "false"
sys.path.insert(0, os.getcwd())

import cv2
import numpy as np

from app.services import barcode_scale, letter_height

passed = failed = 0
def check(name, ok, detail=""):
    global passed, failed
    passed += ok; failed += (not ok)
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"  -- {detail}"))


def reading(units: float, field: str = "net_quantity") -> dict:
    """A readability result whose text block is `units` thousandths tall."""
    return {"fields": {field: {"status": "CLEAR", "confidence": 0.9,
                               "bounding_box": [100, 500, 300, 500 + units]}}}


print("=== the scale the symbol supports ===")
symbol = {"symbol_width_px": 100.0, "symbol_height_px": 40.0, "aspect": 2.5,
          "image_width_px": 1000, "image_height_px": 1000}
scale = barcode_scale.scale_from_symbol(symbol)

# 95 modules across 100px. At magnification 1 the symbol is 31.35mm, so a
# pixel is 0.3135mm; the image is 1000px tall, so a unit is one pixel.
check("nominal scale is the symbol width over its pixels",
      math.isclose(scale["mm_per_unit_nominal"], 0.3135, rel_tol=1e-6), scale["mm_per_unit_nominal"])
check("the generous bound is the largest magnification GS1 allows",
      math.isclose(scale["mm_per_unit_max"], 0.3135 * 2.0, rel_tol=1e-6), scale["mm_per_unit_max"])
check("the generous bound is larger than the nominal one",
      scale["mm_per_unit_max"] > scale["mm_per_unit_nominal"] > scale["mm_per_unit_min"])
check("the note says which assumption was used",
      "magnification" in scale["note"] and "largest" in scale["note"], scale["note"])
check("no symbol, no scale", barcode_scale.scale_from_symbol(None) is None)

print("\n=== what Rule 7 concludes from it ===")
# A 200 g pack needs 1 mm numerals. One unit is 0.627mm at the generous
# bound, so a one-unit block is short however the symbol was printed.
short = letter_height.assess(reading(1), net_quantity=(200.0, "g"),
                             image_height_px=1000, barcode_scale=scale)
finding = next(f for f in short["findings"] if f["field"] == "net_quantity")
check("text short at the generous bound is a FAIL", finding["status"] == "FAIL", finding["status"])
check("the finding says the assumption favoured the pack",
      "most favourable to the pack" in finding["finding"], finding["finding"][:80])
check("the height is reported", finding["character_height_mm"] == 0.63, finding["character_height_mm"])

# Ten units is 6.3mm at the generous bound and 2.5mm at the smallest, so it
# clears the minimum at one magnification and not the other.
tall = letter_height.assess(reading(10), net_quantity=(600.0, "g"),
                            image_height_px=1000, barcode_scale=scale)
finding = next(f for f in tall["findings"] if f["field"] == "net_quantity")
check("text that clears the minimum only at the generous bound stays REVIEW",
      finding["status"] == "REVIEW", finding["status"])
check("it says why it cannot conclude", "does not say which was printed" in finding["finding"],
      finding["finding"][:90])
check("no barcode finding is ever a PASS",
      all(f["status"] != "PASS" for f in short["findings"] + tall["findings"]))

print("\n=== a measured dimension wins ===")
both = letter_height.assess(reading(1), net_quantity=(200.0, "g"), image_height_px=1000,
                            mm_per_unit=5.0, barcode_scale=scale)
check("the supplied dimension is the reported source",
      both["scale"]["source"] == "supplied package dimension", both["scale"]["source"])
finding = next(f for f in both["findings"] if f["field"] == "net_quantity")
check("and it is what the height was computed from", finding["character_height_mm"] == 5.0,
      finding["character_height_mm"])

print("\n=== without either, nothing changes ===")
none = letter_height.assess(reading(1), net_quantity=(200.0, "g"), image_height_px=1000)
check("no scale is reported as unavailable", none["scale"]["available"] is False)
finding = next(f for f in none["findings"] if f["field"] == "net_quantity")
check("and every height finding stays REVIEW", finding["status"] == "REVIEW", finding["status"])

print("\n=== the detector rejects what is not a symbol ===")
work = tempfile.mkdtemp()

# A square block of stripes: right texture, wrong shape.
square = np.full((400, 400, 3), 255, np.uint8)
for x in range(0, 400, 6):
    square[:, x:x + 3] = 0
path = os.path.join(work, "square.png"); cv2.imwrite(path, square)
found = barcode_scale.detect_symbol(path)
check("a square of stripes is not accepted as a symbol",
      found is None or not (barcode_scale.MIN_ASPECT <= found["aspect"] <= barcode_scale.MAX_ASPECT),
      str(found))

# Blank paper: nothing to find.
blank = np.full((400, 900, 3), 240, np.uint8)
path = os.path.join(work, "blank.png"); cv2.imwrite(path, blank)
check("a blank frame yields no scale", barcode_scale.scale_for_image(path) is None)
check("an unreadable file yields no scale", barcode_scale.scale_for_image("no-such-file.png") is None)

print("\n=== a real photograph ===")
photo = "/Users/anantpratapsingh/Documents/niriksha/apps/api/test_product.jpg"
if os.path.exists(photo):
    real = barcode_scale.scale_for_image(photo)
    check("the barcode on a real pack is found and measured",
          bool(real) and real["symbol_width_px"] > barcode_scale.MIN_SYMBOL_WIDTH_PX, str(real)[:120])
    if real:
        check("its magnification range is the permitted one",
              real["magnification_range"] == [0.8, 2.0], str(real["magnification_range"]))
else:
    print("SKIP  the sample photograph is not on this machine")

print(f"\n{passed}/{passed + failed} passed")
sys.exit(1 if failed else 0)
