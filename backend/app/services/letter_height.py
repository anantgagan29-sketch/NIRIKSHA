"""
Rule 7 — the size of letters and numerals.

What the Rules require, and what a photograph can honestly say about it.

Rule 7 of the Legal Metrology (Packaged Commodities) Rules, 2011 is about
physical dimensions on a physical package: the height of a numeral in
millimetres, the height of a letter in millimetres, the width of a character
as a fraction of its height. None of those are properties of an image. A
photograph records how many pixels a character occupies, and a pixel is only a
millimetre once something in the frame establishes the conversion.

So this module does two separate jobs and keeps them apart:

  1. It works out **which requirement applies** to this package. That is a
     legal question answered from the declared net quantity and, where the
     quantity is in length, area or number, from the area of the principal
     display panel. It can be answered without measuring anything.

  2. It reports **what the image can support**. With a scale it compares and
     concludes. Without one it says the requirement, says what was observed in
     the image's own terms, and returns REVIEW.

It never converts pixels to millimetres by assuming a package size, and it
never returns FAIL from an unscaled photograph. A wrong FAIL here is an
accusation about a manufacturer, made from arithmetic that was never possible.

Sources for the thresholds below: Rule 7, Legal Metrology (Packaged
Commodities) Rules, 2011. The tables were checked against the rule text
reproduced at indiankanoon.org/doc/151004919 and the summary published by
iPleaders; the two agree on Table II and on the letter-height and width rules,
and on Table I being keyed to net quantity where that quantity is declared by
weight or volume.
"""

from typing import Any, Optional


# --------------------------------------------------------------------------
# What Rule 7 requires
# --------------------------------------------------------------------------

# Rule 7: "The height of letters in the declaration shall not be less than
# 1 mm height and when blown, formed, molded, embossed or perforated, the
# height of letters shall not be less than 2 mm."
MIN_LETTER_HEIGHT_MM = 1.0
MIN_LETTER_HEIGHT_RAISED_MM = 2.0

# Rule 7: "The width of the letter or numeral shall not be less than one third
# of its height, except in the case of numeral '1' and letters (i), (I) and (l)."
MIN_WIDTH_TO_HEIGHT_RATIO = 1 / 3

# Table I — where the net quantity is declared by weight or volume, keyed on
# that quantity. (upper bound in g or ml, height mm, height mm when raised)
# The final row's bound is None: everything above the previous one.
TABLE_I = (
    (200.0, 1.0, 2.0),
    (500.0, 2.0, 4.0),
    (None, 4.0, 6.0),
)

# Table II — where the net quantity is declared by length, area or number,
# keyed on the area of the principal display panel in square centimetres.
TABLE_II = (
    (100.0, 1.0, 2.0),
    (500.0, 2.0, 4.0),
    (2500.0, 4.0, 6.0),
    (None, 6.0, 6.0),
)

RULE_7 = "Rule 7 - size of letters and numerals"

# Rule 7 also requires clear space around the quantity declaration: the height
# of the numeral above and below it, and twice that height to either side.
# Stated for the reader; not measured here, because it needs the same scale
# the height check needs.
FREE_SPACE_NOTE = (
    "Rule 7 also requires the space around the net quantity declaration to be "
    "free of other printed matter: at least the height of the numeral above "
    "and below it, and at least twice that height to its left and right."
)


def _row(table, key: float) -> tuple[float, float]:
    """The first row whose upper bound the value falls within."""
    for bound, normal, raised in table:
        if bound is None or key <= bound:
            return normal, raised

    # Unreachable: every table above ends in an open row.
    return table[-1][1], table[-1][2]


def numeral_requirement(
    net_quantity: Optional[tuple[float, str]] = None,
    display_panel_area_cm2: Optional[float] = None,
    raised: bool = False,
) -> dict[str, Any]:
    """
    The minimum numeral height that applies to this package.

    `net_quantity` is (amount, "g" | "ml") as read from the label. When the
    quantity is declared by weight or volume, Table I decides and the panel
    area is not needed. When it is declared by length, area or number, Table II
    decides and the panel's area is required — which a photograph does not
    give, so the requirement is reported as undetermined rather than guessed.
    """
    if net_quantity is not None:
        amount, unit = net_quantity
        normal, raised_mm = _row(TABLE_I, amount)

        return {
            "determined": True,
            "minimum_height_mm": raised_mm if raised else normal,
            "basis": (
                f"Net quantity {amount:g} {unit}, declared by "
                f"{'weight' if unit == 'g' else 'volume'} — Table I."
            ),
            "table": "Table I",
            "provision": RULE_7,
        }

    if display_panel_area_cm2 is not None:
        normal, raised_mm = _row(TABLE_II, display_panel_area_cm2)

        return {
            "determined": True,
            "minimum_height_mm": raised_mm if raised else normal,
            "basis": (
                f"Principal display panel area {display_panel_area_cm2:g} cm² — Table II."
            ),
            "table": "Table II",
            "provision": RULE_7,
        }

    return {
        "determined": False,
        "minimum_height_mm": None,
        "basis": (
            "The applicable minimum depends on the declared net quantity "
            "(Table I) or, where the quantity is declared by length, area or "
            "number, on the area of the principal display panel (Table II). "
            "Neither was available for this package."
        ),
        "table": None,
        "provision": RULE_7,
    }


