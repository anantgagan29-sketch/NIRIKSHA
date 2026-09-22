"""
Image preparation for the vision model.

A phone photograph is far larger than the vision model needs to read a label,
and every one of those bytes is upload time on a demo network. This makes one
downscaled copy per scan, which both Gemini calls then share — the original is
untouched and remains the record of what was submitted.

It also crops to the package. A photograph taken by hand puts the pack in a
third of the frame and a room in the rest, and the declarations that matter
are the smallest print on it: the batch number, the licence number, the
address. Sending the whole frame spends the resolution budget on a car seat
and leaves those a few pixels tall, which is why they came back as "not
detected" from packs that plainly carried them. Cropping first spends the
same bytes on the label.
"""

import io
import os

import cv2
import numpy as np
from PIL import Image, ImageOps

from app.core.config import (
    VISION_CROP_ENABLED,
    VISION_CROP_MAX_AREA,
    VISION_CROP_MIN_AREA,
    VISION_JPEG_QUALITY,
    VISION_MAX_EDGE,
)
from app.services.image_quality_service import detect_product_region


def _crop_to_package(image: Image.Image) -> tuple[Image.Image, dict | None]:
    """
    Crops to the detected package, or returns the frame untouched.

    The region is only used when it is small enough to be worth cropping to
    and large enough to be a package rather than a highlight: a detection
    covering almost the whole frame saves nothing, and a tiny one is more
    likely a reflection than a pack. Either way the original frame is a
    safe answer, so every uncertainty resolves to it.
    """
    if not VISION_CROP_ENABLED:
        return image, None

    try:
        frame = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        region = detect_product_region(frame)

        if not region:
            return image, None

        area = region["width"] * region["height"]
        frame_area = image.width * image.height

        if frame_area <= 0:
            return image, None

        share = area / frame_area

        if not (VISION_CROP_MIN_AREA <= share <= VISION_CROP_MAX_AREA):
            return image, None

        box = (
            region["x"],
            region["y"],
            region["x"] + region["width"],
            region["y"] + region["height"],
        )

        cropped = image.crop(box)
        print(
            f"Image preparation: cropped to the package "
            f"({cropped.width}x{cropped.height} of {image.width}x{image.height}, "
            f"{share * 100:.0f}% of the frame)"
        )
        return cropped, region

    except Exception as error:
        # A failure to find the package must not cost the scan its image.
        print("Image preparation: package detection skipped -", str(error)[:120])
        return image, None


def prepare_for_vision(image_path: str) -> str:
    """
    Returns a path to a downscaled JPEG suitable for the vision model.

    Falls back to the original path if anything goes wrong: a failure to
    optimise must never cost the user their scan.
    """
    try:
        with Image.open(image_path) as source:
            # Phone cameras record orientation in EXIF rather than in the
            # pixels; without this a portrait photo reaches the model sideways.
            image = ImageOps.exif_transpose(source)
            image = image.convert("RGB")

            # The label first, then the size. Cropping before the downscale
            # is the whole point: the crop gets the resolution the frame was
            # spending on the background.
            image, region = _crop_to_package(image)

            longest = max(image.size)

            if longest <= VISION_MAX_EDGE and region is None:
                # Already small enough, and nothing was cropped, so the
                # original file is exactly what would be written here.
                return image_path

            if longest > VISION_MAX_EDGE:
                scale = VISION_MAX_EDGE / longest
                image = image.resize(
                    (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
                    Image.LANCZOS,
                )

            root, _ = os.path.splitext(image_path)
            prepared_path = f"{root}.vision.jpg"

            image.save(
                prepared_path,
                format="JPEG",
                quality=VISION_JPEG_QUALITY,
                optimize=True,
            )

            return prepared_path

    except Exception as error:
        print("Image preparation skipped:", str(error))
        return image_path


def discard_prepared(prepared_path: str, original_path: str) -> None:
    """Removes the temporary copy, leaving the original in place."""
    if prepared_path == original_path:
        return
    try:
        os.remove(prepared_path)
    except OSError:
        pass


# The longest edge kept for the copy stored against the scan. Large enough to
# read a label from in a report, small enough that a database row holding one
# stays a reasonable size.
RECORD_MAX_EDGE = 1024
RECORD_JPEG_QUALITY = 78


def thumbnail_for_record(image_path: str) -> tuple[bytes, str] | None:
    """
    A copy of the submitted photograph, small enough to keep with the scan.

    The report has to show the packet it is about, and a report opened a week
    later has nothing to show unless the picture was kept. The upload
    directory is not that: on this host it is wiped on every deploy, and
    nothing recorded which file belonged to which scan anyway.

    Returns the bytes and their media type, or None if the photograph cannot
    be read — a scan is still worth recording without its picture.
    """
    try:
        with Image.open(image_path) as source:
            # Orientation lives in EXIF on a phone photograph; without this
            # the report shows the label on its side.
            image = ImageOps.exif_transpose(source)
            image = image.convert("RGB")

            longest = max(image.size)

            if longest > RECORD_MAX_EDGE:
                scale = RECORD_MAX_EDGE / longest
                image = image.resize(
                    (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
                    Image.LANCZOS,
                )

            buffer = io.BytesIO()
            image.save(buffer, format="JPEG", quality=RECORD_JPEG_QUALITY, optimize=True)

            return buffer.getvalue(), "image/jpeg"

    except Exception as error:
        print("Scan image not kept:", str(error))
        return None
