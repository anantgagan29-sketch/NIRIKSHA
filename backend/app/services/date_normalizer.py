"""
Date and shelf-life normalisation for packaged commodity labels.

Indian packaging labels the same declaration a dozen different ways: MFG, MFD,
PKD, "Packed On", "Date of Packing", EXP, "Use By", "Best Before 6 Months".
Treating those as different fields — or worse, only recognising the two most
formal spellings — makes a compliant product look non-compliant.

This module does the classification deterministically rather than leaving it to
the vision model. The model reads text off a photograph; deciding what a label
*means* under the Rules is logic that should be inspectable and testable, and
it should give the same answer every time.

Two things are kept distinct throughout, because the Rules treat them
differently:

  * a **date** — an actual point in time printed on the pack;
  * a **shelf life** — a duration, such as "Best Before 6 Months from PKD",
    which only becomes a date once combined with the packing date.

The original text is always preserved alongside the normalised value: the
interface shows a person what was printed, not our interpretation of it.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date
from typing import Optional

# ============================================================
# LABEL VOCABULARY
# ============================================================
# Ordered longest-first within each group so that "manufacturing date" is not
# matched as the shorter "mfg" hiding inside another word.

MANUFACTURING_LABELS = [
    "date of manufacture",
    "date of mfg",
    "manufacturing date",
    "manufactured on",
    "manufactured",
    "mfg date",
    "mfd date",
    "mfg",
    "mfd",
]

PACKING_LABELS = [
    "date of packing",
    "date of pkg",
    "packaging date",
    "packing date",
    "packed date",
    "packed on",
    "packed",
    "pkd",
    "pkg date",
]

EXPIRY_LABELS = [
    "expiry date",
    "date of expiry",
    "expires on",
    "expiry",
    "use before",
    "use by",
    "exp date",
    "exp",
]

BEST_BEFORE_LABELS = [
    "best before end",
    "best before",
    "best by",
]

# Longest first so "mfg date" wins over "mfg".
_GROUPS: list[tuple[str, list[str]]] = [
    ("best_before", sorted(BEST_BEFORE_LABELS, key=len, reverse=True)),
    ("expiry", sorted(EXPIRY_LABELS, key=len, reverse=True)),
    ("packing", sorted(PACKING_LABELS, key=len, reverse=True)),
    ("manufacturing", sorted(MANUFACTURING_LABELS, key=len, reverse=True)),
]

DateKind = str  # "manufacturing" | "packing" | "expiry" | "best_before" | None


def classify_label(text: Optional[str]) -> Optional[DateKind]:
    """
    Decides which declaration a piece of label text is announcing.

    Best-before is tested before expiry because "Best Before" is a distinct
    declaration, and before manufacturing because a string like
    "Best Before 6 Months from PKD" mentions packing too — the phrase's own
    subject is what matters, not every term it happens to contain.
    """
    if not text:
        return None

    lowered = _clean(text)

    for kind, labels in _GROUPS:
        for label in labels:
            # Word-boundary match: "exp" must not fire inside "expensive".
            if re.search(rf"(?<![a-z]){re.escape(label)}(?![a-z])", lowered):
                return kind

    return None


def _clean(text: str) -> str:
    """Lowercase and collapse the punctuation OCR sprays through labels."""
    lowered = text.lower()
    lowered = lowered.replace(".", " ").replace("_", " ")
    return re.sub(r"\s+", " ", lowered).strip()


# ============================================================
# DATE PARSING
# ============================================================

_MONTH_NAMES = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
    "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
}

_SEP = r"[/\-.\s]"


@dataclass
class ParsedDate:
    """A date read off a label, with how precisely it was stated."""

    original: str
    year: Optional[int] = None
    month: Optional[int] = None
    day: Optional[int] = None
    #  "day" | "month" | "year" — packaging often states only month and year,
    #  which is exactly what Rule 6 asks for, so this is not a defect.
    precision: Optional[str] = None

    @property
    def is_valid(self) -> bool:
        return self.year is not None

    @property
    def iso(self) -> Optional[str]:
        if self.year is None:
            return None
        if self.month is None:
            return f"{self.year:04d}"
        if self.day is None:
            return f"{self.year:04d}-{self.month:02d}"
        return f"{self.year:04d}-{self.month:02d}-{self.day:02d}"

    def as_dict(self) -> dict:
        return {
            "original": self.original,
            "iso": self.iso,
            "year": self.year,
            "month": self.month,
            "day": self.day,
            "precision": self.precision,
        }


def _expand_year(value: int) -> int:
    """Two-digit years on packaging are current-century; 26 means 2026."""
    if value >= 100:
        return value
    century = date.today().year // 100 * 100
    return century + value


def parse_date(text: Optional[str]) -> Optional[ParsedDate]:
    """
    Reads a date out of label text, in the forms Indian packaging uses.

    Returns None when there is no date to read — a label may carry a shelf-life
    duration instead, which `parse_shelf_life` handles.
    """
    if not text:
        return None

    cleaned = _clean(text)

    # 12/08/2026, 12-08-26, 12.08.2026 — day first, as printed in India.
    match = re.search(rf"\b(\d{{1,2}}){_SEP}(\d{{1,2}}){_SEP}(\d{{2,4}})\b", cleaned)
    if match:
        first, second, third = (int(g) for g in match.groups())
        year = _expand_year(third)
        # A first component above 12 can only be a day; otherwise assume the
        # Indian day-month order rather than the American month-day one.
        day, month = (first, second) if first > 12 or second <= 12 else (second, first)
        if 1 <= month <= 12 and 1 <= day <= 31:
            return ParsedDate(text.strip(), year, month, day, "day")

    # AUG 2026, 08/2026, 08-26 — month and year only.
    match = re.search(rf"\b([a-z]{{3,9}}){_SEP}?(\d{{2,4}})\b", cleaned)
    if match and match.group(1) in _MONTH_NAMES:
        return ParsedDate(
            text.strip(), _expand_year(int(match.group(2))), _MONTH_NAMES[match.group(1)], None, "month"
        )

    match = re.search(rf"\b(\d{{1,2}}){_SEP}(\d{{4}})\b", cleaned)
    if match:
        month, year = int(match.group(1)), int(match.group(2))
        if 1 <= month <= 12:
            return ParsedDate(text.strip(), year, month, None, "month")

    match = re.search(rf"\b(\d{{1,2}}){_SEP}(\d{{2}})\b", cleaned)
    if match:
        month, year = int(match.group(1)), _expand_year(int(match.group(2)))
        if 1 <= month <= 12:
            return ParsedDate(text.strip(), year, month, None, "month")

    # A bare four-digit year, last: it is the weakest signal.
    match = re.search(r"\b(19|20)(\d{2})\b", cleaned)
    if match:
        return ParsedDate(text.strip(), int(match.group(0)), None, None, "year")

    return None


# ============================================================
# SHELF LIFE
# ============================================================

_UNIT_DAYS = {"day": 1, "days": 1, "week": 7, "weeks": 7, "month": 30, "months": 30, "year": 365, "years": 365}


@dataclass
class ShelfLife:
    """A duration such as "6 months from packing", not a point in time."""

    original: str
    amount: int
    unit: str
    #  What the duration counts from, when the label says: "pkd" or "mfg".
    reference: Optional[str] = None

    @property
    def approx_days(self) -> int:
        return self.amount * _UNIT_DAYS.get(self.unit, 30)

    def as_dict(self) -> dict:
        return {
            "original": self.original,
            "amount": self.amount,
            "unit": self.unit,
            "reference": self.reference,
            "approx_days": self.approx_days,
        }


def parse_shelf_life(text: Optional[str]) -> Optional[ShelfLife]:
    """
    Reads a relative shelf life: "Best Before 6 Months from PKD".

    This is a real and common way to declare shelf life, and a checker that
    only understands printed dates would wrongly report it as missing.
    """
    if not text:
        return None

    cleaned = _clean(text)

    match = re.search(r"\b(\d{1,3})\s*(day|days|week|weeks|month|months|year|years)\b", cleaned)
    if not match:
        return None

    reference = None
    if re.search(r"(?<![a-z])(pkd|packing|packed|packaging)(?![a-z])", cleaned):
        reference = "pkd"
    elif re.search(r"(?<![a-z])(mfg|mfd|manufacture|manufacturing|manufactured)(?![a-z])", cleaned):
        reference = "mfg"

    return ShelfLife(text.strip(), int(match.group(1)), match.group(2), reference)


# ============================================================
# PRODUCT-LEVEL NORMALISATION
# ============================================================


@dataclass
class NormalisedDates:
    """
    Every date-like declaration on a pack, sorted into what it actually is.

    `date_declaration_present` is the question Rule 6 asks — a pack needs a
    manufacture, packing or import date, and any one of them satisfies it.
    """

    manufacturing_date: Optional[ParsedDate] = None
    packing_date: Optional[ParsedDate] = None
    expiry_date: Optional[ParsedDate] = None
    best_before_date: Optional[ParsedDate] = None
    shelf_life: Optional[ShelfLife] = None
    #  Text that looked like a date declaration but could not be parsed. Worth
    #  surfacing for review rather than silently dropping.
    unparsed: list[str] = field(default_factory=list)

    @property
    def date_declaration_present(self) -> bool:
        return bool(self.manufacturing_date or self.packing_date)

    @property
    def shelf_life_declaration_present(self) -> bool:
        return bool(self.expiry_date or self.best_before_date or self.shelf_life)

    def as_dict(self) -> dict:
        return {
            "manufacturing_date": self.manufacturing_date.as_dict() if self.manufacturing_date else None,
            "packing_date": self.packing_date.as_dict() if self.packing_date else None,
            "expiry_date": self.expiry_date.as_dict() if self.expiry_date else None,
            "best_before_date": self.best_before_date.as_dict() if self.best_before_date else None,
            "shelf_life": self.shelf_life.as_dict() if self.shelf_life else None,
            "unparsed": self.unparsed,
            "date_declaration_present": self.date_declaration_present,
            "shelf_life_declaration_present": self.shelf_life_declaration_present,
        }


def _assign(result: NormalisedDates, kind: Optional[DateKind], text: str) -> None:
    """Files one piece of label text under the declaration it belongs to."""
    parsed = parse_date(text)
    duration = parse_shelf_life(text)

    if kind == "manufacturing":
        if parsed and not result.manufacturing_date:
            result.manufacturing_date = parsed
        elif not parsed:
            result.unparsed.append(text)

    elif kind == "packing":
        if parsed and not result.packing_date:
            result.packing_date = parsed
        elif not parsed:
            result.unparsed.append(text)

    elif kind == "expiry":
        if parsed and not result.expiry_date:
            result.expiry_date = parsed
        elif not parsed:
            result.unparsed.append(text)

    elif kind == "best_before":
        # "Best Before 6 Months from PKD" is a duration; "Best Before 08/2027"
        # is a date. The same label carries both forms, so check for a date
        # first and fall back to a duration.
        if parsed and not result.best_before_date:
            result.best_before_date = parsed
        elif duration and not result.shelf_life:
            result.shelf_life = duration
        elif not parsed and not duration:
            result.unparsed.append(text)

    else:
        # No recognisable label. A bare duration is still a shelf life.
        if duration and not result.shelf_life:
            result.shelf_life = duration
        elif parsed and not result.manufacturing_date and not result.packing_date:
            # An unlabelled date is not attributed to any declaration; it is
            # recorded so a person can decide what it was.
            result.unparsed.append(text)


def normalise_product_dates(product: dict) -> NormalisedDates:
    """
    Sorts every date-like value a product carries into normalised declarations.

    Reads the model's own named fields first, then anything it collected under
    `other_dates` and `other_declarations`, so a label that says "PKD 12/08/26"
    is understood even when the model filed it as a loose observation.
    """
    result = NormalisedDates()

    if not isinstance(product, dict):
        return result

    # The model's named fields carry their meaning in the key, but their value
    # often repeats the printed label ("MFD: 12/08/26"), so the text is still
    # classified — a value filed under manufacturing that actually reads
    # "PKD ..." belongs under packing.
    named: list[tuple[str, Optional[DateKind]]] = [
        ("manufacturing_date", "manufacturing"),
        ("packing_date", "packing"),
        ("expiry_date", "expiry"),
        ("best_before", "best_before"),
        ("shelf_life", "best_before"),
    ]

    for key, default_kind in named:
        value = product.get(key)
        if not isinstance(value, str) or not value.strip():
            continue
        _assign(result, classify_label(value) or default_kind, value.strip())

    for key in ("other_dates", "other_declarations"):
        for value in product.get(key) or []:
            if not isinstance(value, str) or not value.strip():
                continue
            kind = classify_label(value)
            # Only pull loose text in when it names a date declaration; other
            # declarations are not this module's business.
            if kind:
                _assign(result, kind, value.strip())

    return result
