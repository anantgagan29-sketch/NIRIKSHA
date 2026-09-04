"""
Product Parser
------------------------------------------------------------
Uses Gemini Vision to read packaged-product images.

Pipeline:

Product Image
      ↓
Gemini Vision
      ↓
Structured JSON
      ↓
Product Information
"""

import os
import json
import time
from typing import Dict, Any

from dotenv import load_dotenv
from google import genai
from PIL import Image


# ============================================================
# LOAD ENVIRONMENT
# ============================================================

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError(
        "GEMINI_API_KEY not found in .env file."
    )


# ============================================================
# GEMINI CLIENT
# ============================================================

client = genai.Client(
    api_key=GEMINI_API_KEY
)


# ============================================================
# GEMINI MODELS
# ============================================================

# Model order and retry budget come from configuration so they can be tuned
# without a code change. The defaults are deliberately tight: a long backoff
# chain across three models is what turned a slow scan into a two-minute one.
from app.services.ai_provider import call_with_fallback

from app.core.config import (
    GEMINI_TIMEOUT_SECONDS,
    GEMINI_MAX_RETRIES,
    GEMINI_MODELS as CONFIGURED_MODELS,
    GEMINI_RETRY_DELAY,
)

GEMINI_MODELS = CONFIGURED_MODELS

MAX_RETRIES = GEMINI_MAX_RETRIES

RETRY_DELAY = GEMINI_RETRY_DELAY


# ============================================================
# GEMINI PROMPT
# ============================================================

