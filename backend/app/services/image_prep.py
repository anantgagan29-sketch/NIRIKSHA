"""
Image preparation for the vision model.

A phone photograph is far larger than the vision model needs to read a label,
and every one of those bytes is upload time on a demo network. This makes one
downscaled copy per scan, which both Gemini calls then share — the original is
untouched and remains the record of what was submitted.
"""

import io
import os

from PIL import Image, ImageOps

from app.core.config import VISION_JPEG_QUALITY, VISION_MAX_EDGE


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

            longest = max(image.size)

            if longest <= VISION_MAX_EDGE:
                # Already small enough to send as-is.
                return image_path

            scale = VISION_MAX_EDGE / longest
            resized = image.resize(
                (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
                Image.LANCZOS,
            )

            root, _ = os.path.splitext(image_path)
            prepared_path = f"{root}.vision.jpg"

            resized.save(
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
