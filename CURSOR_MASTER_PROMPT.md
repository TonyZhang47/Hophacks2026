# Master prompt: RxPlain (Bloomberg Most Philanthropic Hack)

Paste everything below the line into Cursor as the initial build instruction.

---

## Role
You are building **RxPlain** for HopHacks **[Bloomberg] Most Philanthropic Hack**. This is a **social-good / equity** product, **not** a healthcare or clinical decision-support app.

**Problem (philanthropy):** dense medication labels exclude people with low health literacy, vision or reading barriers, and high cognitive load. That is an access and inclusion problem.

**Solution:** free plain-language summaries, a simple visual map, Grok Voice read-aloud, and a one-page share sheet people can show a caregiver or bring to a pharmacist/doctor visit.

Implement end-to-end vertical slices. Prefer a working demo path over incomplete breadth. Do not invent clinical facts; severity comes from structured data; the LLM only rewrites provided evidence into a fixed schema.

## Product one-liner
**RxPlain** helps people who can’t use medical jargon understand possible medication interaction warnings: add 2–10 meds → pairwise severity from DDInter → plain-language cards → visual map → Grok Voice read-aloud → share-sheet PDF. Brand **RxPlain** in the UI header, PDF title, and disclaimer.

**Pitch & UI rules (critical):**
- Lead with **who is left out** and **equitable access to understanding**.
- Call it an **educational accessibility / public-good** tool — never “AI doctor,” “clinical checker,” or “healthcare platform.”
- Do **not** compete narratively with the Healthcare track. Public APIs (RxNorm, openFDA, DDInter) are evidence grounding, not the product story.
- **Accessibility is the product.** Design for literacy, vision, cognitive load, and self-advocacy.

## Non-negotiable safety + accessibility rules
- Persistent disclaimer: educational only, not medical advice; discuss with a pharmacist/doctor.
- Never let generative models invent interaction severity. Severity comes from DDInter (cached open data). LLM only rewrites/explains provided evidence.
- Keep API keys and **Snowflake credentials** server-side. Never expose `XAI_API_KEY` or Snowflake secrets to the client.
- Cache lookups; respect openFDA / RxNorm rate limits.
- Never tell the user to start, stop, or change a medicine.
- **A11y baseline:** large type, high contrast, keyboard access, visible focus, severity labeled in text (not color-only), semantic headings/buttons, read-aloud as a primary action on results.
- **Legal:** Ship footer links to Privacy Policy and Terms (`/privacy`, `/terms` pages that render [`PRIVACY.md`](PRIVACY.md) / [`TERMS.md`](TERMS.md) content, or static routes). Short first-run note: educational demo, not medical advice, see Terms.
- **Copy tone:** “share sheet,” “plain language,” “hear this,” “questions to ask” — avoid clinic/EHR/CDS language.

## Stack (do not expand without a strong reason)
- **Frontend:** Next.js (App Router) + TypeScript + Tailwind
- **Backend:** Next.js Route Handlers (**only** place that talks to Snowflake or vendor APIs)
- **Database:** **Snowflake** — interaction data, lookup caches, optional anonymous demo sessions. Browser never gets Snowflake credentials.
- **Drug identity / search:** NLM **RxNorm** REST (live); cache hits in Snowflake when possible
- **Label evidence:** **openFDA** `drug/label.json`; cache snippets in Snowflake by RxCUI
- **Pairwise severity:** **DDInter** loaded into Snowflake tables (not a giant CSV parse on every request)
- **Plain-English rewrite:** **xAI Grok** chat with strict JSON output; optionally cache card JSON in Snowflake by pair hash
- **Voice (all of it):** **xAI Grok Voice** — English read-aloud, optional one timed prompt, optional live Q&A stretch
- **Interaction graph:** **Cytoscape.js** from the same JSON as the cards (not Imagine)
- **Share-sheet export:** client or server PDF from structured JSON (`@react-pdf/renderer` or `pdf-lib`) — labeled as a handout, not a medical record
- **Hosting:** **DigitalOcean App Platform** (GitHub → autodeploy). Secrets encrypted in App Platform env vars + local `.env.local`
- **Optional DO extras (stretch only):** Spaces for cached Imagine assets; skip Droplets/Managed DB — Snowflake is the database