PRODUCT_PROMPT = """
You are an expert Indian packaged-product label reader.

Carefully inspect the ENTIRE product image.

The image can be ANY packaged product sold in India.

Do NOT assume that it is a particular brand, company,
or product.

Read all visible text, including:

- product name
- brand
- manufacturer
- packer
- address
- MRP
- net quantity
- manufacturing date
- expiry date
- best before
- batch number
- license number
- consumer care phone
- consumer care email
- country of origin
- unit sale price
- other dates
- other declarations

Extract information ONLY if it is actually visible
and readable.

DO NOT GUESS.

Return ONLY valid JSON.

Use exactly this structure:

{
    "product_name": null,
    "brand": null,
    "manufacturer": null,
    "packer": null,
    "address": null,
    "mrp": null,
    "net_quantity": null,
    "manufacturing_date": null,
    "packing_date": null,
    "expiry_date": null,
    "best_before": null,
    "shelf_life": null,
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

Extract the actual generic/product name printed on
the package.

Examples:

- Raisins
- Namkeen
- Biscuits
- Potato Chips
- Shampoo

Do NOT use a company name as the product name.


2. BRAND

Extract the brand name separately from the product name.


3. MANUFACTURER / PACKER

Look for:

Manufactured by
Manufactured & Marketed by
Packed by
Packaged by
Marketed by
Manufactured for

Put the company in the appropriate field.

Do not invent the relationship between a company
and the product.


4. ADDRESS

Extract the COMPLETE physical address printed on
the package.

Copy the address exactly from the image.

Do NOT:

- invent missing parts
- combine unrelated text
- use a consumer-care PO Box as the company address

If partially readable, return only the readable portion.


5. MRP

This is VERY IMPORTANT.

Find the value specifically associated with:

MRP
M.R.P.
Maximum Retail Price

Examples:

MRP Rs. 10/-
MRP ₹10
M.R.P. Rs. 450.00
Maximum Retail Price Rs. 100

Return ONLY the MRP value.

Do NOT confuse MRP with:

- unit sale price
- price per gram
- price per kg
- batch number
- license number
- barcode
- product code

If MRP cannot be confidently identified,
return null.


6. NET QUANTITY

This field requires SPECIAL CARE.

Look for:

Net Quantity
Net Qty.
Net Wt.
Net Weight

IMPORTANT:

Return the COMPLETE quantity declaration as it is
visibly printed on the package.

You MUST preserve important words and symbols that
change the meaning of the quantity.

Especially preserve words such as:

- FREE
- EXTRA
- ADDITIONAL
- FREE OF COST
- GRATUITOUS
- BONUS

For example, if the package visibly says:

225 g (200 g + 25 g FREE)

return:

"net_quantity": "225 g (200 g + 25 g FREE)"

Do NOT return:

"225 g (200 g + 25 g)"

Do NOT replace:

"FREE"

with:

"+"

Do NOT remove the word FREE.

Another example:

If the package says:

200 g + 25 g FREE

return exactly:

"200 g + 25 g FREE"

If the package says:

500 g + 100 g EXTRA

preserve:

"500 g + 100 g EXTRA"

If the package only says:

225 g

return:

"225 g"

If FREE or EXTRA is NOT visibly printed,
DO NOT invent it.

VERY IMPORTANT:

The outer total quantity and the paid/free quantity
may both appear in the same declaration.

Example:

225 g (200 g + 25 g FREE)

means:

Total physical quantity = 225 g
Paid quantity = 200 g
Free quantity = 25 g

Do NOT discard this information.

Preserve the complete declaration in net_quantity.


7. MANUFACTURING AND PACKING DATES

These are two different declarations. Do not merge them.

A manufacturing date is labelled:

MFD
MFG
Mfg Date
MFD Date
Manufactured
Manufactured On
Manufacturing Date
Date of Manufacture

Put it in "manufacturing_date".

A packing date is labelled:

PKD
Packed
Packed On
Packed Date
Packing Date
Packaging Date
Date of Packing

Put it in "packing_date".

Return the date exactly as printed.
Do not reformat it.
Do not convert 12/08/26 into 2026-08-12.

If a package shows only one of the two,
fill only that field and leave the other null.
Do NOT copy a packing date into
"manufacturing_date" to fill the gap.

Do NOT confuse either with expiry,
best-before or batch information.


8. EXPIRY, USE BY AND BEST BEFORE

An expiry date is labelled:

EXP
EXP Date
EXPIRY
EXPIRY DATE
USE BY
USE BEFORE

If the package says:

USE BY: 31/10/26

return:

"expiry_date": "31/10/26"

BEST BEFORE appears in two different forms
and they go into two different fields.

If it states an actual date:

BEST BEFORE 08/2027

return:

"best_before": "08/2027"

If it states a duration:

BEST BEFORE 6 MONTHS FROM PKD

return:

"shelf_life": "6 Months from PKD"

Keep the reference point ("from PKD",
"from manufacture") in the text.
It is what the duration counts from.


8a. PRESERVE THE PRINTED LABEL

For every date you find, also add one entry
to "other_dates" containing the complete
printed text INCLUDING its label:

"other_dates": [
    "PKD: 12/08/26",
    "Best Before 6 Months from PKD"
]

This preserves what the package actually says.
Never invent a label that is not printed.


9. BATCH NUMBER

Look for:

Batch No.
Batch Number
Lot No.
Lot Number
B.No.

Copy the COMPLETE batch number.

Do NOT confuse it with:

- license number
- MRP
- date
- barcode


10. LICENSE NUMBER

Extract visible food/license numbers such as
FSSAI license numbers.

Copy them exactly as printed.

Do NOT confuse them with phone numbers
or batch numbers.


11. CONSUMER CARE PHONE

Search the ENTIRE image.

Look especially near:

CONSUMER CARE
CUSTOMER CARE
CONTACT US
CONTACT CUSTOMER CARE
CALL US AT
OR CALL US
HELPLINE
TOLL FREE
FEEDBACK
FOR FEEDBACK
CONSUMER COMPLAINT

Copy the COMPLETE phone number.

Example:

1800 890 6869

Return:

"consumer_care_phone": "1800 890 6869"

Do NOT confuse phone numbers with:

- license numbers
- batch numbers
- registration numbers
- barcodes
- product codes


12. CONSUMER CARE EMAIL

Search the ENTIRE image for email addresses.

Copy the complete email address exactly.

Do NOT invent an email address.


13. COUNTRY OF ORIGIN

Look for:

MADE IN INDIA
COUNTRY OF ORIGIN
PRODUCT OF INDIA
IMPORTED FROM

If clearly visible, extract it.


14. UNIT SALE PRICE

Keep this separate from MRP.

Look for:

UNIT SALE PRICE

Examples:

Rs. 0.26/- PER g
Rs. 20 PER kg

Return it in:

"unit_sale_price"


15. OTHER DATES

If the package contains dates that do not clearly
belong to manufacturing or expiry, put them into:

"other_dates"


16. OTHER DECLARATIONS

Include other important visible declarations useful
for packaged commodity compliance.

Examples:

INCL. OF ALL TAXES
PROPRIETARY FOOD
REGISTERED TRADE MARK
PACK SIZE
SINGLE CONSUMPTION PACK

IMPORTANT:

If a declaration contains words such as:

FREE
EXTRA
ADDITIONAL
FREE OF COST

and it is relevant to the product quantity or
pack contents, preserve those words exactly.

Do NOT remove them.

Do NOT invent declarations.


17. MULTIPLE NUMBERS

A package can contain many numbers.

Before assigning a number to a field, determine
what the number actually represents from its
surrounding text.

For example:

MRP Rs. 10/-

means:

mrp = Rs. 10/-

while:

Rs. 0.26/- PER g

means:

unit_sale_price = Rs. 0.26/- PER g

and:

Lic. No. 1001047000108

means:

license_number = 1001047000108

and:

1800 890 6869

means:

consumer_care_phone = 1800 890 6869


18. IMAGE QUALITY

If text is:

- blurry
- tilted
- small
- folded
- partially hidden

carefully inspect it.

Use surrounding words to understand the field.

Do NOT invent information.

If the value cannot be confidently read,
return null.


19. EXACT TEXT PRESERVATION

For important compliance declarations, preserve
the visible wording as closely as possible.

This is especially important for:

- Net Quantity
- FREE quantity
- EXTRA quantity
- ADDITIONAL quantity
- MRP
- Unit Sale Price
- Dates
- Batch Number
- License Number
- Consumer Care details

Do NOT simplify a declaration if doing so could
change its legal or commercial meaning.

For example:

Visible:

225 g (200 g + 25 g FREE)

Correct:

"225 g (200 g + 25 g FREE)"

Incorrect:

"225 g (200 g + 25 g)"

Incorrect:

"225 g"

Incorrect:

"200 g + 25 g"

The word FREE must be preserved if it is visible.


20. FINAL RULE

Accuracy is more important than filling every field.

If information is not clearly visible:

return null

Do NOT guess.

Return ONLY the JSON object.
"""


