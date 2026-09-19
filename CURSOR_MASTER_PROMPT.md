# Master prompt: Med interaction accessibility app (hackathon)

Paste everything below the line into Cursor as the initial build instruction.

---

## Role
You are building a hackathon web product that helps people understand prescription drug interaction risk in plain language, with strong accessibility (voice, translation, visual explanations) and a one-page doctor export. Implement end-to-end vertical slices. Prefer working demo paths over incomplete breadth. Do not invent clinical facts; all risk data must come from structured sources or clearly cited label text, then be rewritten by the LLM into a fixed schema.

## Product one-liner
User adds 2–10 medications (search or prescription photo). The app cross-checks pairwise interactions, shows severity + plain-English “What happens / How serious / What to do,” visualizes interactions as a graph, can read results aloud (and in other languages), can generate short explainer media, and exports a one-page PDF for a clinician visit.

## Non-negotiable safety rules
- Show a persistent disclaimer: educational only, not medical advice; discuss with a pharmacist/doctor.
- Never let generative models invent interaction severity. Severity comes from DDInter (or equivalent structured pairwise data). LLM only rewrites/explains provided evidence.
- Grok Imagine must only visualize or narrate **already-validated** structured summaries; never invent new interactions in prompts.
- Keep API keys server-side. Do not expose xAI or ElevenLabs keys to the client.
- Log/cache lookups; be respectful of openFDA / RxNorm rate limits.

## Suggested stack (use unless you have a strong reason not to)
- **Frontend:** Next.js (App Router) + TypeScript + Tailwind
- **Backend:** Next.js Route Handlers / server actions
- **Drug identity:** NLM **RxNorm** REST API (normalize brand → ingredient / RxCUI; search-as-you-type)
- **Label evidence:** **openFDA** `https://api.fda.gov/drug/label.json` (fields: `drug_interactions`, `warnings`, `contraindications`, `boxed_warning`; prefer query by `openfda.rxcui`)
- **Pairwise severity:** **DDInter 2.0** open data (download/cache CSV into the repo or load at startup). Use major / moderate / minor / unknown. Do not rely on the discontinued RxNav Interactions API.
- **Plain-English rewrite:** **xAI Grok chat API** with a strict JSON schema output
- **Default TTS + timed speech + optional voice Q&A:** **xAI Grok Voice API** (TTS + Voice Agent)
- **Premium / multilingual / warmer voice TTS:** **ElevenLabs** TTS (`eleven_multilingual_v2` or Flash for latency)
- **Translation:** **Grok chat (LLM)** first; then TTS the translated string (ElevenLabs preferred for non-English playback; Grok Voice OK for English default)
- **Interaction graph:** deterministic library (**Cytoscape.js** or **vis-network** / D3). Not Grok Imagine.
- **Prescription OCR:** Grok multimodal/vision with a strict extraction schema, then RxNorm resolve
- **Calendar refill:** generate downloadable `.ics` first (Google Calendar OAuth is stretch)
- **Doctor export:** client PDF from structured JSON (**@react-pdf/renderer** or jsPDF)
- **Optional media polish:** **Grok Imagine** (image/video) for explainer clips, accessibility story cards, onboarding — driven by validated JSON only

## Feature specs and exact implementation

### 1) Search-as-you-type medication add (2–10 meds)
- UI: search input with debounce (~200–300ms), results list, selected med chips, max 10.
- Server: query RxNorm (`findRxcuiByString` / approximate match as needed). Store `{ name, rxcui, tty?, ingredientName? }` per med.
- Resolve brand names to ingredients for interaction checking when needed.

### 2) Pairwise interaction engine
- For every unordered pair among selected meds:
  - Look up DDInter severity + mechanism/management if available.
  - Fetch openFDA label snippets for supporting evidence (cache by RxCUI / spl_set_id).
- Output structured `InteractionResult[]`: `{ a, b, severity, evidenceSnippets[], sourceIds[] }`.
- If DDInter has no pair, mark `severity: "unknown"` and say so clearly in UI (do not hallucinate major).

### 3) LLM plain-English cards (core product value)
- Call Grok chat with system instructions + the structured interaction + evidence.
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
- Render cards in the UI grouped by severity (major first).

### 4) Visual interaction graph
- Nodes = selected meds; edges = interactions colored by severity.
- Click edge → focus corresponding explanation card.
- Build with Cytoscape/vis-network from the same JSON as the cards. No generative image for the graph itself.

### 5) Prescription photo → schedule fields
- Upload image → vision model extracts strict JSON:
  `{ drugName, strength, doseText, dosesPerDay, daysSupply, quantity, refillDate?, rawSig? }`
- Run `drugName` through RxNorm; let user confirm before adding.
- Offer “Add refill to calendar” via `.ics` (title, start = refillDate, reminder).

