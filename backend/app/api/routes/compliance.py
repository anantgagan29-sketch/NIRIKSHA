from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import re

from app.services.date_normalizer import normalise_product_dates


router = APIRouter()


# ============================================================
# REQUEST MODEL
# ============================================================

def derive_end_date(shelf_life, reference):
    """
    Turns "6 months from PKD" plus a packing date into an end date.

    Returns None when the reference date is missing or states only a year —
    a derived date is only reported when it can be derived honestly.
    """

    if not shelf_life or not reference or not reference.year:
        return None

    if reference.precision == "year":
        return None

    month = (reference.month or 1) - 1 + _months_in(shelf_life)
    year = reference.year + month // 12
    month = month % 12 + 1

    if reference.precision == "day" and reference.day:
        day = min(reference.day, _days_in_month(year, month))
        return f"{day:02d}/{month:02d}/{year:04d}"

    return f"{month:02d}/{year:04d}"


def _months_in(shelf_life) -> int:
    """Approximates a shelf life in whole months for date arithmetic."""

    unit = shelf_life.unit

    if unit in ("year", "years"):
        return shelf_life.amount * 12

    if unit in ("month", "months"):
        return shelf_life.amount

    return max(1, round(shelf_life.approx_days / 30))


def _days_in_month(year: int, month: int) -> int:
    import calendar
    return calendar.monthrange(year, month)[1]


class ComplianceRequest(BaseModel):
    extracted_text: str = ""
    product_info: Optional[dict] = None
    readability_result: Optional[dict] = None


# ============================================================
# RULE INFORMATION
# ============================================================

RULE_SET = (
    "Legal Metrology (Packaged Commodities) Rules, 2011 "
    "and applicable amendments"
)


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def clean_value(value):
    """
    Convert a value into a clean string when possible.
    """

    if value is None:
        return ""

    if isinstance(value, str):
        return value.strip()

    return str(value).strip()


def contains_any(
    text: str,
    keywords: list[str]
) -> bool:
    """
    Check whether any keyword exists in text.
    """

    text = (text or "").lower()

    return any(
        keyword.lower() in text
        for keyword in keywords
    )


def make_check(
    status: str,
    value,
    message: str,
    rule: str,
    severity: str = "INFO"
) -> dict:
    """
    Standard structure for every compliance check.
    """

    return {
        "status": status,
        "value": value,
        "message": message,
        "rule": rule,
        "severity": severity
    }


def parse_money(value):
    """
    Extract a numeric money value from strings such as:

    ₹450.00
    Rs. 450
    MRP 450
    """

    if not value:
        return None

    match = re.search(
        r"(?<!\d)(\d+(?:\.\d{1,2})?)(?!\d)",
        str(value).replace(",", "")
    )

    if not match:
        return None

    try:
        return float(match.group(1))
    except ValueError:
        return None


def quantity_to_grams(
    amount: float,
    unit: str
):
    """
    Convert a quantity amount/unit pair into grams.
    """

    unit = unit.lower()

    if unit == "kg":
        return amount * 1000

    if unit in [
        "mg",
        "milligram",
        "milligrams"
    ]:
        return amount / 1000

    return amount


def parse_quantity_grams(value):
    """
    Convert common weight declarations into grams.

    Examples:
    500 g  -> 500
    0.5 kg -> 500
    250 mg -> 0.25

    Returns None when the quantity cannot be reliably parsed.
    """

    if not value:
        return None

    text = str(value).lower().replace(",", "").strip()

    match = re.search(
        r"(\d+(?:\.\d+)?)\s*(kg|g|gm|gram|grams|mg|milligram|milligrams)",
        text
    )

    if not match:
        return None

    amount = float(match.group(1))
    unit = match.group(2)

    return quantity_to_grams(
        amount,
        unit
    )


