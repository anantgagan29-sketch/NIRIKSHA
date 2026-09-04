"""
Compliance behaviour for the date declarations.

The point of these cases is that a pack which declares its dates in a less
formal way is still compliant. Each scenario below previously produced a
failure or a missing declaration.
"""

from app.api.routes.compliance import ComplianceRequest, check_compliance

BASE = {
    "product_name": "Namkeen Mixture",
    "brand": "Test Brand",
    "manufacturer": "Test Foods Pvt Ltd",
    "address": "Plot 4, Industrial Area, Pune 411001",
    "mrp": "Rs. 45 (inclusive of all taxes)",
    "net_quantity": "200 g",
    "consumer_care_phone": "1800-123-4567",
    "consumer_care_email": "care@testfoods.example",
}


def run(label, extra, expect_date_status, expect_bb_status, expect_in_message=None):
    product = {**BASE, **extra}
    result = check_compliance(ComplianceRequest(product_info=product))
    date_check = result["checks"]["manufacturing_date"]
    bb = result["checks"]["best_before_or_use_by"]

    ok = date_check["status"] == expect_date_status and bb["status"] == expect_bb_status
    if expect_in_message:
        ok = ok and expect_in_message.lower() in bb["message"].lower()

    print(f"{'PASS' if ok else 'FAIL'}  {label}")
    if not ok:
        print(f"        date: {date_check['status']} {date_check['value']!r} — {date_check['message']}")
        print(f"        b/b : {bb['status']} {bb['value']!r} — {bb['message']}")
    return ok


results = []
print("=== date declarations ===")

results.append(run("MFG + EXP (formal labels)",
    {"manufacturing_date": "MFG 12/08/2026", "expiry_date": "EXP 31/10/2027"},
    "PASS", "DETECTED"))

results.append(run("MFD only",
    {"manufacturing_date": "MFD: 12/08/2026"}, "PASS", "NOT_DETERMINED"))

results.append(run("PKD only — packing date satisfies Rule 6(1)(d)",
    {"other_dates": ["PKD: 12/08/2026"]}, "PASS", "NOT_DETERMINED"))

results.append(run("Packed On only",
    {"packing_date": "Packed On 01/03/2026"}, "PASS", "NOT_DETERMINED"))

results.append(run("Date of Packing only",
    {"other_dates": ["Date of Packing: 01/03/2026"]}, "PASS", "NOT_DETERMINED"))

results.append(run("Use By recognised as expiry",
    {"manufacturing_date": "MFD 12/08/2026", "expiry_date": "Use By 31/10/2027"},
    "PASS", "DETECTED"))

results.append(run("Best Before as a duration from PKD",
    {"other_dates": ["PKD: 12/08/2026", "Best Before 6 Months from PKD"]},
    "PASS", "DETECTED", "satisfies the best-before declaration"))

results.append(run("Best Before as an absolute date",
    {"manufacturing_date": "MFD 12/08/2026", "best_before": "Best Before 08/2027"},
    "PASS", "DETECTED"))

results.append(run("no dates at all is still a failure",
    {}, "FAIL", "NOT_DETERMINED"))

results.append(run("unreadable date goes to review, not failure",
    {"manufacturing_date": "MFD: <smudged>"}, "NOT_DETERMINED", "NOT_DETERMINED"))

print("\n=== derived best-before date ===")
r = check_compliance(ComplianceRequest(product_info={**BASE, "other_dates": ["PKD: 12/08/2026", "Best Before 6 Months from PKD"]}))
msg = r["checks"]["best_before_or_use_by"]["message"]
ok = "12/02/2027" in msg and "calculated, not printed" in msg
print(f"{'PASS' if ok else 'FAIL'}  PKD 12/08/2026 + 6 months -> 12/02/2027, marked as derived")
if not ok:
    print("        ", msg)
results.append(ok)

print("\n=== no regression in overall grading ===")
full = check_compliance(ComplianceRequest(product_info={**BASE, "other_dates": ["PKD: 12/08/2026", "Best Before 6 Months from PKD"]}))
ok = full["status"] in ("COMPLIANT", "PARTIALLY_COMPLIANT") and full["score"] >= 50
print(f"{'PASS' if ok else 'FAIL'}  well-declared pack scores {full['score']} ({full['status']})")
results.append(ok)

bare = check_compliance(ComplianceRequest(product_info={"product_name": "Unknown"}))
ok = bare["status"] == "NON_COMPLIANT"
print(f"{'PASS' if ok else 'FAIL'}  bare pack still NON_COMPLIANT ({bare['score']})")
results.append(ok)

print(f"\n{sum(results)}/{len(results)} passed")
raise SystemExit(0 if all(results) else 1)
