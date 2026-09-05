"""
Rule 9 — where the declarations appear, and how they are arranged.

Rule 9 of the Legal Metrology (Packaged Commodities) Rules, 2011 requires the
declarations to appear on the principal display panel, permits them to be
grouped together in one place, and requires every declaration to be legible
and prominent.

A photograph shows one view of a three-dimensional package, and that limits
what can honestly be concluded:

  * **Which panel is the principal display panel** cannot be decided from a
    photograph. It is the face presented to the purchaser, and one frame does
    not establish which face that is.

  * **A declaration absent from this view** is not a declaration absent from
    the package. It may be on a side or a back that was not photographed.

  * **What the photograph does show** is where the declarations it found sit
    relative to one another — whether they read as one block or are scattered
    across the face. That is a real observation about the arrangement, and it
    is what this module reports.

So this never returns FAIL. It reports what the view supports and asks for the
rest to be confirmed against the physical package. A placement finding that
condemned a package on one photograph would be condemning the photograph.
"""

from typing import Any, Optional

RULE_9 = "Rule 9 - declarations to be legible, prominent and on the principal display panel"

# The declarations Rule 6 requires, in the vision pass's own field names.
REQUIRED_FIELDS = (
    ("product_name", "Common or generic name"),
    ("net_quantity", "Net quantity"),
    ("mrp", "Retail sale price"),
    ("manufacturer", "Manufacturer, packer or importer"),
    ("address", "Address"),
    ("manufacturing_date", "Month and year of manufacture or packing"),
    ("consumer_care_phone", "Consumer care"),
)

# How far apart, as a fraction of the frame, declarations can sit and still
# read as one group. Chosen to be forgiving: the question is whether they are
# together or scattered across the face, not whether they line up neatly.
GROUPING_SPREAD = 0.55


def _centre(box: Any) -> Optional[tuple[float, float]]:
    """The middle of a bounding box, in fractions of the frame."""
    if not isinstance(box, (list, tuple)) or len(box) != 4:
        return None

    try:
        x1, y1, x2, y2 = (float(v) for v in box)
    except (TypeError, ValueError):
        return None

    return ((x1 + x2) / 2 / 1000, (y1 + y2) / 2 / 1000)


def assess(readability_result: Optional[dict[str, Any]]) -> dict[str, Any]:
    """
    What this view shows about where the declarations sit.

    Returns the declarations located in the frame, those absent from it, and
    whether the located ones read as one group — with the standing caveat that
    one photograph is one panel.
    """
    fields = (readability_result or {}).get("fields")
    fields = fields if isinstance(fields, dict) else {}

    located: list[dict[str, Any]] = []
    absent: list[str] = []

    for key, label in REQUIRED_FIELDS:
        entry = fields.get(key)
        entry = entry if isinstance(entry, dict) else {}

        status = str(entry.get("status", "")).upper()
        centre = _centre(entry.get("bounding_box"))

        if status in ("CLEAR", "UNCLEAR", "POOR", "NOT_CLEAR") and centre:
            located.append({"field": key, "label": label, "x": centre[0], "y": centre[1]})
        else:
            absent.append(label)

    grouping = _grouping(located)

    if not located:
        return {
            "provision": RULE_9,
            "status": "REVIEW",
            "located": [],
            "absent": absent,
            "grouping": grouping,
            "finding": (
                "No declaration could be placed within this photograph, so nothing can be "
                "said about their arrangement. Photograph the face carrying the declarations."
            ),
            "limitation": _LIMITATION,
        }

    if absent:
        finding = (
            f"{len(located)} of {len(REQUIRED_FIELDS)} required declarations were located in "
            f"this view. The rest were not visible here, which does not mean they are missing "
            f"from the package — they may be on a panel that was not photographed. "
            f"{grouping['summary']}"
        )
    else:
        finding = (
            f"All {len(located)} required declarations were located in this single view. "
            f"{grouping['summary']}"
        )

    return {
        "provision": RULE_9,
        # Never a pass and never a failure: this is one panel of a package.
        "status": "REVIEW",
        "located": located,
        "absent": absent,
        "grouping": grouping,
        "finding": finding,
        "limitation": _LIMITATION,
    }


def _grouping(located: list[dict[str, Any]]) -> dict[str, Any]:
    """How spread out the located declarations are within the frame."""
    if len(located) < 2:
        return {
            "grouped": None,
            "spread": None,
            "summary": "Too few declarations were located to say how they are arranged.",
        }

    xs = [item["x"] for item in located]
    ys = [item["y"] for item in located]
    spread = max(max(xs) - min(xs), max(ys) - min(ys))
    grouped = spread <= GROUPING_SPREAD

    return {
        "grouped": grouped,
        "spread": round(spread, 3),
        "summary": (
            "They sit together on this panel, which is the arrangement Rule 9 permits."
            if grouped
            else "They are spread across this view rather than grouped in one place. Rule 9 "
            "permits grouping but does not require it, so this is an observation rather "
            "than a shortfall."
        ),
    }


_LIMITATION = (
    "Which face is the principal display panel cannot be established from a photograph, so "
    "this reports what the photographed view shows and does not conclude compliance either "
    "way. Confirm against the physical package."
)