def parse_paid_quantity_grams(value):
    """
    Determine the quantity that should be used for unit-sale-price
    calculation.

    Handles declarations such as:

        225g (200g + 25g)
        225g (200g + 25g)+
        225g (200g + 25g FREE)
        225g (200g + 25g FREE)+
        200g + 25g FREE

    For a verified split declaration:

        total quantity = paid quantity + additional quantity

    the paid quantity is used for unit-sale-price calculation.

    Example:

        225g (200g + 25g)
        MRP = ₹55

        paid quantity = 200g

        ₹55 / 200g = ₹0.275/g
        rounded = ₹0.28/g

    Returns:

        (
            paid_quantity_grams,
            free_quantity_grams,
            free_quantity_detected
        )
    """

    if not value:
        return None, None, False

    text = (
        str(value)
        .lower()
        .replace(",", "")
        .strip()
    )

    # --------------------------------------------------------
    # NORMALIZE COMMON GEMINI/OCR ARTIFACTS
    # --------------------------------------------------------

    # Remove harmless trailing plus signs.
    #
    # Example:
    # 225 g (200 g + 25 g )+
    #
    # becomes:
    # 225 g (200 g + 25 g )
    #
    text = re.sub(
        r"\s*\+\s*$",
        "",
        text
    ).strip()

    # Normalize repeated whitespace.
    text = re.sub(
        r"\s+",
        " ",
        text
    ).strip()


    unit_pattern = (
        r"(kg|g|gm|gram|grams|mg|milligram|milligrams)"
    )

    number_pattern = r"(\d+(?:\.\d+)?)"


    # --------------------------------------------------------
    # CASE 1:
    #
    # 225g (200g + 25g)
    # 225g (200g + 25g FREE)
    #
    # The word FREE is optional because Gemini may miss it.
    #
    # We still verify:
    #
    # total = paid + additional quantity
    #
    # before treating the second quantity as additional/free.
    # --------------------------------------------------------

    split_pattern = (
        r"^\s*"
        + number_pattern
        + r"\s*" + unit_pattern
        + r"\s*\(\s*"
        + number_pattern
        + r"\s*" + unit_pattern
        + r"\s*\+\s*"
        + number_pattern
        + r"\s*" + unit_pattern
        + r"\s*(?:"
        + r"free"
        + r"|complimentary"
        + r"|additional\s+free"
        + r")?"
        + r"\s*\)\s*$"
    )

    split_match = re.match(
        split_pattern,
        text,
        re.IGNORECASE
    )

    if split_match:

        total_amount = float(
            split_match.group(1)
        )

        total_unit = split_match.group(2)

        paid_amount = float(
            split_match.group(3)
        )

        paid_unit = split_match.group(4)

        free_amount = float(
            split_match.group(5)
        )

        free_unit = split_match.group(6)

        total_grams = quantity_to_grams(
            total_amount,
            total_unit
        )

        paid_grams = quantity_to_grams(
            paid_amount,
            paid_unit
        )

        free_grams = quantity_to_grams(
            free_amount,
            free_unit
        )

        # Verify that the quantities mathematically agree.
        if abs(
            total_grams
            - (paid_grams + free_grams)
        ) <= 0.01:

            return (
                paid_grams,
                free_grams,
                True
            )


    # --------------------------------------------------------
    # CASE 2:
    #
    # 200g + 25g FREE
    # 200 g + 25 g FREE
    # --------------------------------------------------------

    free_pattern = (
        r"^\s*"
        + number_pattern
        + r"\s*" + unit_pattern
        + r"\s*\+\s*"
        + number_pattern
        + r"\s*" + unit_pattern
        + r"\s*(?:"
        + r"free"
        + r"|complimentary"
        + r"|additional\s+free"
        + r")"
        + r"\s*$"
    )

    free_match = re.match(
        free_pattern,
        text,
        re.IGNORECASE
    )

    if free_match:

        paid_amount = float(
            free_match.group(1)
        )

        paid_unit = free_match.group(2)

        free_amount = float(
            free_match.group(3)
        )

        free_unit = free_match.group(4)

        paid_grams = quantity_to_grams(
            paid_amount,
            paid_unit
        )

        free_grams = quantity_to_grams(
            free_amount,
            free_unit
        )

        return (
            paid_grams,
            free_grams,
            True
        )


    # --------------------------------------------------------
    # CASE 3:
    #
    # Longer declaration containing:
    #
    # 200g + 25g FREE
    #
    # Search instead of requiring an exact match.
    # --------------------------------------------------------

    free_search_pattern = (
        number_pattern
        + r"\s*" + unit_pattern
        + r"\s*\+\s*"
        + number_pattern
        + r"\s*" + unit_pattern
        + r"\s*(?:"
        + r"free"
        + r"|complimentary"
        + r"|additional\s+free"
        + r")"
    )

    free_search = re.search(
        free_search_pattern,
        text,
        re.IGNORECASE
    )

    if free_search:

        paid_amount = float(
            free_search.group(1)
        )

        paid_unit = free_search.group(2)

        free_amount = float(
            free_search.group(3)
        )

        free_unit = free_search.group(4)

        paid_grams = quantity_to_grams(
            paid_amount,
            paid_unit
        )

        free_grams = quantity_to_grams(
            free_amount,
            free_unit
        )

        return (
            paid_grams,
            free_grams,
            True
        )


    # --------------------------------------------------------
    # CASE 4:
    #
    # Generic split declaration without parentheses.
    #
    # Example:
    #
    # 225g 200g + 25g
    #
    # Only use it when the total equals paid + additional.
    # --------------------------------------------------------

    loose_split_pattern = (
        number_pattern
        + r"\s*" + unit_pattern
        + r".{0,20}?"
        + number_pattern
        + r"\s*" + unit_pattern
        + r"\s*\+\s*"
        + number_pattern
        + r"\s*" + unit_pattern
    )

    loose_match = re.search(
        loose_split_pattern,
        text,
        re.IGNORECASE
    )

    if loose_match:

        total_amount = float(
            loose_match.group(1)
        )

        total_unit = loose_match.group(2)

        paid_amount = float(
            loose_match.group(3)
        )

        paid_unit = loose_match.group(4)

        free_amount = float(
            loose_match.group(5)
        )

        free_unit = loose_match.group(6)

        total_grams = quantity_to_grams(
            total_amount,
            total_unit
        )

        paid_grams = quantity_to_grams(
            paid_amount,
            paid_unit
        )

        free_grams = quantity_to_grams(
            free_amount,
            free_unit
        )

        if abs(
            total_grams
            - (paid_grams + free_grams)
        ) <= 0.01:

            return (
                paid_grams,
                free_grams,
                True
            )


    # --------------------------------------------------------
    # NORMAL CASE
    #
    # 225g
    # 500g
    # 1kg
    #
    # No split/free quantity detected.
    # --------------------------------------------------------

    normal_quantity = parse_quantity_grams(
        text
    )

    return (
        normal_quantity,
        None,
        False
    )


