# Frontend ↔ backend integration

This records how the NIRIKSHA console is wired to the FastAPI backend in
`apps/api`, and where to change things.

---

## The boundary

Everything that touches the network lives in `src/services/`.

| File | Role |
| --- | --- |
| `config.ts` | Reads `VITE_API_BASE_URL`. Empty ⇒ the app runs on local fixtures |
| `backendTypes.ts` | The shapes the API actually returns, written from a real response |
| `nirikshaApi.ts` | The only module that speaks HTTP. Adapts backend shapes into the UI model |
| `inspectionService.ts` | What pages call. Routes to the API, or to fixtures when none is configured |
| `liveInspection.ts` | The in-browser fallback pipeline (Tesseract + local rule pack) |

No component imports `backendTypes` or calls `fetch`. When the API renames a
field, `nirikshaApi.ts` is the only file that changes.

---

## Configuration

```bash
cp .env.example .env.local
```

| Variable | Default | Effect |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:8000` | The API. Empty ⇒ local fixtures |
| `VITE_FORCE_CLIENT_PIPELINE` | `false` | `true` ⇒ recognition and rules run in the browser even with an API configured |

---

## Endpoint map

| Screen | Call | Endpoint |
| --- | --- | --- |
| Inspect → Continue to OCR | `scanProduct(file)` | `POST /product/scan` (multipart, field `file`) |
| History, Dashboard overview | `listScans()` | `GET /scans` |
| History and Dashboard stats | `scanStats()` | `GET /scans/stats` |
| Reopening a past scan | `getScan(id)` | `GET /scans/{id}` |
| Complaints list, Authority queue | `listComplaints()` | `GET /complaints` |
| Complaint form | `createComplaint()` | `POST /complaints` |
| Authority status buttons | `updateComplaintStatus()` | `PATCH /complaints/{id}` |
| Settings connection badge | `checkHealth()` | `GET /health` |

---

## How the pipeline is staged

The backend runs quality analysis, vision parsing, readability and the rule
engine in **one** call and reports no intermediate milestones. The interface
still shows its six-stage rail, and it does so honestly:

1. **The browser measures the image first** (`liveInspection.inspectUpload`).
   This is a real measurement — variance of the Laplacian, clipping, contrast,
   resolution — and it gates the upload. An unreadable photo never costs a
   round trip.
2. **`Continue to OCR` sends the image.** While that single request is in
   flight, every server-side stage shows as *processing* and the progress bar
   goes **indeterminate**, because there is no honest percentage to report.
   Stages are ticked off from the response, never on a guess.
3. **The server's quality verdict wins.** If it returns `RETAKE_REQUIRED` for
   an image the browser passed, the workflow blocks and shows the server's own
   retake guidance.

---

## Shape adaptation

The backend's vocabulary differs from the UI's; `nirikshaApi.ts` maps it.

| Backend | UI |
| --- | --- |
| `COMPLIANT` / `PARTIALLY_COMPLIANT` / `NON_COMPLIANT` | `compliant` / `needs_review` / `non_compliant` |
| check `PASS`, `DETECTED` | `pass` |
| check `FAIL` | `fail` |
| check `WARNING`, `NOT_DETERMINED` | `review` |
| severity `HIGH` / `MEDIUM` / `LOW`,`INFO` | `critical` / `major` / `minor` |
| `image_quality.status: GOOD` with `retake_reason` | `marginal` |
| readability `SMALL` / `UNCLEAR`, or confidence < 70 | field status `needs_review` |

Two mappings are deliberate judgements, not conveniences:

- **`NOT_DETERMINED` becomes `review`, never `fail`.** The backend uses it when
  a requirement's *applicability* is unresolved. That is a question for a
  person, not a finding against the product.
- **A check's `value` may be a string, an object or an array.** `describeValue`
  renders each, dropping null and false entries so "not detected" does not
  appear as noise.

---

## What the backend does not provide

Not faked, not stubbed — the interface says so where it matters.

| Feature | Status |
| --- | --- |
| Authentication | **Missing.** Accounts are in browser `localStorage`; API endpoints are open |
| PDF reports | Missing. The report screen composes and prints in the browser |
| Government routing | Deliberately absent. Complaints live in NIRIKSHA's own database |
| Document-level OCR confidence | Not applicable — the vision model reports confidence per declaration, so the column is hidden rather than shown as 0% |

---

## Backend changes made for integration

Kept to what integration actually required:

- **CORS middleware** (`main.py`) with explicit origins from `ALLOWED_ORIGINS`.
  There was none, so no browser request could succeed.
- **`app/core/config.py`** — settings read in one place.
- **`google-genai` added to `requirements.txt`.** It was imported but never
  listed, so a clean install could not start the app. `pytesseract` was removed:
  nothing imports it, and it needs a system binary.
- **`app/core/database.py` plus `/scans` and `/complaints` routes** — history
  and complaints had no persistence, which left three screens showing invented
  numbers next to real scans.
- **Scan recording** in `/product/scan`, wrapped so a storage failure cannot
  cost the caller their assessment.

No analysis logic was rewritten.
