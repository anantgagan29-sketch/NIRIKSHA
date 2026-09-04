"""
Tests for label-date normalisation.

The cases here are the label spellings that actually appear on Indian packs.
Each one is a way a compliant product could previously have been reported as
missing a declaration.
"""

from app.services.date_normalizer import (
    classify_label,
    normalise_product_dates,
    parse_date,
    parse_shelf_life,
)


def check(name, condition, detail=""):
    print(f"{'PASS' if condition else 'FAIL'}  {name}{('  -> ' + detail) if detail and not condition else ''}")
    return bool(condition)


results = []

# ---------- label classification ----------
print("\n=== label classification ===")
for text, expected in [
    ("MFG", "manufacturing"),
    ("MFD", "manufacturing"),
    ("Mfg Date", "manufacturing"),
    ("MFD Date: 12/08/26", "manufacturing"),
    ("Manufactured", "manufacturing"),
    ("Manufacturing Date", "manufacturing"),
    ("Date of Manufacture", "manufacturing"),
    ("PKD", "packing"),
    ("Packed", "packing"),
    ("Packed On", "packing"),
    ("Packing Date", "packing"),
    ("Date of Packing", "packing"),
    ("Packed Date", "packing"),
    ("EXP", "expiry"),
    ("Expiry", "expiry"),
    ("Expiry Date", "expiry"),
    ("Use By", "expiry"),
    ("Use Before", "expiry"),
    ("Best Before", "best_before"),
    ("Best Before 6 Months from PKD", "best_before"),
    ("Net Quantity", None),
    ("expensive item", None),        # must not match "exp"
    ("MRP Rs. 45", None),
]:
    got = classify_label(text)
    results.append(check(f"classify({text!r}) == {expected}", got == expected, f"got {got}"))

# ---------- date parsing ----------
print("\n=== date parsing ===")
for text, expected_iso in [
    ("12/08/2026", "2026-08-12"),
    ("12-08-26", "2026-08-12"),
    ("12.08.2026", "2026-08-12"),
    ("31/10/26", "2026-10-31"),
    ("AUG 2026", "2026-08"),
    ("08/2026", "2026-08"),
    ("Aug-26", "2026-08"),
    ("December 2027", "2027-12"),
    ("2026", "2026"),
    ("MFD: 12/08/2026", "2026-08-12"),
    ("Best Before 6 Months", None),   # a duration, not a date
]:
    parsed = parse_date(text)
    got = parsed.iso if parsed else None
    results.append(check(f"parse_date({text!r}) == {expected_iso}", got == expected_iso, f"got {got}"))

# the four-digit-year truncation bug that bit us before
p = parse_date("04/2026")
results.append(check("04/2026 keeps the full year", p and p.year == 2026, f"got {p.year if p else None}"))

# original text is preserved
p = parse_date("MFD: 12/08/2026")
results.append(check("original text preserved", p and p.original == "MFD: 12/08/2026", f"got {p.original if p else None}"))

# ---------- shelf life ----------
print("\n=== shelf life ===")
for text, amount, unit, reference in [
    ("Best Before 6 Months from PKD", 6, "months", "pkd"),
    ("Best Before 12 Months from Manufacture", 12, "months", "mfg"),
    ("Best before 90 days", 90, "days", None),
    ("Best Before 2 Years from MFG", 2, "years", "mfg"),
]:
    s = parse_shelf_life(text)
    ok = s and s.amount == amount and s.unit == unit and s.reference == reference
    results.append(check(f"shelf_life({text!r})", ok, f"got {s.as_dict() if s else None}"))

results.append(check("a plain date is not a shelf life", parse_shelf_life("12/08/2026") is None))

# ---------- product-level normalisation ----------
print("\n=== product normalisation ===")

# A pack declaring PKD only — the case the user reported.
product = {"manufacturing_date": None, "expiry_date": None, "best_before": None,
           "other_dates": ["PKD: 12/08/2026", "Best Before 6 Months from PKD"]}
n = normalise_product_dates(product)
results.append(check("PKD recognised as a packing date", n.packing_date and n.packing_date.iso == "2026-08-12",
                     str(n.as_dict())))
results.append(check("date declaration satisfied by PKD alone", n.date_declaration_present))
results.append(check("relative shelf life recognised",
                     n.shelf_life and n.shelf_life.amount == 6 and n.shelf_life.reference == "pkd"))
results.append(check("shelf-life declaration satisfied", n.shelf_life_declaration_present))

# A pack using MFD + EXP.
product = {"manufacturing_date": "MFD 12/08/2026", "expiry_date": "EXP 31/10/2027"}
n = normalise_product_dates(product)
results.append(check("MFD parsed", n.manufacturing_date and n.manufacturing_date.iso == "2026-08-12"))
results.append(check("EXP parsed", n.expiry_date and n.expiry_date.iso == "2027-10-31"))
results.append(check("both declarations present",
                     n.date_declaration_present and n.shelf_life_declaration_present))

# A value misfiled by the model: packing text sitting in the manufacturing field.
product = {"manufacturing_date": "Packed On: 01/03/2026"}
n = normalise_product_dates(product)
results.append(check("misfiled packing text refiled under packing",
                     n.packing_date is not None and n.manufacturing_date is None, str(n.as_dict())))

# Best Before as an absolute date rather than a duration.
product = {"best_before": "Best Before 08/2027"}
n = normalise_product_dates(product)
results.append(check("absolute best-before parsed as a date",
                     n.best_before_date and n.best_before_date.iso == "2027-08", str(n.as_dict())))

# A pack with nothing at all — must not invent anything.
n = normalise_product_dates({})
results.append(check("empty product declares nothing",
                     not n.date_declaration_present and not n.shelf_life_declaration_present))

# Unreadable date text is surfaced, not dropped.
n = normalise_product_dates({"manufacturing_date": "MFD: smudged"})
results.append(check("unreadable date kept for review", n.unparsed == ["MFD: smudged"], str(n.unparsed)))

print(f"\n{sum(results)}/{len(results)} passed")
raise SystemExit(0 if all(results) else 1)
