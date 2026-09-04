"""
Barcode lookup.

There is no product database behind NIRIKSHA, and this endpoint does not
pretend otherwise. Returning an invented product name for a scanned barcode
would be worse than returning nothing: it would put a name on the screen that
nobody had verified, next to a compliance assessment that people are meant to
trust.

So it reports what can actually be established from the number itself:

  * whether the code is structurally valid, by its GS1 check digit;
  * which numbering organisation issued the prefix, which is published
    reference data, not a guess about the product.

If a product database is connected later, `found` becomes true and the name
comes from that source. Until then the honest answer is that the code is
valid, the prefix is Indian, and the product is unknown — and the inspection
carries on from the packaging, which is where the answer actually lives.
"""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class BarcodeRequest(BaseModel):
    barcode: str


# GS1 prefix ranges, from the published allocation table. These identify the
# member organisation that issued the number — which is where the company
# registered, not necessarily where the product was made.
GS1_PREFIXES = [
    (0, 19, "the United States or Canada"),
    (30, 39, "the United States"),
    (300, 379, "France or Monaco"),
    (380, 380, "Bulgaria"),
    (383, 383, "Slovenia"),
    (385, 385, "Croatia"),
    (387, 387, "Bosnia and Herzegovina"),
    (400, 440, "Germany"),
    (450, 459, "Japan"),
    (460, 469, "Russia"),
    (471, 471, "Taiwan"),
    (480, 480, "the Philippines"),
    (489, 489, "Hong Kong"),
    (490, 499, "Japan"),
    (500, 509, "the United Kingdom"),
    (520, 521, "Greece"),
    (528, 528, "Lebanon"),
    (539, 539, "Ireland"),
    (540, 549, "Belgium or Luxembourg"),
    (560, 560, "Portugal"),
    (569, 569, "Iceland"),
    (570, 579, "Denmark"),
    (590, 590, "Poland"),
    (594, 594, "Romania"),
    (599, 599, "Hungary"),
    (600, 601, "South Africa"),
    (611, 611, "Morocco"),
    (619, 619, "Tunisia"),
    (625, 625, "Jordan"),
    (628, 628, "Saudi Arabia"),
    (629, 629, "the United Arab Emirates"),
    (640, 649, "Finland"),
    (690, 699, "China"),
    (700, 709, "Norway"),
    (729, 729, "Israel"),
    (730, 739, "Sweden"),
    (750, 750, "Mexico"),
    (759, 759, "Venezuela"),
    (760, 769, "Switzerland"),
    (770, 771, "Colombia"),
    (773, 773, "Uruguay"),
    (775, 775, "Peru"),
    (777, 777, "Bolivia"),
    (779, 779, "Argentina"),
    (780, 780, "Chile"),
    (784, 784, "Paraguay"),
    (786, 786, "Ecuador"),
    (789, 790, "Brazil"),
    (800, 839, "Italy"),
    (840, 849, "Spain"),
    (850, 850, "Cuba"),
    (858, 858, "Slovakia"),
    (859, 859, "Czechia"),
    (860, 860, "Serbia"),
    (867, 867, "North Korea"),
    (868, 869, "Turkey"),
    (870, 879, "the Netherlands"),
    (880, 880, "South Korea"),
    (884, 884, "Cambodia"),
    (885, 885, "Thailand"),
    (888, 888, "Singapore"),
    (890, 890, "India"),
    (893, 893, "Vietnam"),
    (896, 896, "Pakistan"),
    (899, 899, "Indonesia"),
    (900, 919, "Austria"),
    (930, 939, "Australia"),
    (940, 949, "New Zealand"),
    (955, 955, "Malaysia"),
    (958, 958, "Macau"),
]


def gs1_check_digit(digits: str) -> int:
    """
    The GS1 modulo-10 check digit used by EAN-13, EAN-8, UPC-A and ITF-14.

    Digits are weighted alternately from the right; the check digit is what
    carries the total to the next multiple of ten.
    """

    total = 0

    for index, character in enumerate(reversed(digits)):
        digit = int(character)
        total += digit * 3 if index % 2 == 0 else digit

    return (10 - (total % 10)) % 10


def issuing_region(barcode: str) -> str | None:
    """Which GS1 member organisation issued this prefix, if it is a known one."""

    if len(barcode) < 8 or not barcode.isdigit():
        return None

    # EAN-13 prefixes are three digits. A 12-digit UPC-A is an EAN-13 with a
    # leading zero, so padding to 13 lets both be read the same way — and the
    # ranges below are already expressed as three-digit values, so "030" and
    # 30 are the same number.
    padded = barcode.zfill(13)

    try:
        prefix = int(padded[:3])
    except ValueError:
        return None

    for low, high, region in GS1_PREFIXES:
        if low <= prefix <= high:
            return region

    return None


@router.post("/barcode/lookup")
def lookup(request: BarcodeRequest) -> dict:
    """
    Reports what is genuinely known about a scanned barcode.

    Never fails the caller: an unknown or malformed code still returns 200
    with `found` false, because a barcode that cannot be identified must not
    stop someone from inspecting the packaging in front of them.
    """

    code = (request.barcode or "").strip()

    if not code:
        return {
            "barcode": code,
            "valid": False,
            "found": False,
            "message": "No barcode was supplied.",
        }

    numeric = code.isdigit()

    valid = True
    reason = None

    # Only the numeric retail symbologies carry a check digit. Code 128 and
    # Code 39 are alphanumeric and have nothing further to verify, so they are
    # reported as-is rather than being called validated.
    if numeric and len(code) in (8, 12, 13, 14):
        valid = gs1_check_digit(code[:-1]) == int(code[-1])

        if not valid:
            reason = "The check digit does not match, so this code was misread or mistyped."

    return {
        "barcode": code,
        "valid": valid,
        "reason": reason,
        "issuing_region": issuing_region(code) if numeric else None,

        # No product database is connected. Reporting `found` false is the
        # honest answer; inventing a product name here would put unverified
        # information beside a compliance assessment.
        "found": False,
        "product_name": None,
        "source": None,
        "message": (
            "This build holds no product database, so the barcode is recorded "
            "but not resolved to a product. Compliance is assessed from the "
            "packaging in the next step."
        ),
    }