def parse_unit_price(value):
    """
    Extract the numeric unit-sale-price value.

    Example:
    ₹ 0.90 per g -> 0.90
    """

    if not value:
        return None

    return parse_money(value)


def extract_phone(text):
    """
    Detect a plausible Indian/general consumer-care phone number.
    """

    if not text:
        return None

    match = re.search(
        r"(?:\+91[\s-]?)?[6-9]\d{9}\b",
        text
    )

    if match:
        return match.group(0)

    match = re.search(
        r"\b\d{7,15}\b",
        text
    )

    if match:
        return match.group(0)

    return None


def extract_email(text):
    """
    Detect an email address.
    """

    if not text:
        return None

    match = re.search(
        r"\b[A-Za-z0-9._%+-]+"
        r"@[A-Za-z0-9.-]+\."
        r"[A-Za-z]{2,}\b",
        text
    )

    if match:
        return match.group(0)

    return None


# ============================================================
# MAIN COMPLIANCE CHECKER
# ============================================================

def small_package_quantity(value):
    """
    Reads a net quantity for the Rule 26(a) threshold, in grams or millilitres.

    Returns (amount, unit) where unit is "g" or "ml", or None when the
    quantity cannot be read. Weight and volume share the same numeric
    threshold of ten, so they are compared the same way.
    """

    if not value:
        return None

    text = str(value).lower().replace(",", "").strip()

    match = re.search(
        r"(\d+(?:\.\d+)?)\s*(kg|g|gm|gram|grams|mg|ml|millilitre|millilitres|milliliter|milliliters|l|litre|litres|liter|liters)\b",
        text
    )

    if not match:
        return None

    amount = float(match.group(1))
    unit = match.group(2)

    if unit in ("kg",):
        return amount * 1000, "g"
    if unit in ("mg",):
        return amount / 1000, "g"
    if unit in ("g", "gm", "gram", "grams"):
        return amount, "g"
    if unit in ("l", "litre", "litres", "liter", "liters"):
        return amount * 1000, "ml"

    return amount, "ml"