**Do not use:** ElevenLabs, Scribe, DrugBank as a second severity source, Google Calendar OAuth, user auth / real patient DB, dual TTS routers, pronunciation maps, or Grok Imagine in MVP. Do not query Snowflake from the browser. Do not put secrets in `NEXT_PUBLIC_*`.

## Snowflake data model (keep small)

Access Snowflake **only** from server modules (`lib/snowflake.ts`) used by Route Handlers.

| Table | Purpose |
| --- | --- |
| `INTERACTIONS` | DDInter pairs: `drug_a`, `drug_b`, `severity`, `mechanism?`, `management?`, `source` |
| `DRUG_CACHE` | RxNorm/openFDA cache: `rxcui`, `name`, `ingredient_name`, `label_snippets`, `fetched_at` |
| `CARD_CACHE` | Optional: `pair_hash`, `card_json`, `created_at` (avoid re-calling Grok for same pair) |
| `DEMO_SESSIONS` | Optional anonymous: `session_id`, `meds_json`, `results_json`, `updated_at` (no real names/PHI) |

Seed `INTERACTIONS` once (script or SQL) from a DDInter snapshot. Prefer warehouse suspend / small warehouse for hackathon cost.

**API rule:** Client → `/api/*` → `lib/snowflake.ts` (SQL) and/or live RxNorm/openFDA/Grok. Never expose connection strings, keys, or raw SQL to the client.

## MVP feature specs (ship these)

### 1) Search-as-you-type (2–10 meds)
- Debounced search (~250ms) → RxNorm → selected med chips, max 10.
- Store `{ name, rxcui, ingredientName? }` per med.

### 2) Pairwise interaction engine
- For every unordered pair: query Snowflake `INTERACTIONS` for DDInter severity; attach openFDA evidence (live or `DRUG_CACHE`).
- Output `InteractionResult[]`: `{ a, b, severity, evidenceSnippets[], sourceIds[] }`.
- If no row → `severity: "unknown"`. Never hallucinate major.

### 3) LLM plain-English cards
- Grok chat: system = health explainer, not prescriber; only use provided evidence.
- Force JSON per pair:
  ```json
  {
    "drugA": "",
    "drugB": "",
    "severity": "major|moderate|minor|unknown",
    "whatHappens": "",
    "howSerious": "",
    "whatToDo": "",
    "askYourClinician": "",
    "citations": []
  }
  ```
- Render cards grouped by severity (major first).

### 4) Interaction graph
- Nodes = meds; edges = interactions colored by severity.
- Click edge → focus matching card.
- Built from the same JSON as the cards.

### 5) English read-aloud (Grok Voice) — core accessibility path
- Play on a card and “Read all” for the summary; place controls where they are obvious (not buried).
- One optional timed prompt after analysis (e.g. “Found 2 moderate interactions. Tap a red edge to hear more.”) — hard-coded or simple toggle; do not build a settings system for this.
- No second TTS vendor. No language picker in MVP.
- Cards use short sentences and everyday words; avoid medical jargon unless immediately explained.

### 6) Share-sheet PDF
- One page from the same JSON: med list, date, flagged pairs, short card text, disclaimer, “questions to ask.”
- Title it as an educational handout / share sheet — not a clinical chart.
- No second LLM pass for layout.

## Stretch only (after MVP works end-to-end)
Do these in order; skip freely if time is short:

1. **Grok Voice Agent** — user asks about the *current* results; agent answers from already-computed JSON only (tools optional; no free-hallucinated drug knowledge).
2. **Prescription photo OCR** — Grok vision → confirm → RxNorm add. No `.ics` required unless leftover time.
3. **One language** (e.g. Spanish): Grok translates card text → Grok Voice speaks. Still no ElevenLabs.
4. **Grok Imagine** — one “Generate explainer image” for the top major pair from validated JSON only. Never use Imagine for the graph or severity.

## Architecture
```
Client (Next.js on DigitalOcean App Platform) — no DB credentials
  → /api/meds/search          (RxNorm; write-through DRUG_CACHE in Snowflake)
  → /api/interactions/check   (Snowflake INTERACTIONS + openFDA + Grok rewrite; optional CARD_CACHE)
  → /api/tts                  (Grok Voice)
  → /api/export/pdf           (or client-side PDF from JSON)
  → /api/sessions  (optional) (anonymous DEMO_SESSIONS in Snowflake)

Stretch:
  → /api/ocr/prescription     (Grok vision)
  → /api/voice/agent          (Grok Voice Agent over current JSON / session)
  → /api/imagine/explainer    (Grok Imagine, optional)
```