# ============================================================
# EXPECTED FIELDS
# ============================================================

EXPECTED_FIELDS = [
    "product_name",
    "brand",
    "manufacturer",
    "packer",
    "address",
    "mrp",
    "net_quantity",
    "manufacturing_date",
    "packing_date",
    "expiry_date",
    "best_before",
    "shelf_life",
    "batch_number",
    "license_number",
    "consumer_care_phone",
    "consumer_care_email",
    "country_of_origin",
    "unit_sale_price",
    "other_dates",
    "other_declarations"
]


# ============================================================
# NORMALIZE RESULT
# ============================================================

def parse_first_json_object(raw: str) -> dict:
    """
    Reads the JSON object out of a model response.

    The model occasionally appends something after the object it was asked
    for — a stray brace, a second copy, a line of commentary. Parsing the whole
    string then fails with "Extra data" and a complete, correct reading is
    thrown away. Decoding only the first value keeps that reading.

    Anything before the object (a ```json fence, a preamble) is skipped to the
    first brace. A response with no object at all still raises, because there
    is genuinely nothing to read.
    """

    text = raw.strip()

    start = text.find("{")

    if start == -1:
        raise json.JSONDecodeError("No JSON object in response", text, 0)

    # raw_decode stops at the end of the first complete value and ignores
    # whatever follows it.
    result, _ = json.JSONDecoder().raw_decode(text, start)

    return result


