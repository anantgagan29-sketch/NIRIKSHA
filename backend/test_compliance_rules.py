"""
Rule behaviour: exemptions, unverified provisions, and grading.

These guard the property the checker must have — it may report what it can
substantiate, and must not turn uncertainty into a finding of breach.
"""

from app.api.routes.compliance import ComplianceRequest, check_compliance


def run(product):
    return check_compliance(ComplianceRequest(product_info=product))


def check(name, condition, detail=""):
    print(f"{'PASS' if condition else 'FAIL'}  {name}")
    if not condition and detail:
        print(f"        {detail}")
    return bool(condition)


FULL = {
    "product_name": "Namkeen Mixture",
    "manufacturer": "Test Foods Pvt Ltd",
    "address": "Plot 4, Industrial Area, Pune 411001",
    "mrp": "Rs. 45 (inclusive of all taxes)",
    "net_quantity": "200 g",
    "consumer_care_phone": "1800-123-4567",
    "consumer_care_email": "care@testfoods.example",
    "manufacturing_date": "MFD 12/08/2026",
}

results = []

print("=== unverified provisions never fail ===")
r = run(FULL)
usp = r["checks"]["unit_sale_price"]
results.append(check("Rule 6(11) absent -> NOT_DETERMINED, not FAIL",
                     usp["status"] == "NOT_DETERMINED", f"{usp['status']}"))
results.append(check("Rule 6(11) absence raises no violation",
                     "Unit sale price not detected." not in r["violations"], str(r["violations"])))
results.append(check("scope caveat is stated in the citation",
                     "not verified" in usp["rule"], usp["rule"]))
results.append(check("a fully declared pack grades COMPLIANT",
                     r["status"] == "COMPLIANT" and r["score"] == 100,
                     f"{r['status']} {r['score']}"))

print("\n=== Rule 26(a) small-package exemption ===")
small = {"product_name": "Sachet", "net_quantity": "8 g"}
r = run(small)
results.append(check("8 g package is recognised as exempt",
                     bool(r["exemptions"]), str(r["exemptions"])))
results.append(check("exempt package raises no declaration violations",
                     r["violations"] == [], str(r["violations"])))
results.append(check("suppressed checks become NOT_DETERMINED, not PASS",
                     all(r["checks"][n]["status"] == "NOT_DETERMINED"
                         for n in r["exemptions"][0]["suppressed_checks"]),
                     str({n: r["checks"][n]["status"] for n in r["exemptions"][0]["suppressed_checks"]})))
results.append(check("exemption is not reported as compliance",
                     "not a finding of compliance" in r["exemptions"][0]["note"]))
results.append(check("the exemption is cited",
                     "26(a)" in r["exemptions"][0]["rule"], r["exemptions"][0]["rule"]))

r_ml = run({"product_name": "Sample", "net_quantity": "10 ml"})
results.append(check("10 ml is at the threshold and exempt", bool(r_ml["exemptions"])))

r_over = run({"product_name": "Pack", "net_quantity": "11 g"})
results.append(check("11 g is over the threshold and not exempt",
                     not r_over["exemptions"] and r_over["violations"] != [],
                     str(r_over["exemptions"])))

r_kg = run({"product_name": "Pack", "net_quantity": "1 kg"})
results.append(check("1 kg is not exempt", not r_kg["exemptions"]))

r_unknown = run({"product_name": "Pack"})
results.append(check("unreadable quantity is not treated as exempt",
                     not r_unknown["exemptions"]))

print("\n=== citations are specific ===")
r = run(FULL)
expected = {
    "manufacturer_or_packer": "6(1)(a)",
    "generic_product_name": "6(1)(b)",
    "net_quantity": "6(1)(c)",
    "manufacturing_date": "6(1)(d)",
    "best_before_or_use_by": "6(1)(da)",
    "mrp": "6(1)(e)",
    "consumer_care_details": "6(2)",
    "country_of_origin": "6(1)(aa)",
}
for name, provision in expected.items():
    rule = r["checks"][name]["rule"]
    results.append(check(f"{name} cites Rule {provision}", provision in rule, rule))

print("\n=== context-awareness ===")
results.append(check("country of origin absent -> review, not failure",
                     r["checks"]["country_of_origin"]["status"] == "NOT_DETERMINED"))
results.append(check("best before absent -> review, not failure",
                     run({**FULL, "expiry_date": None})["checks"]["best_before_or_use_by"]["status"]
                     == "NOT_DETERMINED"))

print(f"\n{sum(results)}/{len(results)} passed")
raise SystemExit(0 if all(results) else 1)
