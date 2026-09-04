import os
import json

from dotenv import load_dotenv
from google import genai
from PIL import Image


# ============================================================
# 1. LOAD ENVIRONMENT
# ============================================================

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

print("API key found:", bool(api_key))

if not api_key:
    print("ERROR: GEMINI_API_KEY not found in .env")
    exit()


# ============================================================
# 2. CREATE GEMINI CLIENT
# ============================================================

client = genai.Client(
    api_key=api_key
)


# ============================================================
# 3. IMAGE PATH
# ============================================================

image_path = "test_product.jpg"

if not os.path.exists(image_path):

    print(
        "ERROR: Image not found:",
        image_path
    )

    exit()


print("Image found:", image_path)


# ============================================================
# 4. OPEN IMAGE
# ============================================================

try:

    image = Image.open(image_path)

    print(
        "Image loaded:",
        image.size,
        image.format
    )

except Exception as e:

    print(
        "ERROR: Could not open image:",
        e
    )

    exit()


# ============================================================
# 5. PROMPT
# ============================================================

prompt = """

You are an expert Indian packaged-product label reader.

Carefully inspect the ENTIRE product image.

The image can be ANY packaged product sold in India.

Do NOT assume the product is Kurkure, PepsiCo,
Reliance, Good Life, or any other particular brand.

Identify the product based ONLY on what is visible
in the image.

Read all visible text, including:

- front label
- back label
- side panels
- bottom/top areas
- small printed text
- MRP
- dates
- batch numbers
- license numbers
- consumer-care information
- unit sale price
- manufacturer/packer information

Do NOT guess.

If a field is not clearly visible,
return null.

Return ONLY valid JSON.


USE EXACTLY THIS STRUCTURE:

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


============================================================
PRODUCT NAME
============================================================

Extract the generic/product name.

Examples:

Raisins
Namkeen
Biscuits
Potato Chips
Shampoo
Soap
Rice

Do NOT use the company name as the product name.


============================================================
BRAND
============================================================

Extract the brand separately.

Example:

Product:
Namkeen

Brand:
Kurkure


============================================================
MANUFACTURER
============================================================

Look for:

Manufactured by
Manufactured & Marketed by
Manufactured for
Marketed by

Copy the company name exactly as visible.

Do not guess the relationship between the company
and the product.


============================================================
PACKER
============================================================

Look for:

Packed by
Packaged by
Packing unit

Copy the company name exactly if visible.


============================================================
ADDRESS
============================================================

Extract the complete physical address associated
with the manufacturer, packer or marketer.

Do NOT automatically use a consumer-care PO Box
as the manufacturer address.

Copy only what is visible.

Do not invent missing information.


============================================================
MRP
============================================================

Find the value specifically associated with:

MRP
M.R.P.
Maximum Retail Price

Examples:

MRP Rs. 10/-
MRP ₹10
MRP Rs. 450.00

Return ONLY the MRP value.

Example:

"MRP Rs. 10/- (INCL. OF ALL TAXES)"

should produce:

"mrp": "Rs. 10/-"

Do NOT confuse MRP with:

Unit Sale Price
Price per gram
Price per kg
Batch number
FSSAI license
Barcode
Registration number


============================================================
NET QUANTITY
============================================================

Look for:

NET QUANTITY
NET QTY
NET WT
NET WEIGHT

Examples:

500 g
38.5 g
1 kg

Do not confuse it with serving size
or number of servings.


============================================================
MANUFACTURING DATE
============================================================

Look for:

MFD
MFG
Manufactured
Manufacturing Date
PKD
Packed
Packed on

Return the actual date if visible.

Do NOT confuse it with:

Batch number
Expiry
Use By
Best Before


============================================================
EXPIRY / USE BY
============================================================

Look for:

USE BY
EXPIRY
EXP

If:

USE BY: 31/10/26

return:

"expiry_date": "31/10/26"


============================================================
BEST BEFORE
============================================================

Look for:

BEST BEFORE

Example:

BEST BEFORE 6 MONTHS FROM PACKAGING

return:

"best_before": "6 MONTHS FROM PACKAGING"


============================================================
BATCH NUMBER
============================================================

Look for:

Batch No.
Batch Number
Lot No.
Lot Number
B.No.

Copy the COMPLETE batch number.

Do not confuse it with:

MRP
FSSAI license
Barcode
Date


============================================================
LICENSE NUMBER
============================================================

Extract visible license numbers.

For food products this may include:

FSSAI Lic. No.

Copy the number exactly.

Do NOT confuse it with:

Phone number
Batch number
Barcode


============================================================
CONSUMER CARE PHONE
============================================================

THIS IS VERY IMPORTANT.

Search the ENTIRE IMAGE for phone numbers.

Look especially near:

CONSUMER CARE
CUSTOMER CARE
CONTACT US
CONTACT CUSTOMER CARE
CALL US
CALL US AT
OR CALL US AT
HELPLINE
TOLL FREE
FEEDBACK
FOR FEEDBACK
CONSUMER COMPLAINT

Examples:

1800 890 6869
1800-123-4567
1800 22 6868

Copy the COMPLETE phone number.

If a clearly readable phone number exists,
return it.

Do NOT confuse phone numbers with:

FSSAI numbers
Batch numbers
License numbers
Registration numbers
Barcodes
Product codes

If no phone number is clearly readable:

"consumer_care_phone": null


============================================================
CONSUMER CARE EMAIL
============================================================

Search the ENTIRE IMAGE for email addresses.

Examples:

consumer@company.com
care@company.com
feedback@company.com

Copy exactly as printed.

Do NOT invent an email address.


============================================================
COUNTRY OF ORIGIN
============================================================

Look for:

MADE IN INDIA
COUNTRY OF ORIGIN
PRODUCT OF INDIA
IMPORTED FROM

Extract only if clearly visible.


============================================================
UNIT SALE PRICE
============================================================

Look specifically for:

UNIT SALE PRICE

Examples:

Rs. 0.26/- PER g
Rs. 20 PER kg

Keep this separate from MRP.


============================================================
OTHER DATES
============================================================

If a visible date cannot confidently be classified
as manufacturing or expiry/use-by, put it into:

"other_dates"

Example:

[
    "03/07/26",
    "31/10/26"
]


============================================================
OTHER DECLARATIONS
============================================================

Include useful visible declarations such as:

INCL. OF ALL TAXES
PROPRIETARY FOOD
REGISTERED TRADE MARK
SINGLE CONSUMPTION PACK
PACK SIZE

Do not invent declarations.


============================================================
MULTIPLE NUMBERS
============================================================

A package may contain many numbers.

Always determine what a number represents
from the surrounding text.

Example:

MRP Rs. 10/-

means:

"mrp": "Rs. 10/-"


Example:

Rs. 0.26/- PER g

means:

"unit_sale_price": "Rs. 0.26/- PER g"


Example:

Lic. No. 1001047000108

means:

"license_number": "1001047000108"


Example:

1800 890 6869

means:

"consumer_care_phone": "1800 890 6869"


============================================================
IMAGE QUALITY
============================================================

If text is:

- blurry
- tilted
- folded
- small
- partially hidden

carefully inspect the surrounding text.

Do NOT guess.

If the value cannot be confidently read,
return null.


============================================================
FINAL RULE
============================================================

Accuracy is more important than filling every field.

If information is not clearly visible:

return null.

DO NOT GUESS.

RETURN ONLY THE JSON OBJECT.
"""


