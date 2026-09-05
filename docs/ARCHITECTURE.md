# NIRIKSHA — architecture and deployment

Compliance screening for packaged commodities against the Legal Metrology
(Packaged Commodities) Rules, 2011.

This document describes how the system is put together, what each part is
responsible for, where the data lives, and — because it matters more here than
in most software — what the system deliberately does not claim.

---

## 1. The shape of it

```
                    browser
   ┌──────────────────────────────────────────┐
   │  React + TypeScript (Vite)               │
   │                                          │
   │  camera / upload ─┐                      │
   │  barcode scanner ─┤                      │
   │                   ├─► quality gate       │  rejects a frame too poor
   │                   │   (canvas, on device)│  to be worth reading
   │                   │                      │
   │  report exporters │  offline fallback:   │
   │  PDF / DOCX / PNG │  Tesseract + the     │
   │  (loaded on demand)│  same rule pack     │
   └───────────┬──────────────────────────────┘
               │  HTTPS, Bearer <Supabase access token>
               ▼
   ┌──────────────────────────────────────────┐
   │  FastAPI (Python)                        │
   │                                          │
   │  auth      verifies the token against    │
   │            Supabase's published JWKS     │
   │  vision    Gemini, eight models in a     │
   │            cascade                       │
   │  rules     Legal Metrology engine        │
   │  Rule 7    letter-height assessment      │
   │  storage   scans, complaints, images     │
   └───────┬──────────────────────┬───────────┘
           │                      │
           ▼                      ▼
   ┌───────────────┐      ┌──────────────────┐
   │ Supabase      │      │ Google Gemini    │
   │  Auth (users) │      │  vision models   │
   │  Postgres     │      └──────────────────┘
   │  (scans,      │
   │   complaints, │
   │   images)     │
   └───────────────┘
```

Three hosted pieces: the interface on Vercel, the API on Render, and Supabase
for accounts and the database. Nothing else is stateful.

---

## 2. What each part is responsible for

### Frontend — `frontend/`

React 19, TypeScript, Vite, Tailwind. A single-page application; every screen
reads its data through one service layer (`src/services/`) so the components
never know whether an answer came from the API, the browser engine or a
fixture.

| Area | Module |
|---|---|
| Inspection state machine | `hooks/useInspection.ts` |
| API client, auth headers | `services/nirikshaApi.ts` |
| Accounts and roles | `hooks/useAuth.tsx` |
| In-browser fallback pipeline | `services/liveInspection.ts`, `engine/` |
| Report model and exporters | `services/report/`, `services/reportPdf.ts` |

The in-browser engine is a genuine second implementation, not a mock: Tesseract
compiled to WebAssembly, plus the same rule pack in TypeScript. It runs when no
API is configured or when every hosted model has spent its allowance, and the
result says so on screen rather than passing itself off as an ordinary reading.

### Backend — `backend/`

FastAPI, chosen for validation at the boundary: a malformed request is refused
by Pydantic before it reaches the rules engine.

| Area | Module |
|---|---|
| Token verification | `app/core/auth.py` |
| Vision cascade | `app/services/ai_provider.py` |
| Declaration extraction | `app/services/product_parser.py` |
| Legal Metrology rules | `app/api/routes/compliance.py` |
| Rule 7 lettering | `app/services/letter_height.py` |
| Image quality | `app/services/image_quality_service.py` |
| Storage | `app/core/database.py` |

---

## 3. How one scan flows

```
photograph
   │
   ├─ quality gate ──────────► too poor? RETAKE_REQUIRED, no model is called
   │
   ├─ fingerprint ───────────► identical image seen before? answer from cache
   │
   ├─ vision cascade ────────► first model that answers; exhausted ones skipped
   │                            all refuse? the browser reads it instead
   │
   ├─ declarations extracted ► temperature 0, so the same photo reads the same
   │                            way twice; fields the model could not read are
   │                            returned as null rather than recalled
   │
   ├─ rules engine ──────────► 15 checks, each citing its provision
   │
   ├─ Rule 7 lettering ──────► applicable minimum from Table I or II;
   │                            a measured pack width turns pixels into mm
   │
   └─ recorded ──────────────► scan, verdicts and photograph, against the
                                authenticated user
```

### The vision cascade

Eight Gemini models are tried in order, fastest first. Each has its own daily
free-tier allowance, so the day's capacity is the sum rather than one model's.
A model reporting exhausted quota is set aside for an hour instead of being
asked again on the next scan; a per-model timeout stops one slow model
consuming the request's whole budget.

### The rules engine

`compliance.py` encodes the requirements rather than asking a model whether
something is compliant. Every verdict names the provision it was tested
against, so a reader can check the reasoning:

Rule 6(1)(a) manufacturer · 6(1)(aa) country of origin · 6(1)(b) generic name ·
6(1)(c) net quantity · 6(1)(d) date of manufacture · 6(1)(da) best before ·
6(1)(e) retail sale price · 6(1)(f) · 6(2) consumer care · 6(11) unit sale
price · Rule 7 lettering · Rule 26(a) small-package exemptions.

Rule 26(a) matters as much as the rest: a requirement that does not apply is
marked not applicable, not counted as a failure.

### Rule 7 — lettering

Two questions, deliberately separated.