### 6) Accessibility: TTS, timed speech, translation, dual voice providers
Implement a server-side voice abstraction:

```ts
speak(text: string, opts: {
  purpose: "read_card" | "timed_prompt" | "voice_agent";
  language: string; // e.g. "en", "es", "fr"
  voicePreference: "default" | "warm";
})
```

**Routing rules (do not blur these):**
- **Grok Voice API**
  - Default English “Read aloud” on cards and summary.
  - Timed/in-flow prompts (e.g. after analysis: “Found 2 moderate interactions…”).
  - Optional Voice Agent: user speaks a question about the *current* med list / results; agent answers using tool/context from already-computed JSON (not free-hallucinated drug knowledge).
- **ElevenLabs TTS**
  - When `voicePreference === "warm"` (more human voice).
  - When `language !== "en"` (multilingual playback after translation).
- **Translation path:** Grok chat translates the card JSON fields into target language → pass translated text into ElevenLabs (or Grok Voice only if you explicitly fall back). ElevenLabs does **not** translate; it only speaks.

UI:
- Play button per card + “Read all”.
- Language picker.
- Voice engine toggle: `Standard (Grok)` vs `Natural (ElevenLabs)` (English); non-English defaults to ElevenLabs when available.

Cache audio by hash(`provider + voiceId + lang + text`) to save quota.

### 7) Grok Imagine (product integration, not just pitch deck)
Add optional actions that consume **validated** summary JSON only:
- “Generate 8s explainer” short video walking through the top interactions in plain language.
- Optional illustrated “What to do” story card image for accessibility.
- Onboarding empty-state visual/video.
Prompts must include the structured bullets verbatim and instruct: do not add drugs or severities not in the input. If time is short, ship a stub button + one working explainer path.

### 8) Export for doctor — one-page PDF
- One page: patient med list, date, flagged pairs with severity, short whatHappens/howSerious/whatToDo, disclaimer, “bring to appointment.”
- Generate from the same JSON as the UI (no second LLM pass required).

## Architecture
```
Client (Next.js)
  → /api/meds/search          (RxNorm)
  → /api/interactions/check   (DDInter cache + openFDA + Grok chat rewrite)
  → /api/ocr/prescription     (Grok vision)
  → /api/tts                  (router → Grok Voice | ElevenLabs)
  → /api/translate            (Grok chat)
  → /api/imagine/explainer    (Grok Imagine)
  → /api/export/pdf           (or client-side PDF from JSON)
```

Persist demo state in memory or localStorage; full auth/DB optional for hackathon.

## Env vars (document in README)
- `XAI_API_KEY` — Grok chat, vision, Voice, Imagine
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID` (warm default)
- `OPENFDA_API_KEY` (optional but recommended)
- Any DDInter data path config

## Build order (follow this)
1. **MVP:** med search (RxNorm) → select 2–10 → pairwise DDInter severity → openFDA evidence → Grok JSON cards → graph → disclaimer.
2. **Voice:** Grok Voice read-aloud + one timed prompt after check.
3. **Dual TTS:** ElevenLabs path + language picker (LLM translate → ElevenLabs speak).
4. **PDF export.**
5. **Prescription OCR + .ics.**
6. **Stretch:** Grok Voice Agent Q&A over current results; Grok Imagine explainer button.

## Acceptance criteria for first demo
- User can add at least Advil (ibuprofen) + warfarin (or similar known pair) via search.
- App shows severity from structured data and plain-English cards.
- Graph renders with severity-colored edges.
- Read aloud works via Grok Voice in English.
- Toggle or language path can speak via ElevenLabs.
- PDF downloads with med list + flagged interactions + disclaimer.
- README explains setup, env vars, and the Grok Voice vs ElevenLabs split.

## Out of scope for v1
- Real clinical decision support claims
- Replacing clinicians
- Using Imagine to draw the interaction graph
- Using ElevenLabs as the translator
- Wiring two full voice-agent stacks (use Grok Voice Agent only)

## Deliverables
1. Runnable Next.js app with the MVP path working against live RxNorm/openFDA and cached DDInter data.
2. Clear modules: `lib/rxnorm.ts`, `lib/openfda.ts`, `lib/ddinter.ts`, `lib/llm.ts`, `lib/tts/grok.ts`, `lib/tts/elevenlabs.ts`, `lib/tts/index.ts`, `lib/imagine.ts`.
3. Short README + `.env.example`.
4. Minimal seed/demo page with sample meds for judges if APIs are slow.

Start by scaffolding the Next.js app, DDInter data load, RxNorm search UI, and the interactions API. Then wire Grok rewrite and the graph. Add TTS only after cards render from real data.

When uncertain, choose the path that preserves medical grounding and ships a demable vertical slice.