def normalize_result(
    result: Dict[str, Any]
) -> Dict[str, Any]:

    normalized = {}

    for field in EXPECTED_FIELDS:

        if field in [
            "other_dates",
            "other_declarations"
        ]:

            value = result.get(field)

            if isinstance(value, list):

                normalized[field] = value

            elif value is None:

                normalized[field] = []

            else:

                normalized[field] = [str(value)]

        else:

            value = result.get(field)

            if value is None:

                normalized[field] = None

            elif isinstance(value, str):

                value = value.strip()

                normalized[field] = (
                    value if value else None
                )

            else:

                normalized[field] = str(value)

    return normalized


# ============================================================
# GEMINI REQUEST
# ============================================================

def send_to_gemini(
    image,
    model: str
):

    """
    Send image to Gemini using the specified model.
    """

    print(f"Gemini: Trying {model}...")

    response = client.models.generate_content(
        model=model,
        contents=[image, PRODUCT_PROMPT],
        config={
            "response_mime_type": "application/json"
        }
    )

    print(f"Gemini: Success using {model}")

    return response


# ============================================================
# GEMINI IMAGE PARSER
# ============================================================

def parse_product_image(
    image_path: str
) -> Dict[str, Any]:

    """
    Send product image directly to Gemini Vision.

    Includes automatic retry and model fallback
    for temporary Gemini availability problems.
    """

    # --------------------------------------------------------
    # CHECK IMAGE
    # --------------------------------------------------------

    if not os.path.exists(image_path):

        raise FileNotFoundError(
            f"Image not found: {image_path}"
        )


    # --------------------------------------------------------
    # OPEN IMAGE
    # --------------------------------------------------------

    try:

        image = Image.open(image_path)

        print(
            f"Gemini: Image loaded "
            f"({image.size[0]}, {image.size[1]}) "
            f"{image.format}"
        )

        image.load()

    except Exception as e:

        raise ValueError(
            f"Could not open image: {str(e)}"
        )


    # --------------------------------------------------------
    # TRY MODELS
    # --------------------------------------------------------

    last_error = None

    # --------------------------------------------------------
    # ASK A MODEL
    # --------------------------------------------------------
    #
    # Choosing the model, retrying, and remembering which ones have run out
    # of quota all belong to ai_provider. This function's job is to turn one
    # response into a product dictionary.

    def read_with(model: str) -> Dict[str, Any]:

        response = send_to_gemini(image, model)

        if not response.text:
            raise ValueError("The model returned an empty response.")

        raw_response = response.text.strip()

        try:
            result = parse_first_json_object(raw_response)

        except json.JSONDecodeError as e:
            print("Model returned invalid JSON:")
            print(raw_response)
            raise ValueError(f"Invalid JSON: {str(e)}")

        if not isinstance(result, dict):
            raise ValueError("Model response was not a JSON object.")

        return normalize_result(result)

    # The request's own deadline is passed down, so the walk through the model
    # list stops when there is no time left rather than being cut off mid-call.
    result, _model = call_with_fallback(
        read_with,
        transient_retries=MAX_RETRIES,
        retry_delay=RETRY_DELAY,
        label="Declarations",
        overall_deadline=time.monotonic() + GEMINI_TIMEOUT_SECONDS,
    )

    return result


# ============================================================
# OLD OCR COMPATIBILITY FUNCTION
# ============================================================

def parse_product_text(
    text: str
) -> Dict[str, Any]:

    """
    Compatibility function for old OCR-based code.

    The current product scanning pipeline uses
    parse_product_image() instead.
    """

    return {
        "raw_ocr_text": text,

        "product_name": None,
        "brand": None,
        "manufacturer": None,
        "packer": None,
        "address": None,
        "mrp": None,
        "net_quantity": None,
        "manufacturing_date": None,
        "packing_date": None,
        "expiry_date": None,
        "best_before": None,
        "shelf_life": None,
        "batch_number": None,
        "license_number": None,
        "consumer_care_phone": None,
        "consumer_care_email": None,
        "country_of_origin": None,
        "unit_sale_price": None,
        "other_dates": [],
        "other_declarations": []
    }