**Which requirement applies** is a legal question, answered from the declared
net quantity (Table I) or the principal display panel's area (Table II). No
measurement is needed, so it is stated even when nothing else can be.

**Whether the print meets it** is a physical question about millimetres on
cardboard. A photograph carries pixels. Supply a measured pack width and the
conversion exists; leave it blank and every height finding is REVIEW with the
requirement stated and physical verification recommended. Print that is
already too short is a FAIL — the characters inside a block can be no taller
than the block. Print that is tall enough stays under review, because a block
tall enough proves nothing about the characters in it.

---

## 4. Data

### Where it lives

| Data | Store | Why |
|---|---|---|
| Accounts, sessions, roles | Supabase Auth | Password hashing, reset email and session refresh are not worth reimplementing |
| Scans, verdicts, photographs | Supabase Postgres | Survives a deploy; the host's free disk does not |
| Complaints and their audit trail | Supabase Postgres | Same |
| Result cache | Backend disk | Rebuildable; losing it costs one API call |

### Schema

```sql
scans (
  id             TEXT PRIMARY KEY,   -- NIR-2026-00001
  created_at     TEXT NOT NULL,
  filename, product_name, net_quantity, scan_status, status, score,
  result_json    TEXT NOT NULL,      -- the whole assessment, replayable
  user_id        TEXT,               -- `sub` of a verified token
  scan_event_id  TEXT,               -- one user action
  image_bytes    BYTEA,              -- the photograph the findings are about
  image_mime     TEXT
)

complaints        (id, scan_id, product, violation_type, description,
                   location, contact, status, created_at, updated_at)
complaint_events  (complaint_id, status, note, created_at)   -- append-only

UNIQUE INDEX ON scans (scan_event_id) WHERE scan_event_id IS NOT NULL
```

Two of these carry the design:

`scan_event_id` makes recording a scan **idempotent**. The client names the
action; a retry or a double submit returns the reference already issued rather
than a second row. Scanning the same pack again deliberately is a different
action and gets its own record — the identity is the event, never the product.

`complaint_events` is **append-only**. A status change adds a row; it never
edits one. In an enforcement context the history of a complaint is part of the
record.

### The photograph

Stored in the row beside the assessment it justifies, downscaled to 1024 px
and EXIF-corrected. Kept there rather than in a directory because a report
opened a week later has nothing to show otherwise, and because it is then
scoped by exactly the same query as the assessment.

---

## 5. Security

**Authentication.** The browser holds a Supabase session and sends its access
token. The API verifies the signature against Supabase's published JWKS
(ES256), checks expiry and audience, and takes the user id from the `sub`
claim. No endpoint accepts a user id as a parameter — an identifier a caller
can type is one a caller can change.

**Authorisation.** Every read of a scan, its statistics and its photograph is
scoped to that verified id. A null owner is a scope of its own, not a
wildcard: there is no argument to those queries that returns everybody's
history. Another user's reference answers 404 rather than 403, so the API does
not confirm which references exist.

**Roles.** `citizen` and `authority`, held in Supabase `user_metadata`. This is
editable by the account holder, so it decides what the interface offers, not
what the data allows. Enforcement is the owner scoping above. Anything that
must be a real boundary belongs in `app_metadata` or a profiles table with
row-level security.

**Secrets.** The Gemini key and the database URL are environment variables on
the host, never committed. The Supabase anon key is public by design. No
service-role key exists in any client.

---

## 6. Deployment

| Component | Host | Configuration |
|---|---|---|
| Frontend | Vercel | `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Backend | Render | `render.yaml`; `GEMINI_API_KEY`, `DATABASE_URL`, `ALLOWED_ORIGINS`, `SUPABASE_URL` |
| Auth + database | Supabase | Google provider; redirect URLs |

Both hosts deploy from `main` on push. The backend is described by
`render.yaml`, so its build and start commands live in the repository rather
than in a dashboard someone has to remember.

### Order

The backend first: the frontend needs its URL, and the backend needs the
frontend's origin for CORS. Deploy the API, then the interface, then set
`ALLOWED_ORIGINS` to the interface's address.

### Operational notes

- **The free instance sleeps** after fifteen idle minutes and takes about a
  minute to start. The application pings it on load and retries a connection
  failure rather than reporting the service as down.
- **`/health/processing`** reports which store is in use, which models are
  available and which are resting, and why — for operating the system, not for
  the interface.
- **`DATABASE_URL` unset** falls back to a local SQLite file. That is for
  development. On a deployment it means scans are written to a disk that is
  wiped on the next deploy, so the endpoint above reports it as not durable.

---

## 7. What this system does not claim

NIRIKSHA is an AI-assisted preliminary assessment. It is not a statutory
inspection and not a government certification, and every report says so.

- It verifies what a label **declares**, not whether the declaration is true.
  Confirming a net quantity needs a weighing scale, not a camera.
- **Rule 7 heights** cannot be established from an unscaled photograph. Without
  a measured pack width the finding is REVIEW, never a guess.
- **Placement** of declarations on the principal display panel is not assessed.
- **E-commerce listings** are not read; the system works from images.
- A field read at low confidence is reported as needing review, never as a
  failure. "We could not read it" is a different claim from "it is not there",
  and the engine keeps them apart.
