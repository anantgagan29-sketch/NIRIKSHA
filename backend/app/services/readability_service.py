import os
import json
import time

from dotenv import load_dotenv
from google import genai
from PIL import Image


# ============================================================
# CONFIGURATION
# ============================================================

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY is not set in the .env file."
    )


client = genai.Client(
    api_key=GEMINI_API_KEY
)


# ============================================================
# GEMINI MODELS
# ============================================================

from app.core.config import GEMINI_MODELS as CONFIGURED_MODELS

from app.services.ai_provider import call_with_fallback

MODELS = CONFIGURED_MODELS


# ============================================================
# READABILITY FIELDS
# ============================================================

READABILITY_FIELDS = [
    "product_name",
    "net_quantity",
    "mrp",
    "unit_sale_price",
    "batch_number",
    "manufacturing_date",
    "expiry_or_use_by",
    "manufacturer_or_packer",
    "consumer_care",
    "country_of_origin"
]


# ============================================================
# CLEAN GEMINI JSON RESPONSE
# ============================================================

def clean_gemini_json(raw_text):
    """
    Clean common formatting problems from Gemini's JSON output.

    Gemini can occasionally return:
    - Markdown code fences
    - Raw control characters
    - Newline characters inside JSON strings

    This function cleans those issues before json.loads().
    """

    if not raw_text:
        raise RuntimeError(
            "Gemini returned an empty readability response."
        )

    text = raw_text.strip()

    # --------------------------------------------------------
    # Remove Markdown code fences
    # --------------------------------------------------------

    if text.startswith("```json"):
        text = text[len("```json"):].strip()

    elif text.startswith("```"):
        text = text[len("```"):].strip()

    if text.endswith("```"):
        text = text[:-3].strip()

    # --------------------------------------------------------
    # Extract the JSON object if Gemini added extra text
    # around it.
    # --------------------------------------------------------

    first_brace = text.find("{")
    last_brace = text.rfind("}")

    if first_brace != -1 and last_brace != -1:
        text = text[
            first_brace:last_brace + 1
        ]

    # --------------------------------------------------------
    # Remove/replace illegal control characters.
    #
    # We keep normal JSON whitespace outside strings.
    # Inside strings, control characters are replaced with
    # a normal space.
    # --------------------------------------------------------

    cleaned = []

    inside_string = False
    escaped = False

    for char in text:

        # Handle escaped characters
        if escaped:

            cleaned.append(char)
            escaped = False

            continue

        if char == "\\" and inside_string:

            cleaned.append(char)
            escaped = True

            continue

        if char == '"':

            cleaned.append(char)
            inside_string = not inside_string

            continue

        # ASCII control characters
        if ord(char) < 32:

            if inside_string:
                cleaned.append(" ")

            else:

                # Keep JSON whitespace outside strings
                if char in [
                    "\n",
                    "\r",
                    "\t"
                ]:
                    cleaned.append(char)

            continue

        cleaned.append(char)

    return "".join(cleaned)


# ============================================================
# NORMALIZE RESULT
# ============================================================

def normalize_readability_result(result):
    """
    Make sure Gemini always returns the expected structure.
    """

    if not isinstance(result, dict):
        result = {}

    overall = result.get(
        "overall_status",
        "NOT_DETERMINED"
    )

    if overall not in [
        "CLEAR",
        "REVIEW",
        "NOT_DETERMINED"
    ]:
        overall = "NOT_DETERMINED"

    fields = result.get(
        "fields",
        {}
    )

    if not isinstance(fields, dict):
        fields = {}

    normalized_fields = {}

    for field in READABILITY_FIELDS:

        item = fields.get(
            field,
            {}
        )

        if not isinstance(item, dict):
            item = {}

        status = item.get(
            "status",
            "NOT_DETERMINED"
        )

        if status not in [
            "CLEAR",
            "SMALL",
            "UNCLEAR",
            "NOT_DETERMINED"
        ]:
            status = "NOT_DETERMINED"

        confidence = item.get(
            "confidence",
            0
        )

        try:
            confidence = float(
                confidence
            )
        except (
            ValueError,
            TypeError
        ):
            confidence = 0

        confidence = max(
            0,
            min(
                1,
                confidence
            )
        )

        bbox = item.get(
            "bounding_box"
        )

        if (
            isinstance(bbox, list)
            and len(bbox) == 4
        ):

            try:

                bbox = [
                    float(x)
                    for x in bbox
                ]

            except (
                ValueError,
                TypeError
            ):

                bbox = None

        else:

            bbox = None

        normalized_fields[field] = {
            "status": status,
            "confidence": round(
                confidence,
                2
            ),
            "bounding_box": bbox,
            "reason": str(
                item.get(
                    "reason",
                    ""
                )
            ).strip()
        }

    return {
        "overall_status": overall,

        "fields": normalized_fields,

        "physical_font_size": {
            "status": "NOT_DETERMINED",
            "message": (
                "Physical font height in millimetres "
                "cannot be determined from the supplied "
                "photograph without a known physical scale."
            )
        },

        "note": str(
            result.get(
                "note",
                ""
            )
        ).strip()
    }


