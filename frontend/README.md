# NIRIKSHA — Frontend

**Smart Compliance. Safer India.**

A production-quality frontend for an AI-powered packaged commodity compliance checker.
This app is **frontend only**: no backend, no database, no authentication server, no
network calls. It runs on local demonstration data through a mock service layer that a
real API can replace without touching a single component.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build
npm run preview
```

---

## The workflow the interface communicates

```
UPLOAD / CAPTURE  →  IMAGE QUALITY  →  COMPUTER VISION  →  OCR
      →  FIELD EXTRACTION  →  RULE VALIDATION  →  COMPLIANCE RESULT
      →  REPORT  →  COMPLAINT
```

Three product decisions shape every screen:

1. **The quality gate is real UI, not decoration.** A frame judged unusable blocks the
   workflow and explains which measurement failed. Reading text from an unreadable image
   produces a confident-looking result from nothing.
2. **Requirements are conditional.** Country of origin governs imported packages; best
   before governs perishables. A rule that does not reach a package shows as *Not
   Applicable* with its reason — never as a failure.
3. **A poor reading never becomes an accusation.** Values read at low confidence surface
   as *Needs Review*. "We could not read it" is not the claim "it is not there."

---

## Routes

| Route | Screen |
| --- | --- |
| `/` | Dashboard — 3D hero, workflow strip, overview |
| `/inspect` | Inspection workspace — capture, quality gate, live pipeline |
| `/scan-result` | Extracted declarations with per-field confidence |
| `/compliance` | Compliance analysis with evidence drawers |
| `/reports` | Report preview, print and share |
| `/complaints` | Complaint form, reference number, tracking timeline |
| `/history` | Scan history with search, result and date filters |
| `/how-it-works` | Five-stage explanation |
| `/admin` | Authority console — complaint queue and review drawer |
| `/settings` | Language, accessibility, account, data source |
| `/login` | Sign in |
| `/register` | Create an account |
| `/forgot-password` | Two-step password reset |

---

## Architecture

```
src/
├── components/
│   ├── layout/       AppShell, Sidebar, Topbar, UserMenu, ThemeToggle,
│   │                 AccessibilityMenu, RequireAuth, Brand
│   ├── ui/           Button, Card, StatusPill, Form, Progress, Modal/Drawer,
│   │                 Toast, UploadZone, Timeline, PageHeader, LabelSpecimen
│   ├── 3d/           ProductScene (lazy), HeroVisual, useSceneCapability
│   ├── inspection/   PipelineRail, QualityPanel, FieldTable, ProductSwitcher
│   ├── compliance/   ResultBanner, CheckList (+ evidence drawer)
│   ├── reports/      (report composition lives in pages/Reports)
│   └── complaints/   (complaint form lives in pages/Complaints)
├── pages/            one file per route
├── data/             types.ts · demoProducts.ts · scanHistory.ts ·
│                     complaints.ts · pipeline.ts
├── services/         inspectionService.ts  ← the only I/O boundary
├── engine/           real in-browser pipeline: vision · extraction ·
│                     compliance rules · Tesseract OCR
├── hooks/            useInspection · useAuth · useTheme ·
│                     useAccessibility · useLanguage · useSelectedProduct
├── lib/              cn.ts
└── styles/           index.css (design tokens)
```

### Connecting a backend

Every screen reads through `src/services/inspectionService.ts`. Replace the function
bodies with `fetch` calls; the signatures are the contract:

| Service function | Suggested endpoint |
| --- | --- |
| `analyseQuality(id)` | `POST /api/scans/:id/quality` |
| `runOcr(id)` | `POST /api/scans/:id/ocr` |
| `extractFields(id)` | `POST /api/scans/:id/extract` |
| `runCompliance(id)` | `POST /api/scans/:id/compliance` |
| `listScans()` | `GET /api/scans` |
| `submitComplaint(draft)` | `POST /api/complaints` |
| `updateComplaintStatus()` | `PATCH /api/complaints/:id` |

No component imports from `src/data` for anything the service owns, and the service is
already async with realistic latency, so the interface is built against the timing a real
pipeline has rather than against instant local values.

---

## Design system

Green carries the brand and the console chrome; white carries the work. The three
semantic colours are reserved strictly for compliance meaning and are never used
decoratively:

| Meaning | Token |
| --- | --- |
| Compliant / pass | `--color-pass` |
| Non-compliant / fail | `--color-fail` |
| Needs review | `--color-review` |
| Not applicable | `--color-na` |

`StatusPill` is the single place status becomes colour. Every pill carries an icon and a
text label, so status is never communicated by colour alone.

Type: **Space Grotesk** (display) · **DM Sans** (interface) · **JetBrains Mono**
(identifiers, measurements, provisions). Measurements use tabular numerals.

---

## The 3D scene

`components/3d/ProductScene.tsx` — a packaged commodity under a scanning pass, with its
declaration regions picked out by OCR bounding boxes and data points lifting off the
label. The pack's label is drawn to a canvas texture at runtime, so it carries the same
declarations the interface talks about.

Deliberately small: two meshes, one instanced mesh, two lights, no shadow maps, no
post-processing. It ships in its own chunk (`three-*.js`) and is loaded only after the
device is known to support it.

**Fallbacks, all mandatory:**

- No WebGL context → static SVG figure carrying the same meaning
- `prefers-reduced-motion`, or Reduce Motion in the accessibility menu → static figure
- Viewport under 900px → reduced particle count
- Lazy-loaded via `React.lazy`, so it never blocks first paint

---

## Accounts

Sign in, sign up and password reset are fully built (`src/hooks/useAuth.tsx`).
Accounts live in this browser's `localStorage`; passwords are salted and hashed
with SHA-256 through the Web Crypto API rather than stored in the clear.

**That is a courtesy, not security.** Anything running in the page can read the
store, and a hash computed on the client proves nothing to a server. Real
authentication belongs on the backend — replace the four functions in
`useAuth.tsx` (`signIn`, `signUp`, `signOut`, `resetPassword`) with fetch calls
and nothing above them changes.

- The first account created on a fresh browser becomes an **authority** account
  and gets `/admin`; everyone after is a **citizen**.
- `/admin` is guarded by `RequireAuth`. A frontend guard is a courtesy for the
  user, not a boundary — enforce the same rule on every API call.
- The reset flow says plainly that no email is sent, instead of pretending one
  was. A production system emails a single-use, expiring link.

---

## Light and dark theme

`src/hooks/useTheme.tsx`. The first visit follows the operating system; an
explicit choice then wins and is remembered. The class goes on `<html>` so
portals and dropdowns inherit it, and `color-scheme` is set alongside so native
controls and scrollbars match.

A small sun/moon control sits in the header, and Settings has an explicit
selector. Only the surface and text tokens invert:

- **Compliance colours keep their meaning** and are re-tuned for contrast rather
  than swapped — green still passes, red still fails, amber still needs a person.
- **The console chrome stays forest green** in both themes. It is the brand, not
  a background.
- **Label specimens stay light** in both themes: they represent printed paper.
- Measured in dark mode: inputs 14.9:1, muted text 5.8:1 — both above WCAG AA.

The high-contrast accessibility preference layers on top of whichever theme is
active, rather than replacing it.

---

## Motion

Three pieces, each with an off switch that actually turns it off.

| Piece | File | Behaviour |
| --- | --- | --- |
| Opening title card | `components/ui/SplashScreen.tsx` | The mark lands, then **NIRIKSHA is written out a letter at a time** behind a caret, followed by a sweep line and the tagline. Holds ~2.25 s, then a 0.5 s fade. Once per browser tab, never on navigation. |
| Pointer ring | `components/ui/CursorGlow.tsx` | A soft ring trailing the cursor, growing over anything actionable. |
| Scroll reveal | `components/ui/Reveal.tsx` | Opacity and a small offset as sections enter view. Fires once. |

**The native cursor is deliberately left visible.** Replacing it with a drawn
one costs precision and breaks affordances people rely on — text carets, resize
handles, the system's own high-visibility cursor settings. Poor trade in a tool
meant for inspection work.

**All three stand down** under `prefers-reduced-motion` or the app's own Reduce
Motion switch: the splash never paints, the ring is removed from the document,
and `Reveal` renders its children in their resting state rather than animating
faster. The pointer ring is also skipped entirely on touch devices.

Two implementation notes worth keeping if this code is edited:

- The splash decision is made at **module scope**, not in a `useState`
  initializer. Initializers run twice under React's development double-invoke,
  so a first pass writing the "already seen" flag and a second reading it back
  produces a decision that disagrees with itself.
- Its dismissal timers carry **no "run once" guard**. A guard would let
  StrictMode's cleanup cancel the only timer, leaving the overlay up for good.
- The splash uses **CSS keyframes, not the animation library**. In this build
  the library's *delayed* animations do not reliably start, which left letters
  invisible and the overlay stuck. Native `animation-delay` is deterministic,
  and an overlay covering the whole application must not depend on an animation
  reporting completion. Keyframes live in `styles/index.css` (`nk-rise`,
  `nk-pop`, `nk-sweep`, `nk-caret`).

---

## Accessibility

- Skip-to-content link; visible focus rings throughout
- Keyboard-operable menus, drawers and modals; Escape closes, scroll locks
- ARIA roles on progress, alerts, status regions and switches
- **Accessibility menu** in the header: text size (3 steps), high contrast, reduce motion
  — applied as classes on `<html>`, persisted, and inherited by portals
- **Read result aloud** on the compliance banner, via the browser's speech synthesis,
  including the qualification — a spoken result that dropped the caveat would be a worse
  claim than the written one
- Every route verified free of horizontal overflow at 375px

---

## Honest boundaries

The interface states these itself; they are repeated here so nothing is assumed.

- **Upload genuinely works, in the browser.** An uploaded image is decoded and
  measured for real (variance of the Laplacian for sharpness, clipping for
  glare and shadow, contrast, resolution), recognised by Tesseract compiled to
  WebAssembly, then run through the extraction and rule engine in
  `src/engine/`. No server is involved. Set `VITE_CLIENT_SIDE_OCR=false` once a
  backend OCR endpoint exists.
- **No PDF is generated on a server.** The report screen composes and prints the document
  in the browser, and the Download action says so.
- **No government system is connected.** Complaints are "recorded in the NIRIKSHA
  system", never "sent to authorities". The authority console updates this build only.
- **No legal certification is claimed.** Every result screen carries the automated
  assessment notice, sourced from one component so the wording cannot drift.
- **Rule citations are genuine.** The provisions shown — Rule 6(1)(a) through 6(1)(e),
  Rule 6(2), Rule 6(1)(aa), Rule 6(1)(da), Rule 2(m), Rule 6(11) — are real provisions of
  the Legal Metrology (Packaged Commodities) Rules, 2011. The products are invented.

---

## Demo data

`src/data/demoProducts.ts` holds three products, one per outcome:

| Product | Outcome | What it demonstrates |
| --- | --- | --- |
| Suryodaya Sunflower Oil | Compliant | Every applicable declaration present and correctly formed |
| Grainwell Digestive Biscuits | Non-Compliant | Bare price fails Rule 2(m); no consumer care contact |
| Vanaspati Herbal Shampoo | Needs Review | Low OCR confidence; imported package, origin unresolved |

The third is the important one: it shows the system declining to accuse a product on a
reading it could not trust.
