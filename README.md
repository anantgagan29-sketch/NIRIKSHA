# NIRIKSHA

AI-assisted compliance screening for packaged commodities, against the Legal
Metrology (Packaged Commodities) Rules, 2011.

Photograph a product label; the declarations on it are read, normalised, and
tested against the requirements that apply to that package. The result says
what was found, what it was tested against, and — where the reading was not
confident enough to be sure — says that instead of guessing.

> NIRIKSHA is a decision-support tool. It is not a statutory inspection and it
> is not a government certification. Findings need confirmation by a person.

```
frontend/   React + Vite interface
backend/    FastAPI service: vision, rules engine, storage
docs/       Architecture and deployment
```

How the system is put together, where the data lives, and what it deliberately
does not claim: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Running it locally

Two terminals. The backend first, because the frontend looks for it.

**Backend**

```bash
cd backend
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
echo "GEMINI_API_KEY=your-key-here" > .env
./.venv/bin/python -m uvicorn main:app --port 8000
```

**Frontend**

```bash
cd frontend
npm install
cp .env.example .env.local     # points at http://localhost:8000
npm run dev -- --port 5180
```

Open http://localhost:5180.

Without `.env.local` the interface starts on built-in demonstration data
rather than calling the backend — it looks like it is working, so it is worth
knowing which of the two you are looking at.

`.env` is git-ignored. The key belongs there and in the host's environment
settings — never in the frontend, and never committed.

---

## Deploying

The frontend is a static build and goes anywhere. The backend is a Python
service and needs a Python host. These instructions use Vercel and Render,
both of which have a free tier.

Deploy the **backend first**: the frontend needs its URL, and the backend
needs the frontend's origin, so one of them has to go first and be told about
the other afterwards.

### 1. Push to GitHub

```bash
git init
git add -A
git commit -m "NIRIKSHA"
git branch -M main
git remote add origin https://github.com/<you>/niriksha.git
git push -u origin main
```

### 2. Backend on Render

1. render.com → **New** → **Web Service** → connect the repository.
2. Render reads `render.yaml`, so the build and start commands are already
   set. Confirm **Root Directory** is `backend`.
3. Under **Environment**, add:
   - `GEMINI_API_KEY` — your key.
   - `ALLOWED_ORIGINS` — leave empty for now; step 4 supplies it.
4. Deploy. The first build takes a few minutes. When it finishes, open
   `https://<your-service>.onrender.com/health` — it should return
   `{"status":"healthy"}`.

### 3. Frontend on Vercel

1. vercel.com → **Add New** → **Project** → the same repository.
2. Set **Root Directory** to `frontend`. `vercel.json` covers the rest.
3. Add an environment variable:
   - `VITE_API_BASE_URL` = `https://<your-service>.onrender.com`
4. Deploy.

`VITE_API_BASE_URL` is not optional here. Vite reads it at build time, and
with it unset the deployed site quietly runs on demonstration data instead of
calling your API — everything appears to work, and none of it is real. If a
scan returns a result instantly and always says the same thing, this is why.

### 4. Let the backend accept the frontend

Back in Render, set `ALLOWED_ORIGINS` to the Vercel URL, for example
`https://niriksha.vercel.app`, and redeploy.

This is not a formality. The backend names the origins it will answer, rather
than allowing any site to call it, so until it knows the frontend's address
the browser blocks every request as a CORS failure.

### 5. Check it end to end

Open the deployed site, go to **Inspect Product**, and upload a label. A real
scan takes twenty to sixty seconds and returns declarations read from your
image. If it answers instantly, the frontend is on demonstration data — go
back to step 3.

---

## Configuration

Everything below has a working default; set them only to change behaviour.

**Backend** (`backend/.env` locally, environment settings on the host)

| Name | Default | What it does |
|---|---|---|
| `GEMINI_API_KEY` | — | Required. Vision model access. |
| `ALLOWED_ORIGINS` | localhost origins | Origins the API answers. Comma-separated. |
| `AI_MODELS` | eight models, fastest first | Tried in order. Each carries its own daily free-tier allowance, so several models means a day's use does not end with the first. |
| `ENABLE_READABILITY` | `false` | A second vision call per scan, adding per-declaration confidence. Off halves the API requests an inspection costs. |
| `SCAN_CACHE_ENABLED` | `true` | Identical images are answered from the store rather than sent again. |
| `GEMINI_TIMEOUT_SECONDS` | `70` | Whole-request budget for the vision stage. |
| `PER_MODEL_TIMEOUT_SECONDS` | `22` | One model's slice, so a slow model cannot consume the budget and leave the rest untried. |

**Frontend** (`frontend/.env.local`, environment settings on the host)

| Name | Default | What it does |
|---|---|---|
| `VITE_API_BASE_URL` | *empty* | Where the API lives. **Empty means no backend**: the interface runs on built-in demonstration data instead of calling one. |
| `VITE_FORCE_CLIENT_PIPELINE` | `false` | Forces on-device OCR and rules, ignoring the backend. |

---

## What happens when the vision service is unavailable

Quota runs out, and models have slow days. The inspection does not stop:

```
image → cache hit? → result, no API request
      ↓ miss
   first model that answers, exhausted ones skipped
      ↓ none answer
   the device reads the label itself: OCR → fields → the same rules
```

A model that reports exhausted quota is set aside rather than asked again on
the next scan. Nothing is invented along the way — when a field cannot be read
confidently it is reported for review, never passed or failed on a guess.

---

## Things worth knowing

- **The camera needs HTTPS.** Deployed, this is handled. Testing on a phone
  over a `192.168.x.x` address will not work; `localhost` is exempt.
- **Render's free tier sleeps** after about fifteen minutes idle, and the next
  request waits roughly fifty seconds for it to wake. Before a demonstration,
  open the site once to wake it.
- **The free tier's disk is temporary.** The scan history and the result cache
  are cleared on restart or redeploy. Attach a persistent disk, or a hosted
  database, if that history needs to survive.
- **There is no authentication.** Every endpoint is open. The accounts in the
  interface are stored in the browser and are not a security boundary.

---

## Tests

```bash
cd backend && ./.venv/bin/python test_ai_provider.py
./.venv/bin/python test_date_normalizer.py
./.venv/bin/python test_compliance_dates.py
./.venv/bin/python test_compliance_rules.py
```

```bash
cd frontend && npx tsc --noEmit -p tsconfig.app.json && npm run build
```
