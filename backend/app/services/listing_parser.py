"""
Reading declarations out of an e-commerce listing.

The label parser expects a photograph. A listing is prose — "MRP Rs. 55.00
inclusive of all taxes" rather than a printed declaration block — so the same
extraction does not apply, and the compatibility text parser, which reads
`field: value` lines, finds almost nothing in it. Left that way the assessment
reported declarations as missing that were plainly in the text, which is the
one kind of error this system exists not to make.

So the listing is read by the same models that read a label, given the text
instead of an image, and held to the same contract: name what is stated, and
return null for what is not. Nothing is inferred from the product category or
from what the seller usually declares.
"""

import json
from typing import Any

from google import genai

from app.core.config import AI_TEMPERATURE, GEMINI_API_KEY
from app.services.ai_provider import call_with_fallback

client = genai.Client(api_key=GEMINI_API_KEY)


PROMPT = """
You are reading an Indian e-commerce product listing for a packaged
commodity, to find the declarations required by the Legal Metrology
(Packaged Commodities) Rules, 2011.

Return only what the listing text itself states.

READ, DO NOT INFER.

Do not supply a manufacturer because you recognise the brand. Do not
supply a country of origin because the product is sold in India. Do not
convert, complete or tidy a value. If the listing does not state
something, return null for it — null is a correct answer, and a listing
that omits a required declaration is exactly what this assessment is
looking for.

Return ONLY valid JSON in this structure:

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
    "batch_number": null,
    "license_number": null,
    "consumer_care_phone": null,
    "consumer_care_email": null,
    "country_of_origin": null,
    "unit_sale_price": null,
    "other_dates": [],
    "other_declarations": []
}

Notes on individual fields:

MRP is the maximum retail price. A selling price, a discount or a
"deal price" is not the MRP unless the listing says so.

NET QUANTITY is the declared quantity of the commodity: 225 g, 1 L,
500 ml. A pack count on its own is not a net quantity.

CONSUMER CARE is a phone number or email address offered for consumer
complaints, not a seller's general support link.

Listing text follows.
"""


def parse_listing_text(text: str) -> dict[str, Any]:
    """
    The declarations a listing states, or nulls where it states none.

    Raises whatever the provider cascade raises when no model answers; the
    caller decides what to tell the user, because a listing assessment that
    silently returned empty fields would report every declaration missing.
    """

    def read_with(model: str) -> dict[str, Any]:
        response = client.models.generate_content(
            model=model,
            contents=[PROMPT, text],
            config={
                "response_mime_type": "application/json",
                # Reading, not composing. The same reason the label parser
                # runs at zero: a listing should not read differently twice.
                "temperature": AI_TEMPERATURE,
            },
        )

        if not response.text:
            raise ValueError("The model returned an empty response.")

        parsed = json.loads(response.text)

        if not isinstance(parsed, dict):
            raise ValueError("Model response was not a JSON object.")

        # Kept so a finding can be checked against what was read.
        parsed["raw_ocr_text"] = text

        return parsed

    product, _model = call_with_fallback(read_with, label="Listing")

    return product