# ============================================================
# GEMINI READABILITY ANALYSIS
# ============================================================

def analyze_readability_with_gemini(
    image,
    model
):
    """
    Ask Gemini Vision to inspect the actual product image.

    This performs visual readability screening.
    It does NOT claim legal font-size compliance.
    """

    prompt = """
You are analyzing a photograph of a packaged commodity
for an AI-assisted Legal Metrology inspection system.

Inspect the ACTUAL IMAGE carefully.

Evaluate the visual readability of important declarations
printed on the package.

The purpose is to identify text that appears:
- CLEAR and reasonably readable
- SMALL but still readable
- UNCLEAR or difficult to read

IMPORTANT RULES:

1. Use the actual image, not assumptions from OCR.
2. Do NOT claim that a declaration is legally compliant
   merely because it is readable.
3. Do NOT estimate physical font height in millimetres.
4. A photograph has no reliable physical scale unless a
   reference object is provided.
5. If a declaration is not visible or cannot be confidently
   located, return NOT_DETERMINED.
6. Do not invent text that is not visible.
7. Bounding boxes must be approximate and normalized to
   values from 0 to 1000.
8. Bounding box format:
   [x1, y1, x2, y2]
9. Confidence must be between 0 and 1.
10. Keep every reason and note as a single short sentence.
11. Do not use newline characters inside string values.

Analyze these fields:

- product_name
- net_quantity
- mrp
- unit_sale_price
- batch_number
- manufacturing_date
- expiry_or_use_by
- manufacturer_or_packer
- consumer_care
- country_of_origin

For each field return:

status:
CLEAR | SMALL | UNCLEAR | NOT_DETERMINED

confidence:
0 to 1

bounding_box:
[x1, y1, x2, y2]
or null

reason:
short explanation

Overall status should be:

CLEAR
if the important declarations are visually readable.

REVIEW
if one or more important declarations appear
very small, unclear, partially obscured, blurred, or
otherwise difficult to inspect.

NOT_DETERMINED
if the image quality is insufficient to make a useful
visual assessment.

Return ONLY valid JSON.

Required JSON structure:

{
  "overall_status": "CLEAR",
  "fields": {
    "product_name": {
      "status": "CLEAR",
      "confidence": 0.95,
      "bounding_box": [0, 0, 0, 0],
      "reason": "Short explanation"
    }
  },
  "note": "Short explanation"
}
"""

    response = client.models.generate_content(
        model=model,
        contents=[
            prompt,
            image
        ],
        config={
            "response_mime_type": "application/json"
        }
    )

    raw_text = response.text

    cleaned_text = clean_gemini_json(
        raw_text
    )

    try:

        parsed = json.loads(
            cleaned_text
        )

    except json.JSONDecodeError as e:

        # Show useful information if Gemini still
        # produces malformed JSON.
        preview = cleaned_text[:1000]

        raise RuntimeError(
            "Gemini returned invalid JSON: "
            + str(e)
            + "\nResponse preview:\n"
            + preview
        )

    return normalize_readability_result(
        parsed
    )


# ============================================================
# MAIN FUNCTION
# ============================================================

def analyze_product_readability(
    image_path
):
    """
    Analyze visual readability of a packaged product image.

    Returns an AI-assisted readability screening result.
    """

    if not os.path.exists(
        image_path
    ):
        raise FileNotFoundError(
            f"Image not found: {image_path}"
        )

    # --------------------------------------------------------
    # Open image
    # --------------------------------------------------------

    try:

        image = Image.open(
            image_path
        )

        image.load()

    except Exception as e:

        raise RuntimeError(
            f"Unable to open product image: {e}"
        )

    # --------------------------------------------------------
    # Ask a model
    # --------------------------------------------------------
    #
    # The same availability tracker the declaration pass uses, so a model
    # that has already run out of quota is not asked again here.

    result, _model = call_with_fallback(
        lambda model: analyze_readability_with_gemini(image, model),
        transient_retries=1,
        retry_delay=0.8,
        label="Readability",
    )

    return result