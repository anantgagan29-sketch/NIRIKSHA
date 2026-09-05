"""
Text extraction on its own.

The same reading step `/product/scan` performs, exposed separately so a client
can see what was read off a label without running the rules over it.
"""

import os
import shutil
import uuid

from fastapi import APIRouter, UploadFile, File, HTTPException

from app.core.config import UPLOAD_DIR
from app.services.ocr_service import extract_text
from app.services.product_parser import parse_product_text

router = APIRouter()


ALLOWED_TYPES = ("image/jpeg", "image/png", "image/webp")


@router.post("/ocr")
async def ocr_image(file: UploadFile = File(...)):

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, PNG and WEBP images are allowed.",
        )

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # The client's filename decides nothing about where this lands. It arrives
    # from the browser unchecked, so a name like "../../app/main.py" would
    # otherwise be written wherever it pointed, and two uploads sharing a name
    # would overwrite each other mid-read.
    extension = os.path.splitext(file.filename or "")[1].lower()

    if extension not in (".jpg", ".jpeg", ".png", ".webp"):
        extension = ".jpg"

    file_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}{extension}")

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    text = extract_text(file_path)

    product = parse_product_text(text)

    return {
        "success": True,
        "text": text,
        "product": product,
    }
