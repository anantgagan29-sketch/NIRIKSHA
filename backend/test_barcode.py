"""Barcode validation, GS1 prefixes, and the product directory's contract."""
import os, sys
os.environ["REQUIRE_AUTH"] = "false"
sys.path.insert(0, os.getcwd())

from app.api.routes.barcode import gs1_check_digit, issuing_region, lookup, BarcodeRequest
from app.services import product_directory

passed = failed = 0
def check(name, ok, detail=""):
    global passed, failed
    passed += ok; failed += (not ok)
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"  -- {detail}"))

print("=== check digits ===")
check("a real EAN-13 validates", gs1_check_digit("890105800019") == 1)
check("a mistyped digit fails", gs1_check_digit("890103086527") != 8)

print("\n=== GS1 prefixes ===")
check("890 is India", issuing_region("8901058000191") == "India")
check("49 is Japan", issuing_region("4902201746007") == "Japan")
check("a short code has no region", issuing_region("12") is None)

print("\n=== the endpoint never fails the caller ===")
r = lookup(BarcodeRequest(barcode=""))
check("an empty code is answered, not raised", r["valid"] is False and r["found"] is False)

r = lookup(BarcodeRequest(barcode="8901030865278"))
check("a bad check digit is reported as misread",
      r["valid"] is False and "check digit" in (r["reason"] or ""), str(r))
check("a misread code is not looked up", r["found"] is False)

print("\n=== the directory is asked, and its answer is passed on as such ===")
real = {
    "product_name": "Test Biscuits", "brand": "Testco", "quantity": "200 g",
    "image_url": None, "countries": ["India"],
    "source": product_directory.SOURCE, "source_url": "https://example.test/p",
}
product_directory.identify = lambda code: (real, None)
r = lookup(BarcodeRequest(barcode="8901058000191"))
check("a found product is named with its source",
      r["found"] and r["product_name"] == "Test Biscuits" and r["source"] == product_directory.SOURCE, str(r))
check("the directory's quantity is passed through for checking", r["quantity"] == "200 g")
check("the message says to check it against the pack", "against the pack" in r["message"], r["message"])

product_directory.identify = lambda code: (None, "unreachable")
r = lookup(BarcodeRequest(barcode="8901058000191"))
check("an unreachable directory is not a failed scan",
      r["valid"] and r["found"] is False and "could not be reached" in r["message"], str(r))

product_directory.identify = lambda code: (None, None)
r = lookup(BarcodeRequest(barcode="8901058000191"))
check("no record found says so plainly",
      r["found"] is False and "No product record" in r["message"], str(r))
check("the code is still validated and placed", r["valid"] and r["issuing_region"] == "India")

print(f"\n{passed}/{passed+failed} passed")
sys.exit(1 if failed else 0)
