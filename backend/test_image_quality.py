import cv2
import shutil
from app.services.image_quality_service import analyze_image_quality


# Your current test image
IMAGE_PATH = "test_product.jpg"


# -----------------------------------------
# Check that the original image exists
# -----------------------------------------

image = cv2.imread(IMAGE_PATH)

if image is None:
    print("ERROR: Could not find:")
    print(IMAGE_PATH)
    print("\nMake sure test_product.jpg is inside the backend folder.")
    exit()


# -----------------------------------------
# Create artificial test images
# -----------------------------------------

# 1. Blurry image
blurry_image = cv2.GaussianBlur(image, (51, 51), 0)
cv2.imwrite("test_blurry.jpg", blurry_image)


# 2. Dark image
dark_image = cv2.convertScaleAbs(
    image,
    alpha=0.35,
    beta=0
)
cv2.imwrite("test_dark.jpg", dark_image)


# -----------------------------------------
# Test function
# -----------------------------------------

def test_image(path, name):

    result = analyze_image_quality(path)

    print("\n================================")
    print(name)
    print("================================")

    print("Status:", result["status"])
    print("Score:", result["score"])
    print("Blur score:", result.get("blur_score"))
    print("Brightness:", result.get("brightness"))
    print("Resolution:", result.get("resolution"))

    print("\nMessage:")
    print(result["message"])

    print("\nRetake reasons:")

    if result["retake_reason"]:
        for reason in result["retake_reason"]:
            print("-", reason)
    else:
        print("None")


# -----------------------------------------
# Run tests
# -----------------------------------------

test_image(
    "test_product.jpg",
    "CURRENT PHOTO"
)

test_image(
    "test_blurry.jpg",
    "ARTIFICIALLY BLURRED PHOTO"
)

test_image(
    "test_dark.jpg",
    "ARTIFICIALLY DARK PHOTO"
)


# ----------------------------------------------------------------------
# Cropping to the package before the vision call
# ----------------------------------------------------------------------
# The declarations that went missing from real photographs were the smallest
# print on the pack, and the pack was a third of the frame. These check that
# the crop happens, that it keeps the label, and that an uncertain case falls
# back to the whole frame.

import math
import os
import tempfile

from PIL import Image

import app.core.config as config
from app.services import image_prep

print("\n=== cropping to the package ===")

work = tempfile.mkdtemp()


def photograph(pack_share: float) -> str:
    """A dark frame with a bright rectangle standing in for the pack."""
    frame = Image.new("RGB", (2000, 3000), (12, 12, 14))
    side = math.sqrt(pack_share * frame.width * frame.height)
    width = int(min(frame.width * 0.98, side))
    height = int(min(frame.height * 0.98, (pack_share * frame.width * frame.height) / max(1, width)))
    frame.paste(Image.new("RGB", (width, height), (243, 243, 240)),
                ((frame.width - width) // 2, (frame.height - height) // 2))
    path = os.path.join(work, f"pack-{int(pack_share * 100)}.jpg")
    frame.save(path, quality=92)
    return path


def prepared(source: str, name: str) -> Image.Image:
    copy = os.path.join(work, name)
    shutil.copy(source, copy)
    return Image.open(image_prep.prepare_for_vision(copy))


# A pack in a third of the frame: sent whole and capped at 2048 the pack is
# roughly 1100px across, and cropped first it is the full width.
source = photograph(0.30)
whole = Image.open(source)
cropped = prepared(source, "in-30.jpg")
pack_whole = whole.width * 0.55 * (2048 / max(whole.size))
print(f"  pack across the frame: {pack_whole:.0f}px whole, {cropped.width:.0f}px cropped")
assert cropped.width > pack_whole * 1.4, (cropped.width, pack_whole)
print("PASS  a pack in a third of the frame gains resolution from the crop")

# A frame that is almost all pack has nothing to gain from a crop.
source = photograph(0.95)
assert prepared(source, "in-95.jpg").width / Image.open(source).width <= 1.0
print("PASS  a frame that is nearly all pack is scaled, not cropped away")

# Switched off, the behaviour is exactly what it was before this existed.
config.VISION_CROP_ENABLED = False
image_prep.VISION_CROP_ENABLED = False
assert prepared(photograph(0.30), "in-off.jpg").size == (1365, 2048)
print("PASS  switched off, the whole frame is sent as before")
config.VISION_CROP_ENABLED = True
image_prep.VISION_CROP_ENABLED = True


print("\n================================")
print("ALL TESTS COMPLETE")
print("================================")