def check_compliance(
    data: ComplianceRequest
) -> dict:

    text = data.extracted_text or ""

    product_info = (
        data.product_info
        or {}
    )

    readability_result = (
        data.readability_result
        or {}
    )

    checks = {}

    violations = []

    warnings = []

    recommendations = []


    # ========================================================
    # 1. MANUFACTURER / PACKER / IMPORTER
    # ========================================================

    manufacturer = clean_value(
        product_info.get("manufacturer")
    )

    packer = clean_value(
        product_info.get("packer")
    )

    importer = clean_value(
        product_info.get("importer")
    )


    if manufacturer or packer or importer:

        checks["manufacturer_or_packer"] = make_check(
            "PASS",
            {
                "manufacturer": manufacturer or None,
                "packer": packer or None,
                "importer": importer or None
            },
            "Manufacturer/packer/importer information detected.",
            "Rule 6(1)(a) - name and address of manufacturer, packer or importer",
            "INFO"
        )

    else:

        declaration_found = contains_any(
            text,
            [
                "manufactured by",
                "manufactured & marketed by",
                "manufactured and marketed by",
                "manufactured for",
                "mfd by",
                "mfg by",
                "packer",
                "packed by",
                "packaged by",
                "marketed by",
                "imported by",
                "importer"
            ]
        )

        if declaration_found:

            checks["manufacturer_or_packer"] = make_check(
                "PASS",
                True,
                "Manufacturer/packer/importer declaration detected in label text.",
                "Rule 6(1)(a) - name and address of manufacturer, packer or importer",
                "INFO"
            )

        else:

            checks["manufacturer_or_packer"] = make_check(
                "FAIL",
                False,
                "Manufacturer/packer/importer information was not detected.",
                "Rule 6(1)(a) - name and address of manufacturer, packer or importer",
                "HIGH"
            )

            violations.append(
                "Manufacturer/packer/importer declaration not detected."
            )


    # ========================================================
    # 2. COMMON / GENERIC PRODUCT NAME
    # ========================================================

    product_name = clean_value(
        product_info.get("product_name")
    )


    if product_name:

        checks["generic_product_name"] = make_check(
            "PASS",
            product_name,
            "Common/generic product name detected.",
            "Rule 6(1)(b) - common or generic name of the commodity",
            "INFO"
        )

    else:

        checks["generic_product_name"] = make_check(
            "FAIL",
            None,
            "Common/generic product name was not detected.",
            "Rule 6(1)(b) - common or generic name of the commodity",
            "HIGH"
        )

        violations.append(
            "Common/generic product name not detected."
        )


    # ========================================================
    # 3. NET QUANTITY
    # ========================================================

    net_quantity = clean_value(
        product_info.get("net_quantity")
    )


    if net_quantity:

        checks["net_quantity"] = make_check(
            "PASS",
            net_quantity,
            "Net quantity detected.",
            "Rule 6(1)(c) - net quantity declaration",
            "INFO"
        )

    else:

        checks["net_quantity"] = make_check(
            "FAIL",
            None,
            "Net quantity was not detected.",
            "Rule 6(1)(c) - net quantity declaration",
            "HIGH"
        )

        violations.append(
            "Net quantity declaration not detected."
        )


    # ========================================================
    # 4. MRP
    # ========================================================

    mrp = clean_value(
        product_info.get("mrp")
    )

    mrp_value = parse_money(mrp)


    if mrp and mrp_value is not None:

        checks["mrp"] = make_check(
            "PASS",
            mrp,
            "Maximum Retail Price detected.",
            "Rule 6(1)(e) - retail sale price",
            "INFO"
        )

    elif mrp:

        checks["mrp"] = make_check(
            "WARNING",
            mrp,
            "MRP text was detected but the numeric value could not be reliably validated.",
            "Rule 6(1)(e) - retail sale price",
            "MEDIUM"
        )

        warnings.append(
            "MRP detected but numeric validation could not be completed."
        )

    else:

        checks["mrp"] = make_check(
            "FAIL",
            None,
            "Maximum Retail Price was not detected.",
            "Rule 6(1)(e) - retail sale price",
            "HIGH"
        )

        violations.append(
            "MRP declaration not detected."
        )


    # ========================================================
    # 5. CONSUMER CARE DETAILS
    # ========================================================

    consumer_phone = clean_value(
        product_info.get("consumer_care_phone")
    )

    consumer_email = clean_value(
        product_info.get("consumer_care_email")
    )

    phone_found = bool(
        consumer_phone
    )

    email_found = bool(
        consumer_email
    )


    # --------------------------------------------------------
    # Fallback extraction from text
    # --------------------------------------------------------

    if not phone_found:

        fallback_phone = extract_phone(text)

        if fallback_phone:
            phone_found = True


    if not email_found:

        fallback_email = extract_email(text)

        if fallback_email:
            email_found = True


    # --------------------------------------------------------
    # Consumer-care label detection
    # --------------------------------------------------------

    consumer_label_found = contains_any(
        text,
        [
            "consumer care",
            "consumer complaint",
            "customer care",
            "customer service",
            "contact customer care",
            "contact us",
            "helpline",
            "toll free",
            "customer care cell",
            "care cell",
            "email",
            "e-mail",
            "phone"
        ]
    )


    if phone_found or email_found:
        consumer_label_found = True


    if (
        phone_found
        or email_found
        or consumer_label_found
    ):

        checks["consumer_care_details"] = make_check(
            "PASS",
            {
                "phone": phone_found,
                "email": email_found,
                "label_detected": consumer_label_found
            },
            "Consumer complaint/contact information detected.",
            "Rule 6(2) - consumer care contact details",
            "INFO"
        )

    else:

        checks["consumer_care_details"] = make_check(
            "FAIL",
            {
                "phone": False,
                "email": False,
                "label_detected": False
            },
            "Consumer complaint/contact details were not detected.",
            "Rule 6(2) - consumer care contact details",
            "HIGH"
        )

        violations.append(
            "Consumer complaint/contact details not detected."
        )


    # ========================================================
    # 6. MANUFACTURING / PACKING DATE
    # ========================================================
    #
    # Rule 6(1)(d) asks for the month and year of manufacture, pre-packing or
    # import. A packing date therefore satisfies the declaration on its own —
    # a pack marked only "PKD 12/08/26" is compliant, and failing it because
    # the words "Manufacturing Date" are absent would be wrong.
    #
    # Labels are classified by date_normalizer rather than by matching the
    # field the vision model happened to use, so MFG/MFD/PKD/"Packed On"/
    # "Date of Packing" all land in the right declaration.

    dates = normalise_product_dates(product_info)

    date_value = None
    date_message = None

    if dates.manufacturing_date and dates.packing_date:
        date_value = (
            f"{dates.manufacturing_date.original} / {dates.packing_date.original}"
        )
        date_message = "Manufacturing and packing dates detected."

    elif dates.manufacturing_date:
        date_value = dates.manufacturing_date.original
        date_message = "Manufacturing date detected."

    elif dates.packing_date:
        date_value = dates.packing_date.original
        date_message = (
            "Packing date detected. Rule 6(1)(d) is satisfied by a "
            "pre-packing date; a separate manufacturing date is not required."
        )


    if date_value:

        checks["manufacturing_date"] = make_check(
            "PASS",
            date_value,
            date_message,
            "Rule 6(1)(d) - date of manufacture, pre-packing or import",
            "INFO"
        )

    elif dates.unparsed:

        # A date label was printed but its value could not be read. That is an
        # image or legibility problem, not a proven missing declaration, so it
        # goes to review rather than becoming a failure.

        checks["manufacturing_date"] = make_check(
            "NOT_DETERMINED",
            ", ".join(dates.unparsed),
            "A date declaration was found but could not be read reliably. "
            "Manual verification required.",
            "Rule 6(1)(d) - date of manufacture, pre-packing or import",
            "MEDIUM"
        )

        warnings.append(
            "A date declaration was detected but could not be read; verify manually."
        )

    else:

        checks["manufacturing_date"] = make_check(
            "FAIL",
            None,
            "No date of manufacture, pre-packing or import was detected.",
            "Rule 6(1)(d) - date of manufacture, pre-packing or import",
            "HIGH"
        )

        violations.append(
            "Date of manufacture/pre-packing not detected."
        )


    # ========================================================
    # 7. EXPIRY / BEST BEFORE / SHELF LIFE
    # ========================================================
    #
    # Rule 6(1)(da) requires a best-before declaration for commodities where
    # it applies, and the declaration is validly made either as a date or as a
    # duration ("Best Before 6 Months from PKD"). Both forms are accepted.
    #
    # Absence stays NOT_DETERMINED rather than FAIL, because applicability is
    # commodity-dependent and this checker does not identify the commodity.

    if dates.expiry_date:

        checks["best_before_or_use_by"] = make_check(
            "DETECTED",
            dates.expiry_date.original,
            "Expiry/use-by date detected.",
            "Rule 6(1)(da) - best before / use by",
            "INFO"
        )

    elif dates.best_before_date:

        checks["best_before_or_use_by"] = make_check(
            "DETECTED",
            dates.best_before_date.original,
            "Best-before date detected.",
            "Rule 6(1)(da) - best before / use by",
            "INFO"
        )

    elif dates.shelf_life:

        # A duration is a valid declaration. When the pack also carries the
        # date it counts from, the resulting date is reported as derived so
        # nobody mistakes it for something printed on the label.

        message = (
            f"Shelf life declared as a duration ({dates.shelf_life.original}). "
            "This satisfies the best-before declaration."
        )

        reference = (
            dates.packing_date
            if dates.shelf_life.reference != "mfg"
            else dates.manufacturing_date
        ) or dates.packing_date or dates.manufacturing_date

        derived = derive_end_date(dates.shelf_life, reference)

        if derived:
            message += f" Derived best-before date: {derived} (calculated, not printed)."

        checks["best_before_or_use_by"] = make_check(
            "DETECTED",
            dates.shelf_life.original,
            message,
            "Rule 6(1)(da) - best before / use by",
            "INFO"
        )

    else:

        checks["best_before_or_use_by"] = make_check(
            "NOT_DETERMINED",
            None,
            "Best-before/use-by/expiry information was not detected. Applicability depends on the commodity.",
            "Rule 6(1)(da) - best before / use by",
            "MEDIUM"
        )

        warnings.append(
            "Best-before/use-by information could not be detected; verify commodity-specific applicability."
        )


    # ========================================================
    # 8. BATCH / LOT NUMBER
    # ========================================================

    batch_number = clean_value(
        product_info.get("batch_number")
    )


    if batch_number:

        checks["batch_number"] = make_check(
            "DETECTED",
            batch_number,
            "Batch/lot information detected.",
            "Commodity/package-dependent declaration",
            "INFO"
        )

    else:

        checks["batch_number"] = make_check(
            "NOT_DETERMINED",
            None,
            "Batch/lot information was not detected. Applicability depends on the commodity.",
            "Commodity/package-dependent declaration",
            "LOW"
        )


    # ========================================================
    # 9. COUNTRY OF ORIGIN
    # ========================================================

    country = clean_value(
        product_info.get("country_of_origin")
    )


    if country:

        checks["country_of_origin"] = make_check(
            "DETECTED",
            country,
            "Country of origin/manufacture detected.",
            "Rule 6(1)(aa) - country of origin (imported packages)",
            "INFO"
        )

    else:

        checks["country_of_origin"] = make_check(
            "NOT_DETERMINED",
            None,
            "Country of origin was not detected. Verify applicability, especially for imported products.",
            "Rule 6(1)(aa) - country of origin (imported packages)",
            "MEDIUM"
        )

        warnings.append(
            "Country of origin was not detected; verify whether the product is imported."
        )


    # ========================================================
    # 10. UNIT SALE PRICE
    # ========================================================

    unit_sale_price = clean_value(
        product_info.get("unit_sale_price")
    )

    unit_price_value = parse_unit_price(
        unit_sale_price
    )


    if unit_sale_price and unit_price_value is not None:

        checks["unit_sale_price"] = make_check(
            "PASS",
            unit_sale_price,
            "Unit sale price detected and available for validation.",
            "Rule 6(11) - unit sale price",
            "INFO"
        )

    elif unit_sale_price:

        checks["unit_sale_price"] = make_check(
            "WARNING",
            unit_sale_price,
            "Unit sale price text was detected but its numeric value could not be reliably validated.",
            "Rule 6(11) - unit sale price",
            "MEDIUM"
        )

        warnings.append(
            "Unit sale price detected but could not be numerically validated."
        )

    else:

        # Rule 6(11) was introduced by amendment and its exact scope and
        # exemptions are not verified against the primary text in this rule
        # pack. An unverified provision is reported for review; it never
        # produces a failure, because that would assert a breach this checker
        # cannot substantiate.
        checks["unit_sale_price"] = make_check(
            "NOT_DETERMINED",
            None,
            "Unit sale price was not detected. The scope of this requirement is "
            "not verified in this rule pack, so applicability to this package "
            "needs confirmation by a person.",
            "Rule 6(11) - unit sale price (scope not verified)",
            "MEDIUM"
        )

        warnings.append(
            "Unit sale price was not detected; confirm whether Rule 6(11) "
            "applies to this package."
        )


    # ========================================================
    # 11. MRP / UNIT PRICE MATHEMATICAL CONSISTENCY
    # ========================================================

    (
        paid_quantity_grams,
        free_quantity_grams,
        free_quantity_detected
    ) = parse_paid_quantity_grams(
        net_quantity
    )


    if (
        mrp_value is not None
        and unit_price_value is not None
        and paid_quantity_grams
        and paid_quantity_grams > 0
    ):

        expected_price_per_gram = (
            mrp_value / paid_quantity_grams
        )

        difference = abs(
            expected_price_per_gram
            - unit_price_value
        )

        tolerance = max(
            0.02,
            expected_price_per_gram * 0.05
        )


        if difference <= tolerance:

            if free_quantity_detected:

                checks["unit_price_consistency"] = make_check(
                    "PASS",
                    {
                        "mrp": mrp_value,
                        "total_net_quantity_grams": (
                            parse_quantity_grams(
                                net_quantity
                            )
                        ),
                        "paid_quantity_grams": (
                            round(
                                paid_quantity_grams,
                                4
                            )
                        ),
                        "free_quantity_grams": (
                            round(
                                free_quantity_grams,
                                4
                            )
                            if free_quantity_grams is not None
                            else None
                        ),
                        "free_quantity_detected": True,
                        "declared_unit_price": unit_price_value,
                        "calculated_unit_price": round(
                            expected_price_per_gram,
                            4
                        ),
                        "difference": round(
                            difference,
                            4
                        )
                    },
                    "Declared unit sale price is mathematically consistent with MRP and the paid quantity. Free/additional quantity was excluded from the unit-price calculation.",
                    "Rule 6(11) - unit sale price",
                    "INFO"
                )

            else:

                checks["unit_price_consistency"] = make_check(
                    "PASS",
                    {
                        "mrp": mrp_value,
                        "net_quantity_grams": paid_quantity_grams,
                        "declared_unit_price": unit_price_value,
                        "calculated_unit_price": round(
                            expected_price_per_gram,
                            4
                        ),
                        "difference": round(
                            difference,
                            4
                        )
                    },
                    "Declared unit sale price is mathematically consistent with MRP and net quantity within the MVP tolerance.",
                    "Rule 6(11) - unit sale price",
                    "INFO"
                )

        else:

            if free_quantity_detected:

                checks["unit_price_consistency"] = make_check(
                    "FAIL",
                    {
                        "mrp": mrp_value,
                        "total_net_quantity_grams": (
                            parse_quantity_grams(
                                net_quantity
                            )
                        ),
                        "paid_quantity_grams": (
                            round(
                                paid_quantity_grams,
                                4
                            )
                        ),
                        "free_quantity_grams": (
                            round(
                                free_quantity_grams,
                                4
                            )
                            if free_quantity_grams is not None
                            else None
                        ),
                        "free_quantity_detected": True,
                        "declared_unit_price": unit_price_value,
                        "calculated_unit_price": round(
                            expected_price_per_gram,
                            4
                        ),
                        "difference": round(
                            difference,
                            4
                        )
                    },
                    "Declared unit sale price does not appear consistent with MRP and the paid quantity after excluding the free/additional quantity.",
                    "Rule 6(11) - unit sale price",
                    "HIGH"
                )

            else:

                checks["unit_price_consistency"] = make_check(
                    "FAIL",
                    {
                        "mrp": mrp_value,
                        "net_quantity_grams": paid_quantity_grams,
                        "declared_unit_price": unit_price_value,
                        "calculated_unit_price": round(
                            expected_price_per_gram,
                            4
                        ),
                        "difference": round(
                            difference,
                            4
                        )
                    },
                    "Declared unit sale price does not appear consistent with MRP and net quantity.",
                    "Rule 6(11) - unit sale price",
                    "HIGH"
                )

            violations.append(
                "Unit sale price appears inconsistent with MRP and the applicable paid quantity."
            )

    else:

        checks["unit_price_consistency"] = make_check(
            "NOT_DETERMINED",
            None,
            "Mathematical unit-price validation could not be completed because MRP, quantity, or unit price could not be reliably parsed.",
            "Rule 6(11) - unit sale price",
            "MEDIUM"
        )


    # ========================================================
    # 12. FONT SIZE / READABILITY
    # ========================================================

    if readability_result:

        readability_status = clean_value(
            readability_result.get(
                "overall_status"
            )
        ).upper()

        physical_font_size = (
            readability_result.get(
                "physical_font_size"
            )
            or {}
        )

        physical_font_status = clean_value(
            physical_font_size.get(
                "status"
            )
        ).upper()


        if readability_status == "CLEAR":

            if physical_font_status == "NOT_DETERMINED":

                checks["font_size_readability"] = make_check(
                    "READABILITY_CLEAR",
                    {
                        "overall_status": readability_status,
                        "physical_font_size_status": (
                            physical_font_status
                            or "NOT_DETERMINED"
                        )
                    },
                    "Required declarations appear clearly printed and legible in the supplied image. Exact physical font height in millimetres is still not determined.",
                    "Rule 7 - minimum height of numerals and letters",
                    "MEDIUM"
                )

                recommendations.append(
                    "Physical font height in millimetres still requires a known image-to-physical scale before final Rule 7 verification."
                )

            else:

                checks["font_size_readability"] = make_check(
                    "PASS",
                    readability_result,
                    "Declarations were assessed as clearly printed and readable.",
                    "Rule 7 - minimum height of numerals and letters",
                    "INFO"
                )

        elif readability_status in [
            "UNCLEAR",
            "POOR",
            "NOT_CLEAR",
            "FAIL"
        ]:

            checks["font_size_readability"] = make_check(
                "WARNING",
                readability_result,
                "One or more declarations may not be sufficiently clear or readable. Manual inspection is recommended.",
                "Rule 7 - minimum height of numerals and letters",
                "HIGH"
            )

            warnings.append(
                "Readability analysis indicates that one or more declarations may require manual inspection."
            )

        else:

            checks["font_size_readability"] = make_check(
                "NOT_DETERMINED",
                readability_result,
                "Readability analysis was returned, but its overall status could not be interpreted automatically.",
                "Rule 7 - minimum height of numerals and letters",
                "MEDIUM"
            )

    else:

        checks["font_size_readability"] = make_check(
            "NOT_DETERMINED",
            None,
            "Readability analysis was not supplied. Font size and readability cannot be determined from structured extraction alone.",
            "Rule 7 - minimum height of numerals and letters",
            "MEDIUM"
        )

        recommendations.append(
            "Run image-level font-size/readability analysis before issuing a final inspection decision."
        )


    # ========================================================
    # 13. MISLEADING DECLARATION DETECTION
    # ========================================================

    suspicious_phrases = [
        "100% pure",
        "guaranteed",
        "best product",
        "number 1",
        "no. 1",
        "completely safe",
        "zero risk",
        "cures",
        "permanent cure"
    ]


    suspicious_found = []

    combined_text = (
        text
        + " "
        + " ".join(
            str(x)
            for x in product_info.get(
                "other_declarations",
                []
            )
        )
    ).lower()


    for phrase in suspicious_phrases:

        if phrase.lower() in combined_text:

            suspicious_found.append(
                phrase
            )


    if suspicious_found:

        checks["misleading_declarations"] = make_check(
            "WARNING",
            suspicious_found,
            "Potentially misleading/promotional wording detected. Human/legal review is required before treating this as a violation.",
            "Misleading/non-standard declaration screening",
            "HIGH"
        )

        warnings.append(
            "Potentially misleading wording detected: "
            + ", ".join(suspicious_found)
        )

    else:

        checks["misleading_declarations"] = make_check(
            "PASS",
            [],
            "No predefined suspicious phrases were detected by the MVP screening rules.",
            "Misleading/non-standard declaration screening",
            "INFO"
        )


    # ========================================================
    # 14. NON-STANDARD DECLARATIONS
    # ========================================================

    non_standard_patterns = [
        r"mrp\s*[:\-]?\s*0",
        r"m\.r\.p\s*[:\-]?\s*0",
        r"net\s*qty\s*[:\-]?\s*0",
        r"net\s*quantity\s*[:\-]?\s*0"
    ]


    non_standard_found = []


    for pattern in non_standard_patterns:

        if re.search(
            pattern,
            combined_text,
            re.IGNORECASE
        ):

            non_standard_found.append(
                pattern
            )


    if non_standard_found:

        checks["non_standard_declarations"] = make_check(
            "WARNING",
            non_standard_found,
            "Potentially non-standard declaration formatting/value detected.",
            "Declaration format screening",
            "HIGH"
        )

        warnings.append(
            "Potentially non-standard declaration detected."
        )

    else:

        checks["non_standard_declarations"] = make_check(
            "PASS",
            [],
            "No predefined non-standard declaration patterns were detected.",
            "Declaration format screening",
            "INFO"
        )


    # ========================================================
    # 15. DIMENSIONS
    # ========================================================

    checks["dimensions"] = make_check(
        "NOT_DETERMINED",
        None,
        "Dimensions are not applicable to every commodity and require commodity-specific determination.",
        "Rule 6(1)(f) - dimensions where relevant",
        "LOW"
    )


    # ========================================================
    # RULE 26(a) - SMALL PACKAGE EXEMPTION
    # ========================================================
    #
    # Rule 26(a) places packages of ten grams or ten millilitres or less
    # outside the declaration requirements of this chapter. Judging such a
    # package against those declarations would report breaches that do not
    # exist in law.
    #
    # The exemption suppresses failures only. It does not assert that the
    # package is compliant: the reading may be wrong, and Rule 26 carries
    # provisos this checker does not evaluate. Suppressed checks therefore
    # become NOT_DETERMINED and are listed for a person to confirm.

    exemptions = []

    measured = small_package_quantity(net_quantity)

    if measured and measured[0] <= 10:

        amount, unit = measured

        # Each exempted check paired with the violation text it raises, so the
        # violation can be withdrawn along with the failure.
        exempted_names = {
            "manufacturer_or_packer":
                "Manufacturer/packer/importer declaration not detected.",
            "generic_product_name":
                "Common/generic product name not detected.",
            "mrp":
                "MRP declaration not detected.",
            "consumer_care_details":
                "Consumer complaint/contact details not detected.",
            "manufacturing_date":
                "Date of manufacture/pre-packing not detected.",
            "unit_price_consistency":
                "Unit sale price appears inconsistent with MRP and the applicable paid quantity."
        }

        suppressed = []
        withdrawn = set()

        for name, violation_text in exempted_names.items():

            check = checks.get(name)

            if not check or check["status"] != "FAIL":
                continue

            check["status"] = "NOT_DETERMINED"
            check["severity"] = "LOW"
            check["message"] = (
                f"{check['message']} Not treated as a breach: the declared net "
                f"quantity is {amount:g} {unit}, and Rule 26(a) places packages "
                f"of ten grams or ten millilitres or less outside these "
                f"declaration requirements. Confirm the quantity and any "
                f"provisos to Rule 26."
            )

            suppressed.append(name)
            withdrawn.add(violation_text)

        if suppressed:

            # Failures raised by the suppressed checks are no longer
            # violations; they are recorded as points to confirm instead.
            violations = [
                violation
                for violation in violations
                if violation not in withdrawn
            ]

            exemptions.append({
                "rule": "Rule 26(a) - packages of 10 g / 10 ml or less",
                "net_quantity": net_quantity,
                "suppressed_checks": suppressed,
                "note": (
                    "Declaration requirements were not applied to this package. "
                    "This is an exemption, not a finding of compliance."
                )
            })

            warnings.append(
                "Package appears to fall under the Rule 26(a) small-package "
                "exemption; declaration requirements were not applied."
            )


    # ========================================================
    # REQUIRED CHECKS FOR SCORE
    # ========================================================

    required_check_names = [
        "manufacturer_or_packer",
        "generic_product_name",
        "net_quantity",
        "mrp",
        "consumer_care_details",
        "manufacturing_date",
        "unit_sale_price",
        "unit_price_consistency"
    ]


    required_checks = {
        name: checks[name]
        for name in required_check_names
    }


    # ========================================================
    # SCORE
    # ========================================================

    scoreable_checks = [
        check
        for check in required_checks.values()
        if check["status"]
        in ["PASS", "FAIL"]
    ]


    total_scoreable = len(
        scoreable_checks
    )


    passed_scoreable = sum(
        1
        for check in scoreable_checks
        if check["status"] == "PASS"
    )


    if total_scoreable > 0:

        score = round(
            (
                passed_scoreable
                / total_scoreable
            ) * 100
        )

    else:

        score = 0


    # ========================================================
    # MISSING DECLARATIONS
    # ========================================================

    missing_declarations = [
        name
        for name, check in required_checks.items()
        if check["status"] == "FAIL"
    ]


    # ========================================================
    # OVERALL STATUS
    # ========================================================

    if score == 100 and not violations:

        overall_status = "COMPLIANT"

    elif score >= 50:

        overall_status = "PARTIALLY_COMPLIANT"

    else:

        overall_status = "NON_COMPLIANT"


    # ========================================================
    # FINAL RESULT
    # ========================================================

    return {

        "status": overall_status,

        "score": score,

        "rule_set": RULE_SET,

        "checks": checks,

        "required_checks": required_check_names,

        "missing_declarations": (
            missing_declarations
        ),

        "violations": violations,

        "warnings": warnings,

        "recommendations": recommendations,

        # The date declarations sorted into what they are, each keeping the
        # text printed on the pack. The interface shows the original text; the
        # normalised form is what the rules were evaluated against.
        "normalized_dates": dates.as_dict(),

        "exemptions": exemptions,

        "inspection_summary": {
            "total_required_checks": len(
                required_check_names
            ),
            "passed_checks": passed_scoreable,
            "failed_checks": len(
                [
                    check
                    for check in required_checks.values()
                    if check["status"] == "FAIL"
                ]
            ),
            "warnings_count": len(
                warnings
            ),
            "violations_count": len(
                violations
            )
        },

        "note": (
            "This is an AI-assisted preliminary "
            "compliance screening. It detects and "
            "evaluates declarations visible in the "
            "supplied product image using automated "
            "rules. Readability analysis assesses "
            "visual clarity, while exact physical "
            "font-height verification requires a "
            "known physical scale. Commodity-specific "
            "applicability, misleading claims, and "
            "final legal interpretation may require "
            "human/legal verification."
        )
    }


# ============================================================
# API ENDPOINT
# ============================================================

@router.post("/check")
def compliance_check(
    data: ComplianceRequest
):

    return check_compliance(
        data
    )