# ============================================================
# 6. SEND IMAGE TO GEMINI
# ============================================================

print("\nSending image to Gemini...\n")


try:

    response = client.models.generate_content(

        model="gemini-3.5-flash-lite",

        contents=[image,prompt],

        config={
            "response_mime_type": "application/json"
        }
    )

except Exception as e:

    print("\nGEMINI ERROR:")
    print(e)

    exit()


# ============================================================
# 7. DISPLAY RAW RESPONSE
# ============================================================

print("\n========== GEMINI RESPONSE ==========\n")

print(response.text)

print("\n======================================\n")


# ============================================================
# 8. VERIFY JSON
# ============================================================

try:

    result = json.loads(response.text)

    print("JSON parsed successfully.\n")

    print(
        "Product:",
        result.get("product_name")
    )

    print(
        "Brand:",
        result.get("brand")
    )

    print(
        "Manufacturer:",
        result.get("manufacturer")
    )

    print(
        "MRP:",
        result.get("mrp")
    )

    print(
        "Net Quantity:",
        result.get("net_quantity")
    )

    print(
        "Manufacturing Date:",
        result.get("manufacturing_date")
    )

    print(
        "Expiry Date:",
        result.get("expiry_date")
    )

    print(
        "Batch Number:",
        result.get("batch_number")
    )

    print(
        "License Number:",
        result.get("license_number")
    )

    print(
        "Consumer Care Phone:",
        result.get("consumer_care_phone")
    )

    print(
        "Consumer Care Email:",
        result.get("consumer_care_email")
    )

    print(
        "Unit Sale Price:",
        result.get("unit_sale_price")
    )

except json.JSONDecodeError:

    print(
        "WARNING: Gemini did not return valid JSON."
    )