# How far below the minimum a reading must fall before it is called a failure.
#
# The scale comes from a width someone measured and a photograph they framed,
# and the second half is the weak one: a pack occupying three quarters of the
# frame instead of all of it makes every height read a quarter short. That
# error points one way — towards finding print too small — which is the
# direction that accuses a manufacturer of something.
#
# So a reading has to be clearly short, not marginally short, before it is a
# FAIL. Between this threshold and the minimum the numbers are reported and
# the finding is REVIEW, which is what a measurement that disagrees with the
# rule by less than its own uncertainty actually means.
FAIL_MARGIN = 0.75


# --------------------------------------------------------------------------
# What the photograph can support
# --------------------------------------------------------------------------

# Declarations whose lettering Rule 7 governs, in the order a report reads
# best: the two the Rules single out, then the rest.
ASSESSED_FIELDS = (
    ("net_quantity", "Net quantity"),
    ("mrp", "Maximum retail price"),
    ("product_name", "Product name"),
    ("manufacturer", "Manufacturer, packer or importer"),
    ("address", "Manufacturer address"),
    ("consumer_care_phone", "Consumer care"),
    ("manufacturing_date", "Month and year of manufacture"),
    ("best_before", "Best before"),
    ("country_of_origin", "Country of origin"),
)


def _block_height(bounding_box: Any) -> Optional[float]:
    """
    The height of a detected text block, in the 0-1000 units the vision pass
    reports boxes in.

    This is the height of the block, not of a character: a box drawn around
    "MRP Rs. 55.00" is as tall as the tallest glyph in it plus whatever the
    model included around it. It is an upper bound on character height, and is
    reported as such.
    """
    if not isinstance(bounding_box, (list, tuple)) or len(bounding_box) != 4:
        return None

    try:
        _, y1, _, y2 = (float(v) for v in bounding_box)
    except (TypeError, ValueError):
        return None

    height = abs(y2 - y1)

    return height if height > 0 else None


def scale_from_package_width(
    package_width_cm: Optional[float],
    image_width_px: Optional[int],
    image_height_px: Optional[int],
) -> Optional[float]:
    """
    Millimetres per vertical unit, from a width the person measured.

    A photograph has no scale of its own. This supplies one from the only
    measurement someone can reasonably take in a shop: the width of the pack,
    with a ruler, in centimetres.

    It rests on one assumption, and the interface states it where the number
    is entered — that the pack spans the frame from edge to edge. A photo with
    the pack filling half the width would halve every height. That is why a
    height that clears the minimum is still reported as REVIEW: the assumption
    is good enough to catch print that is clearly too small, and not good
    enough to certify print that is large enough.
    """
    if not package_width_cm or not image_width_px or not image_height_px:
        return None

    if package_width_cm <= 0:
        return None

    # Pixels are square, so the width gives the scale for both axes.
    mm_per_pixel = (package_width_cm * 10) / image_width_px

    # Boxes are reported in thousandths of the image height.
    return mm_per_pixel * (image_height_px / 1000)


