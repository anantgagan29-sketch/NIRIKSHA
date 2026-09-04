import os
import json

from dotenv import load_dotenv
from google import genai
from PIL import Image


# ============================================================
# LOAD ENVIRONMENT VARIABLES
# ============================================================

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError(
        "GEMINI_API_KEY not found in environment variables."
    )


# ============================================================
# GEMINI CLIENT
# ============================================================

client = genai.Client(
    api_key=api_key
)


# ============================================================
# EXTRACT TEXT / PRODUCT INFORMATION
# ============================================================

def extract_text(image_path):
    """
    Extract packaged-product information using Gemini Vision.

    This function keeps the same name and interface as the
    previous Tesseract OCR function so the existing backend
    does not need to be changed yet.
    """

    # ========================================================
    # 1. CHECK IMAGE
    # ========================================================

    if not os.path.exists(image_path):
        raise ValueError(
            f"Image not found: {image_path}"
        )

    # ========================================================
    # 2. LOAD IMAGE
    # ========================================================

    try:

        image = Image.open(image_path)

    except Exception as e:

        raise ValueError(
            f"Could not open image: {str(e)}"
        )

    # ========================================================
    # 3. GEMINI PROMPT
    # ========================================================

    prompt = """
You are an expert Indian packaged-product label reader.

Carefully inspect the ENTIRE product image.

Extract ALL information that is actually visible and readable
on the package.

DO NOT GUESS.

Return ONLY valid JSON using exactly this structure:

{
    "product_name": null,
    "brand": null,
    "manufacturer": null,
    "packer": null,
    "address": null,
    "mrp": null,
    "net_quantity": null,
    "manufacturing_date": null,
    "expiry_date": null,
    "best_before": null,
    "batch_number": null,
    "license_number": null,
    "consumer_care_phone": null,
    "consumer_care_email": null,
    "country_of_origin": null,
    "unit_sale_price": null,
    "other_dates": [],
    "other_declarations": []
}

IMPORTANT RULES:

1. PRODUCT NAME

Extract the actual product/generic name printed on the package.

Do not use the company name as the product name.


2. BRAND

Extract the brand separately from the product name.


3. MANUFACTURER / PACKER

Look for:

Manufactured by
Manufactured & Marketed by
Packed by
Packaged by
Marketed by
Manufactured for

Copy the company name exactly as visible.


4. ADDRESS

Extract the physical address associated with the
manufacturer, packer or marketer.

Do not invent missing information.

Do not use a consumer-care PO Box as the company address
unless the package clearly identifies it as the company address.


5. MRP

Look specifically for:

MRP
M.R.P.
Maximum Retail Price

Copy the MRP value exactly.

Do NOT confuse MRP with:

- unit sale price
- price per gram
- price per kg
- batch number
- license number
- barcode

If MRP cannot be confidently identified, return null.


6. NET QUANTITY

Look for:

Net Quantity
Net Qty.
Net Wt.
Net Weight

Copy the actual value.

Do not confuse it with serving size.


7. MANUFACTURING DATE

Look for:

MFD
MFG
Manufactured
Manufacturing Date
PKD
Packed
Packed on

Return the actual visible date.


8. EXPIRY / USE BY / BEST BEFORE

Look for:

USE BY
EXPIRY
EXP
BEST BEFORE

Keep expiry_date and best_before separate where possible.


9. BATCH NUMBER

Look for:

Batch No.
Batch Number
Lot No.
Lot Number
B.No.

Copy the complete batch number.


10. LICENSE NUMBER

Extract visible license numbers such as FSSAI license numbers.

Copy them exactly as printed.

Do not confuse them with phone numbers or batch numbers.


11. CONSUMER CARE PHONE

Search the ENTIRE image.

Look for:

CONSUMER CARE
CUSTOMER CARE
CONTACT US
HELPLINE
TOLL FREE
FEEDBACK

Copy the complete phone number exactly as printed.

Do not confuse it with a license number, batch number,
barcode or product code.


12. CONSUMER CARE EMAIL

Search the entire image for email addresses.

Copy the complete email address exactly as visible.

Do not invent an email address.


13. COUNTRY OF ORIGIN

Look for:

MADE IN INDIA
COUNTRY OF ORIGIN
PRODUCT OF INDIA
IMPORTED FROM

Extract it if clearly visible.


14. UNIT SALE PRICE

Keep this separate from MRP.

Look specifically for:

UNIT SALE PRICE
PER g
PER kg

Example:

Rs. 0.90 per g

must NOT be treated as the MRP.


15. OTHER DATES

Put dates that cannot confidently be classified into:

"other_dates"

Example:

[
    "03/07/26",
    "31/10/26"
]


16. OTHER DECLARATIONS

Include other important visible declarations such as:

INCL. OF ALL TAXES
PROPRIETARY FOOD
REGISTERED TRADE MARK
SINGLE CONSUMPTION PACK

Do not invent declarations.


17. ACCURACY

Accuracy is more important than filling every field.

If information is not clearly visible:

return null.


18. IMPORTANT

Inspect the entire image carefully.

Pay special attention to small text around:

- MRP
- dates
- batch number
- license number
- manufacturer
- address
- consumer care information

Return ONLY the JSON object.
"""

    # ========================================================
    # 4. SEND IMAGE TO GEMINI
    # ========================================================

    try:

        response = client.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=[
                image,
                prompt
            ],
            config={
                "response_mime_type": "application/json"
            }
        )

    except Exception as e:

        raise RuntimeError(
            f"Gemini Vision request failed: {str(e)}"
        )

    # ========================================================
    # 5. GET RESPONSE
    # ========================================================

    response_text = response.text

    if not response_text:
        raise RuntimeError(
            "Gemini returned an empty response."
        )

    # ========================================================
    # 6. VERIFY JSON
    # ========================================================

    try:

        result = json.loads(response_text)

    except json.JSONDecodeError as e:

        raise RuntimeError(
            f"Gemini returned invalid JSON: {str(e)}"
        )

    # ========================================================
    # 7. CONVERT JSON INTO TEXT
    #
    # This keeps compatibility with the existing backend.
    # Your product_parser currently expects text.
    # ========================================================

    extracted_lines = []

    for key, value in result.items():

        if value is None:
            continue

        if isinstance(value, list):

            for item in value:

                extracted_lines.append(
                    f"{key}: {item}"
                )

        else:

            extracted_lines.append(
                f"{key}: {value}"
            )

    extracted_text = "\n".join(
        extracted_lines
    )

    # ========================================================
    # 8. RETURN TEXT
    # ========================================================

    return extracted_text