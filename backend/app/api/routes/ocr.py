from fastapi import APIRouter, UploadFile, File
import shutil
import os

from app.services.ocr_service import extract_text
from app.services.product_parser import parse_product_text

router = APIRouter()


@router.post("/ocr")
async def ocr_image(file: UploadFile = File(...)):

    # Create uploads folder if it doesn't exist
    os.makedirs("uploads", exist_ok=True)

    # Temporary file path
    file_path = os.path.join("uploads", file.filename)

    # Save uploaded image
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Run OCR
    text = extract_text(file_path)

    product = parse_product_text(text)

    return {
        "success": True,
        "text": text,
        "product": product
}