def assess(
    readability_result: Optional[dict[str, Any]],
    net_quantity: Optional[tuple[float, str]] = None,
    display_panel_area_cm2: Optional[float] = None,
    image_height_px: Optional[int] = None,
    mm_per_unit: Optional[float] = None,
) -> dict[str, Any]:
    """
    A Rule 7 finding for each declaration the image located.

    `mm_per_unit` is the conversion from the vision pass's 0-1000 vertical
    units to millimetres on the physical package. It is the whole question:
    supplied, the heights can be compared against the requirement and the
    finding is a conclusion; absent, every height finding is REVIEW. Nothing
    here derives it from the photograph, because a photograph does not carry
    it — it comes from a measured package dimension or a reference object in
    frame, and today the application has neither.
    """
    requirement = numeral_requirement(net_quantity, display_panel_area_cm2)

    findings: list[dict[str, Any]] = []

    fields = (readability_result or {}).get("fields")
    fields = fields if isinstance(fields, dict) else {}

    for key, label in ASSESSED_FIELDS:
        entry = fields.get(key)
        entry = entry if isinstance(entry, dict) else {}

        status = str(entry.get("status", "")).upper()
        located = status in ("CLEAR", "UNCLEAR", "POOR", "NOT_CLEAR")
        height_units = _block_height(entry.get("bounding_box"))

        finding: dict[str, Any] = {
            "field": key,
            "label": label,
            "provision": RULE_7,
            "requirement": _requirement_text(requirement, key),
            "free_space_note": FREE_SPACE_NOTE if key == "net_quantity" else None,
            # Kept deliberately separate from the reading confidence: how well
            # a value was read says nothing about how tall it is printed.
            "ocr_confidence": entry.get("confidence"),
            "observed": None,
            "character_height_mm": None,
            "evidence_confidence": "LOW",
        }

        if not located:
            finding.update(
                status="REVIEW",
                observed="This declaration was not located in the photograph.",
                finding=(
                    "Lettering cannot be assessed for a declaration the image "
                    "does not show. Its presence is assessed separately."
                ),
            )
            findings.append(finding)
            continue

        if height_units is not None and image_height_px:
            # Reported in the image's own terms. It is a real measurement of
            # the photograph and a real fact about the evidence; it is simply
            # not a measurement of the package.
            pixels = height_units / 1000 * image_height_px
            finding["observed"] = (
                f"Text block approximately {pixels:.0f} px tall in a "
                f"{image_height_px} px image "
                f"({height_units / 10:.1f}% of the image height)."
            )
        else:
            finding["observed"] = "The declaration was located, but its extent was not reported."

        if mm_per_unit and height_units is not None and requirement["determined"]:
            observed_mm = height_units * mm_per_unit
            minimum = requirement["minimum_height_mm"]

            finding["character_height_mm"] = round(observed_mm, 2)
            finding["evidence_confidence"] = "MEDIUM"

            # The measurement is of a text block, so it is at least as tall as
            # the characters in it. A block that is already too short proves
            # the characters are too short; a block that is tall enough proves
            # nothing on its own, and stays under review.
            if observed_mm < minimum * FAIL_MARGIN:
                finding.update(
                    status="FAIL",
                    finding=(
                        f"The detected text measures about {observed_mm:.1f} mm, "
                        f"clearly below the {minimum:g} mm minimum that applies — far "
                        f"enough below that framing error does not account for it. "
                        f"Because this is the height of the whole block, the "
                        f"characters within it are no taller."
                    ),
                )
            elif observed_mm < minimum:
                finding.update(
                    status="REVIEW",
                    finding=(
                        f"The detected text measures about {observed_mm:.1f} mm against a "
                        f"{minimum:g} mm minimum — short, but by less than the scale's own "
                        f"uncertainty. The conversion assumes the pack fills the frame, and "
                        f"a looser crop reads short. Measure the printed characters on the "
                        f"package before treating this as a shortfall."
                    ),
                )
            else:
                finding.update(
                    status="REVIEW",
                    finding=(
                        f"The detected text block measures about {observed_mm:.1f} mm "
                        f"against a {minimum:g} mm minimum. A block tall enough does not "
                        f"establish that the characters in it are: confirm the printed "
                        f"character height on the package."
                    ),
                )

            findings.append(finding)
            continue

        # No scale. This is the ordinary case, and the honest answer is a
        # stated requirement and a request for physical verification.
        finding.update(
            status="REVIEW",
            evidence_confidence="MEDIUM" if height_units is not None else "LOW",
            finding=(
                "Character height in millimetres could not be established from "
                "this photograph: no reliable physical scale is present in the "
                "image, and a package size was not supplied. Verify the printed "
                "character height against the applicable minimum on the physical "
                "package."
            ),
        )
        findings.append(finding)

    return {
        "provision": RULE_7,
        "requirement": requirement,
        "scale": {
            "available": bool(mm_per_unit),
            "source": "supplied package dimension" if mm_per_unit else None,
            "note": (
                "Millimetre heights were derived from a supplied package "
                "dimension."
                if mm_per_unit
                else "No physical scale was available, so no height was converted to "
                "millimetres. Rule 7 is a requirement about the printed package, "
                "and a photograph alone cannot measure it."
            ),
        },
        "width_rule": (
            "Rule 7 also requires the width of a letter or numeral to be at least "
            "one third of its height, except for the numeral 1 and the letters "
            "i, I and l. Character widths are not measured from this photograph."
        ),
        "findings": findings,
        "summary": _summarise(findings),
    }


def _requirement_text(requirement: dict[str, Any], field: str) -> str:
    """What the reader needs to know about the rule, for this declaration."""
    if field == "net_quantity" and requirement["determined"]:
        return (
            f"The numerals of the net quantity declaration must be at least "
            f"{requirement['minimum_height_mm']:g} mm high "
            f"({requirement['basis']})"
        )

    if requirement["determined"]:
        return (
            f"Letters in a required declaration must be at least "
            f"{MIN_LETTER_HEIGHT_MM:g} mm high, or {MIN_LETTER_HEIGHT_RAISED_MM:g} mm "
            f"where the lettering is blown, formed, moulded, embossed or perforated. "
            f"For this package the net quantity numerals must reach "
            f"{requirement['minimum_height_mm']:g} mm ({requirement['basis']})"
        )

    return (
        f"Letters in a required declaration must be at least "
        f"{MIN_LETTER_HEIGHT_MM:g} mm high, or {MIN_LETTER_HEIGHT_RAISED_MM:g} mm where "
        f"the lettering is blown, formed, moulded, embossed or perforated. "
        f"{requirement['basis']}"
    )


def _summarise(findings: list[dict[str, Any]]) -> dict[str, Any]:
    counts: dict[str, int] = {}

    for finding in findings:
        status = finding.get("status", "REVIEW")
        counts[status] = counts.get(status, 0) + 1

    return {
        "counts": counts,
        "overall": "FAIL" if counts.get("FAIL") else "REVIEW" if counts.get("REVIEW") else "PASS",
    }
