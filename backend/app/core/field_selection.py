"""
Which declarations the person asked us to check.

An inspector rarely wants everything. Someone checking a consignment for
expiry dates does not want a report arguing about unit sale price, and a
report that answers questions nobody asked buries the one that was.

So a scan can name the declarations it is about. The label is still read once
and read whole — the reading is a single call to the vision model and costs
the same either way, and throwing away text we already have would only make
the answer worse. What the selection changes is what gets *assessed* and
reported: which requirements decide the outcome, and which appear in the
document.

Two properties this has to keep:

  * **A selection is not a verdict.** Leaving expiry unselected does not make
    a pack compliant on expiry; it means nobody asked. Unselected checks are
    still computed and still returned, marked as outside the request, so the
    score is drawn only from what was asked while the rest stays visible
    rather than silently becoming a pass.

  * **No selection means what it always meant.** A request that names nothing
    is the whole assessment, exactly as before this existed. Every stored scan
    predates the feature and must keep reading the way it did.

Field names arrive from a browser, so they are checked against this table and
anything unrecognised is dropped. A caller cannot name a rule and have it run.
"""

from __future__ import annotations

from typing import Iterable, Optional


# Each selectable declaration, and the compliance checks it governs.
#
# The mapping is many-to-many on purpose. "Expiry date" is one thing to a
# person and two checks in the engine, and `unit_price_consistency` compares
# the unit price against the MRP *and* the net quantity, so it belongs to both
# — a consistency check is only meaningful when everything it compares was
# asked for.
FIELD_CHECKS: dict[str, tuple[str, ...]] = {
    "product_name": ("generic_product_name",),
    "manufacturer": ("manufacturer_or_packer",),
    "mrp": ("mrp", "unit_sale_price", "unit_price_consistency"),
    "manufacturing_date": ("manufacturing_date",),
    "expiry_date": ("best_before_or_use_by",),
    "batch_number": ("batch_number",),
    "net_quantity": ("net_quantity", "unit_price_consistency"),
}

# The extracted values each selection covers, so a filtered report shows the
# declarations behind its findings and not a page of unrelated ones.
FIELD_VALUES: dict[str, tuple[str, ...]] = {
    "product_name": ("product_name", "brand"),
    "manufacturer": ("manufacturer", "packer", "address"),
    "mrp": ("mrp", "unit_sale_price"),
    "manufacturing_date": ("manufacturing_date", "packing_date"),
    "expiry_date": ("expiry_date", "best_before", "shelf_life"),
    "batch_number": ("batch_number",),
    "net_quantity": ("net_quantity",),
}

#  What each selection is called on screen and in a report.
FIELD_LABELS: dict[str, str] = {
    "product_name": "Product Name",
    "manufacturer": "Manufacturer",
    "mrp": "MRP / Price",
    "manufacturing_date": "Manufacturing Date",
    "expiry_date": "Expiry Date",
    "batch_number": "Batch / Lot Number",
    "net_quantity": "Net Quantity",
}

SUPPORTED_FIELDS: tuple[str, ...] = tuple(FIELD_CHECKS)

#  Accepted from a client as "everything", so the interface can send its
#  "All Fields" control through without translating it first.
_ALL = {"all", "all_fields", "allfields", "*"}

#  Older and camel-cased spellings a client might send. Kept small and
#  explicit: guessing at names would let a typo silently select nothing.
_ALIASES: dict[str, str] = {
    "productname": "product_name",
    "name": "product_name",
    "genericname": "product_name",
    "manufacturername": "manufacturer",
    "packer": "manufacturer",
    "price": "mrp",
    "retailprice": "mrp",
    "maximumretailprice": "mrp",
    "mfgdate": "manufacturing_date",
    "manufacturedate": "manufacturing_date",
    "packingdate": "manufacturing_date",
    "expirydate": "expiry_date",
    "expiry": "expiry_date",
    "usebydate": "expiry_date",
    "bestbefore": "expiry_date",
    "batchnumber": "batch_number",
    "batch": "batch_number",
    "lotnumber": "batch_number",
    "netquantity": "net_quantity",
    "quantity": "net_quantity",
}


def normalise_selection(raw: Optional[Iterable[str]]) -> Optional[list[str]]:
    """
    Turns whatever a client sent into a selection this system will act on.

    Returns None for "assess everything" — no selection given, an empty one,
    "all", or a list in which nothing was recognisable. None is the value that
    reproduces the behaviour from before selections existed, and it is what
    every path here falls back to, because an unreadable selection must widen
    the assessment rather than narrow it to nothing.
    """

    if raw is None:
        return None

    seen: list[str] = []

    for item in raw:
        if not isinstance(item, str):
            continue

        key = item.strip().lower()

        if not key:
            continue

        if key in _ALL:
            return None

        # Fold spellings apart only by case and separators; a name that
        # survives this and is still unknown is dropped rather than guessed.
        flat = key.replace("-", "").replace("_", "").replace(" ", "")
        field = key if key in FIELD_CHECKS else _ALIASES.get(flat)

        if field and field not in seen:
            seen.append(field)

    if not seen or len(seen) == len(SUPPORTED_FIELDS):
        # Everything selected is the same request as no selection, and is
        # recorded as such so the two produce identical results.
        return None

    return seen


def parse_selection(raw: Optional[str]) -> Optional[list[str]]:
    """
    Reads a selection off a form field.

    A multipart form carries strings, so the interface may send either a JSON
    array or a comma-separated list. Both are accepted; neither is trusted.
    """

    if raw is None:
        return None

    text = raw.strip()

    if not text:
        return None

    if text.startswith("["):
        import json

        try:
            parsed = json.loads(text)
        except ValueError:
            return None

        return normalise_selection(parsed if isinstance(parsed, list) else None)

    return normalise_selection(text.split(","))


def checks_for(selection: Optional[list[str]]) -> Optional[set[str]]:
    """The compliance checks a selection asks for. None means all of them."""

    if selection is None:
        return None

    names: set[str] = set()

    for field in selection:
        names.update(FIELD_CHECKS.get(field, ()))

    return names


def values_for(selection: Optional[list[str]]) -> Optional[set[str]]:
    """The extracted declarations a selection covers. None means all of them."""

    if selection is None:
        return None

    keys: set[str] = set()

    for field in selection:
        keys.update(FIELD_VALUES.get(field, ()))

    return keys


def labels_for(selection: Optional[list[str]]) -> list[str]:
    """What to call the selection in an interface or a report."""

    if selection is None:
        return ["All Fields"]

    return [FIELD_LABELS.get(field, field) for field in selection]
