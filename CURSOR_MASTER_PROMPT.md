# Master prompt: RxPlain (hackathon)

Paste everything below the line into Cursor as the initial build instruction.

---

## Role
You are building **RxPlain**, an **accessibility-first** hackathon web product. The core problem is access: people cannot use dense drug-label language. RxPlain turns structured interaction data into plain language, a visual graph, Grok Voice read-aloud, and a one-page doctor PDF. Implement end-to-end vertical slices. Prefer a working demo path over incomplete breadth. Do not invent clinical facts; severity comes from structured data; the LLM only rewrites provided evidence into a fixed schema.

## Product one-liner
**RxPlain** makes medication interactions accessible in plain language: user adds 2–10 meds via search → pairwise severity from DDInter → plain-language cards → visual graph → Grok Voice read-aloud → PDF for a clinician visit. Brand **RxPlain** in the UI header, PDF title, and disclaimer.

**Accessibility is the product**, not a feature add-on. Design for literacy, vision, cognitive load, and appointment advocacy. Pitch and UI copy should lead with access, then show the clinical grounding.

## Non-negotiable safety + accessibility rules
- Persistent disclaimer: educational only, not medical advice; discuss with a pharmacist/doctor.
- Never let generative models invent interaction severity. Severity comes from DDInter (cached open data). LLM only rewrites/explains provided evidence.
- Keep API keys server-side. Never expose `XAI_API_KEY` to the client.
- Cache lookups; respect openFDA / RxNorm rate limits.
- Never tell the user to start, stop, or change a medicine.
- **A11y baseline:** large type, high contrast, keyboard access, visible focus, severity labeled in text (not color-only), semantic headings/buttons, read-aloud as a primary action on results.
- **Legal:** Ship footer links to Privacy Policy and Terms (`/privacy`, `/terms` pages that render [`PRIVACY.md`](PRIVACY.md) / [`TERMS.md`](TERMS.md) content, or static routes). Short first-run note: educational demo, not medical advice, see Terms.

## Stack (do not expand without a strong reason)
- **Frontend:** Next.js (App Router) + TypeScript + Tailwind
- **Backend:** Next.js Route Handlers
- **Drug identity / search:** NLM **RxNorm** REST only (normalize brand → ingredient / RxCUI)
- **Label evidence:** **openFDA** `drug/label.json` (cache by RxCUI)
- **Pairwise severity:** **DDInter** CSV cached in the repo (major / moderate / minor / unknown)
- **Plain-English rewrite:** **xAI Grok** chat with strict JSON output
- **Voice (all of it):** **xAI Grok Voice** — English read-aloud, optional one timed prompt, optional live Q&A stretch
- **Interaction graph:** **Cytoscape.js** from the same JSON as the cards (not Imagine)
- **Doctor export:** client or server PDF from structured JSON (`@react-pdf/renderer` or `pdf-lib`)
- **Hosting:** Vercel; secrets in `.env.local` / Vercel env

**Do not use:** ElevenLabs, Scribe, DrugBank as a second severity source, Google Calendar OAuth, auth/DB, dual TTS routers, pronunciation maps, or Grok Imagine in MVP.

## MVP feature specs (ship these)

### 1) Search-as-you-type (2–10 meds)
- Debounced search (~250ms) → RxNorm → selected med chips, max 10.
- Store `{ name, rxcui, ingredientName? }` per med.

### 2) Pairwise interaction engine
- For every unordered pair: look up DDInter severity; attach openFDA evidence snippets when available.
- Output `InteractionResult[]`: `{ a, b, severity, evidenceSnippets[], sourceIds[] }`.
- If DDInter has no pair → `severity: "unknown"`. Never hallucinate major.

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

### 6) Doctor PDF
- One page from the same JSON: med list, date, flagged pairs, short card text, disclaimer.
- No second LLM pass for layout.

## Stretch only (after MVP works end-to-end)
Do these in order; skip freely if time is short:

1. **Grok Voice Agent** — user asks about the *current* results; agent answers from already-computed JSON only (tools optional; no free-hallucinated drug knowledge).
2. **Prescription photo OCR** — Grok vision → confirm → RxNorm add. No `.ics` required unless leftover time.
3. **One language** (e.g. Spanish): Grok translates card text → Grok Voice speaks. Still no ElevenLabs.
4. **Grok Imagine** — one “Generate explainer image” for the top major pair from validated JSON only. Never use Imagine for the graph or severity.

## Architecture
```
Client (Next.js)
  → /api/meds/search          (RxNorm)
  → /api/interactions/check   (DDInter cache + openFDA + Grok rewrite)
  → /api/tts                  (Grok Voice)
  → /api/export/pdf           (or client-side PDF from JSON)

Stretch:
  → /api/ocr/prescription     (Grok vision)
  → /api/voice/agent          (Grok Voice Agent over current JSON)
  → /api/imagine/explainer    (Grok Imagine, optional)
```

Demo state: memory or localStorage. No auth/DB.

## Env vars
```
XAI_API_KEY=
OPENFDA_API_KEY=   # optional but recommended
```

Document in README + `.env.example`. Never commit secrets.

## Build order (follow this)
1. Scaffold Next.js + Tailwind; RxPlain header + disclaimer banner; footer links to Privacy + Terms.
2. RxNorm search UI + med chips.
3. DDInter load + pairwise check + openFDA evidence.
4. Grok JSON cards + Cytoscape graph.
5. Grok Voice read-aloud (+ one timed prompt if easy).
6. PDF export.
7. Seed demo page (e.g. ibuprofen + warfarin) for judges.
8. Stretch items only after 1–7 work on Vercel.

## Acceptance criteria (first demo)
- Pitch/UI lead with accessibility (plain language, voice, visual, PDF handoff).
- Add Advil (ibuprofen) + warfarin (or similar) via search.
- Severity from DDInter; plain-language cards from Grok.
- Graph with severity-colored edges **and** text labels; click edge → card.
- English read-aloud via Grok Voice as a primary control on results.
- PDF downloads with med list + flagged pairs + disclaimer.
- Keyboard can complete the main path; focus states visible.
- README: setup, env vars, Grok-only voice, accessibility focus.

## Out of scope for v1
- ElevenLabs or any second TTS/STT vendor
- Dual voice-engine toggles / TTS abstraction for multiple providers
- Multilingual UI (unless stretch #3)
- Live Voice Agent before MVP works
- Imagine-driven graphs or invented interactions
- Clinical decision support claims; replacing clinicians
- Google Calendar OAuth; HIPAA productization; user accounts

## Deliverables
1. Runnable Next.js app branded **RxPlain**: MVP path against live RxNorm/openFDA + cached DDInter.
2. Modules: `lib/rxnorm.ts`, `lib/openfda.ts`, `lib/ddinter.ts`, `lib/llm.ts`, `lib/tts/grok.ts`, `lib/pdf.ts`.
3. Short README + `.env.example` + Privacy Policy + Terms.
4. Seed/demo meds if APIs are slow.
5. App routes or pages for `/privacy` and `/terms` (footer linked).

Start by scaffolding Next.js, DDInter data load, RxNorm search UI, and the interactions API. Then wire Grok rewrite and the graph. Add Grok Voice only after cards render from real data. PDF next. Stretch last.

When uncertain, choose the path that preserves medical grounding and ships a demoable vertical slice.
