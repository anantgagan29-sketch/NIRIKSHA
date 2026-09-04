"""
Image preparation for the vision model.

A phone photograph is far larger than the vision model needs to read a label,
and every one of those bytes is upload time on a demo network. This makes one
downscaled copy per scan, which both Gemini calls then share — the original is
untouched and remains the record of what was submitted.
"""

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