**Infra split:** DigitalOcean hosts the app; Snowflake holds interaction data + caches. All Snowflake access goes through Route Handlers + `lib/snowflake.ts`. No user accounts; no real PHI in `DEMO_SESSIONS`.

Deploy: connect the GitHub repo to **App Platform**, enable autodeploy from `main`, set encrypted env vars (XAI + Snowflake + openFDA). Optional `.do/app.yaml` for reproducible deploy.

## Env vars
```
XAI_API_KEY=
OPENFDA_API_KEY=              # optional but recommended
SNOWFLAKE_ACCOUNT=
SNOWFLAKE_USERNAME=
SNOWFLAKE_PASSWORD=           # or key-pair / PAT — prefer least privilege
SNOWFLAKE_WAREHOUSE=
SNOWFLAKE_DATABASE=
SNOWFLAKE_SCHEMA=
SNOWFLAKE_ROLE=               # optional
```

Document in README + `.env.example`. Never commit secrets.

## Build order (follow this)
1. Scaffold Next.js + Tailwind; RxPlain header + disclaimer banner; footer links to Privacy + Terms.
2. `lib/snowflake.ts` connection helper + create/seed `INTERACTIONS` (and empty cache tables).
3. RxNorm search UI + med chips (`/api/meds/search`, optional cache write).
4. Pairwise check via Snowflake + openFDA evidence (`/api/interactions/check`).
5. Grok JSON cards + Cytoscape graph (optional `CARD_CACHE`).
6. Grok Voice read-aloud (+ one timed prompt if easy).
7. Share-sheet PDF export.
8. Seed demo page (e.g. ibuprofen + warfarin) for judges; deploy to **DigitalOcean App Platform** with Snowflake + XAI env vars.
9. Stretch items only after 1–8 work.

## Acceptance criteria (first demo)
- Pitch/UI lead with **philanthropy**: who is excluded → free plain language / voice / visual / share sheet. Do not pitch as a healthcare app.
- Add Advil (ibuprofen) + warfarin (or similar) via search.
- Severity from Snowflake-backed DDInter; plain-language cards from Grok.
- Graph with severity-colored edges **and** text labels; click edge → card.
- English read-aloud via Grok Voice as a primary control on results.
- Share-sheet PDF downloads with med list + flagged pairs + disclaimer.
- Keyboard can complete the main path; focus states visible.
- Interaction lookups go through `/api/*` → Snowflake (not client-side DB).
- App is reachable on a DigitalOcean App Platform URL for judges.
- README: setup, env vars, DigitalOcean + Snowflake + Grok-only voice, philanthropy + accessibility focus.

## Out of scope for v1
- ElevenLabs or any second TTS/STT vendor
- Dual voice-engine toggles / TTS abstraction for multiple providers
- Multilingual UI (unless stretch #3)
- Live Voice Agent before MVP works
- Imagine-driven graphs or invented interactions
- Clinical decision support claims; Healthcare-track positioning; replacing clinicians
- Google Calendar OAuth; HIPAA productization; user accounts / login
- Client-side Snowflake drivers or exposing warehouse credentials
- Storing real patient identifiers in Snowflake

## Deliverables
1. Runnable Next.js app branded **RxPlain**: MVP path against live RxNorm/openFDA + Snowflake-hosted DDInter.
2. Modules: `lib/snowflake.ts`, `lib/rxnorm.ts`, `lib/openfda.ts`, `lib/interactions.ts`, `lib/llm.ts`, `lib/tts/grok.ts`, `lib/pdf.ts`.
3. Short README + `.env.example` + Privacy Policy + Terms + SQL seed for `INTERACTIONS` + optional `.do/app.yaml`.
4. Seed/demo meds if APIs are slow.
5. App routes or pages for `/privacy` and `/terms` (footer linked).
6. Live DigitalOcean App Platform deploy for the science-fair demo.

Start by scaffolding Next.js, Snowflake connection + seeded `INTERACTIONS`, RxNorm search UI, and the interactions API. Then wire Grok rewrite and the graph. Add Grok Voice only after cards render from real data. PDF next. Stretch last.

When uncertain, choose the path that preserves medical grounding and ships a demoable vertical slice.
