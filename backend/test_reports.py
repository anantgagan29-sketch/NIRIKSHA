"""The report-generation record: validated language, owned scans, history."""
import os, sys, tempfile
os.environ["DATABASE_URL"] = ""
os.environ["DATABASE_PATH"] = os.path.join(tempfile.mkdtemp(), "t.db")
os.environ["REQUIRE_AUTH"] = "false"
sys.path.insert(0, os.getcwd())

from fastapi.testclient import TestClient
from main import app
from app.core import database

passed = failed = 0
def check(name, ok, detail=""):
    global passed, failed
    passed += ok; failed += (not ok)
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"  -- {detail}"))

client = TestClient(app)
database.init_db()
scan = {"scan_status": "SUCCESS", "filename": "x.jpg", "product": {"product_name": "Tata Salt", "net_quantity": "500 g"},
        "compliance": {"overall_status": "COMPLIANT", "score": 100}}
scan_id = database.record_scan(scan, None, None, None)

r = client.get("/reports/languages")
check("language list is served", r.status_code == 200 and any(l["code"] == "ur" for l in r.json()["languages"]))

r = client.post(f"/reports/{scan_id}/generate", json={"language": "hi", "format": "pdf"})
check("hindi pdf recorded", r.status_code == 200 and r.json()["language"] == "hi", r.text)
check("record names the template and says the client renders it",
      r.json().get("templateVersion") and r.json().get("download") == "client", r.text)

r = client.post(f"/reports/{scan_id}/generate", json={"language": "xx", "format": "pdf"})
check("unknown language refused with 422", r.status_code == 422, r.text)
r = client.post(f"/reports/{scan_id}/generate", json={"language": "en", "format": "exe"})
check("unknown format refused with 422", r.status_code == 422, r.text)
r = client.post("/reports/NOPE/generate", json={"language": "en"})
check("unknown scan is 404", r.status_code == 404, r.text)

client.post(f"/reports/{scan_id}/generate", json={"language": "ta", "format": "docx"})
r = client.get(f"/reports/{scan_id}")
check("both generations listed, newest first",
      [x["language"] for x in r.json()["items"]] == ["ta", "hi"], r.text)

rows = client.get("/scans").json()["items"]
check("history row carries the latest report language",
      next(x for x in rows if x["id"] == scan_id)["report_language"] == "ta", str(rows[:1]))

print(f"\n{passed}/{passed+failed} passed")
sys.exit(1 if failed else 0)
