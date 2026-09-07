"""
Assessing only what was asked, and nothing changing when nothing was asked.

The property that matters most here is the one about absence: a declaration
left out of the request must not come back as a pass. Somebody reading a
report headed "Expiry Date" should not be able to conclude anything about the
price from it — not that it was fine, and not that it was missing.
"""

from app.api.routes.compliance import ComplianceRequest, check_compliance
from app.core.field_selection import (
    SUPPORTED_FIELDS,
    checks_for,
    normalise_selection,
    parse_selection,
)

results = []


def check(name, condition, detail=""):
    print(f"{'PASS' if condition else 'FAIL'}  {name}")
    if not condition and detail:
        print(f"        {detail}")
    results.append(bool(condition))


# A pack that is right about some declarations and wrong about others, so a
# narrowed assessment has something to actually change.
PRODUCT = {
    "product_name": "Namkeen Mixture",
    "manufacturer": "Test Foods Pvt Ltd",
    "address": "Plot 4, Industrial Area, Pune 411001",
    "net_quantity": "200 g",
    "expiry_date": "EXP 31/10/2027",
    "manufacturing_date": "MFD 12/08/2026",
    "batch_number": "SB12A",
    # No MRP and no consumer care: two real failures to keep out of a
    # narrowed report.
}


def run(selection):
    return check_compliance(
        ComplianceRequest(product_info=PRODUCT, selected_fields=selection)
    )


print("=== nothing asked means everything, exactly as before ===")
baseline = run(None)
for alias in (["all"], [], list(SUPPORTED_FIELDS)):
    other = run(alias)
    same = (
        other["score"] == baseline["score"]
        and other["status"] == baseline["status"]
        and other["violations"] == baseline["violations"]
    )
    check(f"{alias!r} gives the identical assessment", same,
          f"{other['score']} vs {baseline['score']}")

check("no selection is reported as no selection",
      baseline["selected_fields"] is None and baseline["selection_applied"] is False)
check("every check is marked selected",
      all(c["selected"] for c in baseline["checks"].values()))

print("\n=== TEST 1 — expiry only ===")
r = run(["expiry_date"])
selected = [n for n, c in r["checks"].items() if c["selected"]]
check("only the expiry check is selected", selected == ["best_before_or_use_by"], str(selected))
check("unselected checks are still present", len(r["checks"]) == len(baseline["checks"]))
check("MRP's absence is not a finding here",
      not any("MRP" in v for v in r["violations"]), str(r["violations"]))
check("but it is not lost either",
      any("MRP" in v for v in r["findings_outside_selection"]),
      str(r["findings_outside_selection"]))
check("the selection is named", r["selected_field_labels"] == ["Expiry Date"])

print("\n=== TEST 2 — manufacturer only ===")
r = run(["manufacturer"])
check("only the manufacturer check is selected",
      [n for n, c in r["checks"].items() if c["selected"]] == ["manufacturer_or_packer"])
check("a declared manufacturer scores 100", r["score"] == 100, str(r["score"]))

print("\n=== TEST 3 — MRP only ===")
r = run(["mrp"])
sel = sorted(n for n, c in r["checks"].items() if c["selected"])
check("MRP selects its three related checks",
      sel == ["mrp", "unit_price_consistency", "unit_sale_price"], str(sel))
check("a missing MRP is a finding when asked for",
      any("MRP" in v for v in r["violations"]), str(r["violations"]))
check("scored as non-compliant", r["status"] == "NON_COMPLIANT", str(r["status"]))

print("\n=== TEST 4 — manufacturer + MRP ===")
r = run(["manufacturer", "mrp"])
sel = sorted(n for n, c in r["checks"].items() if c["selected"])
check("both fields' checks are selected",
      sel == ["manufacturer_or_packer", "mrp", "unit_price_consistency", "unit_sale_price"], str(sel))
check("expiry is not among them",
      not r["checks"]["best_before_or_use_by"]["selected"])
check("score is drawn from both", 0 < r["score"] < 100, str(r["score"]))

print("\n=== an unselected failure never becomes a pass ===")
r = run(["expiry_date"])
check("MRP still reports its real status",
      r["checks"]["mrp"]["status"] == baseline["checks"]["mrp"]["status"],
      f'{r["checks"]["mrp"]["status"]} vs {baseline["checks"]["mrp"]["status"]}')
check("and is marked as outside the request",
      r["checks"]["mrp"]["selected"] is False)

print("\n=== a client cannot name a rule ===")
check("unknown names are dropped", normalise_selection(["font_size_readability"]) is None)
check("nothing recognisable widens rather than narrows",
      normalise_selection(["'; DROP TABLE scans; --"]) is None)
check("a valid name beside junk still works",
      normalise_selection(["expiry_date", "rm -rf /"]) == ["expiry_date"])
check("form JSON is accepted", parse_selection('["mrp"]') == ["mrp"])
check("form CSV is accepted", parse_selection("mrp,manufacturer") == ["mrp", "manufacturer"])
check("malformed JSON does not narrow", parse_selection("[not json") is None)

print(f"\n{sum(results)}/{len(results)} passed")
raise SystemExit(0 if all(results) else 1)
