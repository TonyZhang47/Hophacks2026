# Accessible Prescription Interaction Assistant

**HopHacks 2026 — Bloomberg track.** Help people understand their medications in plain language.

Built end-to-end with **Cursor**. Weekend planning and architecture assisted by **Grok Bot** (team workflow, not a runtime product API).

Someone types or photographs their meds and gets:

- a **plain-English interaction risk summary**
- a **visual graph** of how those drugs interact
- **spoken / translated** explanations (English read-aloud by default)
- optional **timed spoken prompts** in the UI
- live **ask out loud** Q&A
- a **one-page PDF** to bring to a doctor

This is an accessibility product, not a replacement for a pharmacist or clinician. Every screen should say: **confirm with a licensed professional before changing how you take any medicine.**

---

## Why this split of APIs

Use each vendor where it is strongest. Do not run the same job through two models.

| Job | Use | Why |
| --- | --- | --- |
| Read a prescription photo | **Grok vision** (`grok-4.6` with image input) | Structured extraction (drug name, dose, times per day, days supply, refill date) |
| Normalize brand → ingredient | **RxNorm** | "Advil" → ibuprofen. Deterministic, not an LLM guess |
| Search-as-you-type | **openFDA drug label** + RxNorm | Autocomplete against real labels |
| Pairwise severity | **NLM DDInter / DrugBank open data** first; openFDA `drug_interactions` as backup text | Structured minor / moderate / major beats parsing FDA prose |
| "What happens / How serious / What to do" | **Grok 4.6** | The product value is rewriting dense FDA text into short, grounded cards |
| Interaction graph (source of truth) | **Your code** (D3, Cytoscape.js, or vis-network) | Edges come from structured severity, not from an image model |
| Patient-friendly pictures / explainer clips | **Grok Imagine** | Illustrations and short videos for "what this warning looks like in daily life" |
| Default "Read aloud" (English) | **ElevenLabs TTS** (`eleven_multilingual_v2` or `eleven_v3`) | Default language = English; warmer, higher-quality playback than Grok TTS |
| Warmer / non-English read-aloud | **ElevenLabs TTS** | Best quality for multilingual voices; Grok translates cards first, then ElevenLabs speaks |
| Timed spoken prompts (UI toggle) | **ElevenLabs TTS** | Same playback path as read-aloud; off by default |
| Live "ask out loud" Q&A | **Grok Voice** (speech-to-speech) | Real-time conversation with tools: add med, explain pair, export PDF |
| Weekend planning / architecture | **Grok Bot** (outside the product) | Team planning only — not called from the app |
| Optional: transcribe a spoken med list | **ElevenLabs Scribe v2** (Medical if you have it) | Strong STT; Grok Voice already covers live talk, so only add Scribe if you need async transcription |

**Rule of thumb:** Grok thinks, sees, and converses. ElevenLabs speaks polished audio (read-aloud + timed prompts). Imagine *illustrates*; it does not diagnose.

Ship **both** voice vendors with clear jobs: **ElevenLabs = playback**, **Grok Voice = conversation**. Do not expose two competing "TTS" buttons.

---

## Architecture

```
[Web app — built with Cursor]
   camera / type / voice
        |
        v
[API server — keep all vendor keys here]
   1. Vision / text intake     →  Grok 4.6
   2. Normalize names          →  RxNorm
   3. Labels + interactions    →  openFDA + DDInter
   4. Pairwise graph           →  your code
   5. Plain-English cards      →  Grok 4.6 (JSON)
   6. Illustrations            →  Grok Imagine (optional, cache)
   7. Read-aloud + timed prompts →  ElevenLabs (English default; multilingual after Grok translate)
   8. Live ask-out-loud agent  →  Grok Voice (WebSocket + tools)
   9. Calendar .ics + PDF      →  your code
```

Keep xAI and ElevenLabs keys on the server (e.g. `.env.local` for the Cursor-built stack). The browser should never hold them. Never commit secrets.

Suggested stack for a hackathon weekend:

- **Frontend:** Next.js (or Vite + React) — camera upload, graph, PDF preview, language picker, timed-prompts toggle
- **Backend:** Next.js Route Handlers or a small FastAPI/Express app
- **Graph:** Cytoscape.js — nodes = drugs, edges = severity color
- **PDF:** `@react-pdf/renderer` or `pdf-lib`
- **Calendar:** generate a `.ics` file (Google/Apple Calendar import). Do not fight Google Calendar OAuth unless you have spare time.

---

## Feature → implementation

### 1. Photograph a prescription

**Primary: Grok 4.6 vision.** Send the photo plus a strict JSON schema:

```json
{
  "drug_name_raw": "",
  "strength": "",
  "doses_per_day": null,
  "quantity": null,
  "days_supply": null,
  "refill_date": null,
  "sig_text": "",
  "confidence": 0.0,
  "needs_user_confirm": true
}
```

Always show a **confirm screen**. OCR will misread "qd" / "bid" / "prn". After confirm:

- map the name through **RxNorm**
- compute refill reminder → download `.ics` (`BEGIN:VEVENT` on refill date, plus optional daily dose reminders)

**Do not use Imagine here.** Imagine generates pictures; it does not read them.

**ElevenLabs:** skip unless the user *dictates* the bottle instead of photographing it (Scribe), or you read the extracted directions aloud after confirm (TTS).

### 2. Search-as-you-type, 2–10 meds

**RxNorm** (approximate term) for autocomplete, then **openFDA** `/drug/label.json` for the selected product.

Cap at 10 meds so pairwise checks stay fast: `n*(n-1)/2` pairs.

### 3. Cross-check interactions

For every pair `(A, B)`:

1. Look up structured severity in **DDInter** (or a static dump of DrugBank / DDInter you vendor into the repo for the weekend).
2. If missing, pull `drug_interactions` from both openFDA labels and pass that text to Grok with the pair names.
3. Store: `pair`, `severity` (`none | minor | moderate | major | unknown`), `sources[]`.

The **graph** is this table drawn as a network:

- node size = number of edges
- edge color = severity (green / yellow / orange / red)
- click an edge → the plain-English card

That graph must be data-driven. Judges should be able to click red edges and see citations.

### 4. Plain-English cards (core product)

**Grok 4.6** with:

- system prompt: you are a health *explainer*, not a prescriber; never tell the user to stop a drug; always say talk to a clinician/pharmacist; quote or paraphrase only from provided source text
- user payload: pair names, severity, raw FDA / DDInter snippets only (do not let the model browse the open web for dosing advice)
- output JSON:

```json
{
  "what_happens": "",
  "how_serious": "",
  "what_to_do": "",
  "questions_for_doctor": [],
  "citation_ids": []
}
```

This is the feature to demo first. If the LLM step is late, you still have a graph + raw labels.

### 5. Text to speech, translation, read-aloud, timed prompts

Split by mode — both vendors ship; jobs do not overlap:

| Mode | API |
| --- | --- |
| Default "Read this card" / "Read my whole summary" (English) | **ElevenLabs TTS** — one request per card or concatenated summary. Use `eleven_multilingual_v2` (quality) or Flash if you stream. Default UI language = English. |
| Warmer / non-English read-aloud (Spanish, Chinese, etc.) | **Grok 4.6** translates the JSON cards → then **ElevenLabs** speaks. `language_code` on TTS is pronunciation, not translation. Translate first. Better non-English quality than Grok TTS. |
| Timed spoken prompts | **ElevenLabs TTS** — short guidance lines on a delay (see below). Same playback path; not Grok Voice. |
| Live "ask out loud" Q&A | **Grok Voice** speech-to-speech with tools (`search_drug`, `add_med`, `get_pair_card`). Product integration + conversation demo. |
| Pronouncing drug names | ElevenLabs `replace` / pronunciation map |

**Timed spoken prompts (UI toggle, off by default):**

- User can turn this on in settings so demos stay quiet unless enabled.
- After the graph loads, or when a major edge is selected, speak a short prompt on a delay — e.g. *"Tap the red edge to hear what this interaction means."*
- Uses the same ElevenLabs TTS path as read-aloud. Do not route these through Grok Voice.

Grok's own TTS (`POST /v1/tts`) is a backup only if ElevenLabs quota is tight. Prefer not to ship two TTS buttons.

### 6. Visual graph + Imagine

**Must-have graph:** Cytoscape/D3 from structured pairs (section 3). This is the clinical visual.

**Grok Imagine (nice-to-have, high demo value):**

- one **illustration per major interaction** — everyday scene, not a fake anatomical chart (example: "two pill bottles with a caution icon, calm educational style, no fake logos")
- optional **image-to-video** 5–8s explainer for the worst pair
- optional **icon set** for doses-per-day / refill so the UI looks consistent

Never put Imagine output in the doctor PDF as if it were a medical diagram. PDF = med list + severity table + Grok text cards + source names.

Cache Imagine results by `(drug_a, drug_b, locale)` so you do not regenerate on every page load.

### 7. Export for your doctor

Your code, not an LLM layout:

- patient first name (optional)
- date
- med list (brand, ingredient, dose, times/day)
- flagged pairs with severity
- the three-bullet cards
- disclaimer + "generated for discussion, not a diagnosis"

`pdf-lib` or react-pdf. Print-to-PDF is an acceptable fallback if time runs out.

---

## Weekend build order

Ship in this order so you always have a demoable slice.

1. **Med list + RxNorm search** (2–10 drugs)
2. **Pairwise table + colored graph** from DDInter/openFDA
3. **Grok rewrite** into What / Serious / Do
4. **ElevenLabs English "Read summary"** + language toggle (Grok translates, ElevenLabs speaks) + **timed-prompts toggle** (off by default)
5. **PDF export**
6. **Prescription camera + confirm + `.ics`**
7. **Imagine illustrations** for major edges
8. **Grok Voice** live ask-out-loud agent with tools

If you only finish 1–5, you still have the accessibility story (plain language + speech + doctor sheet). 6–8 are the wow features.

---

## Data and safety

- Treat all model output as **unverified**. Show source snippets (openFDA section, DDInter severity) next to the rewrite.
- Do not store prescription photos longer than the request unless the user opts in.
- Do not give "stop taking X" instructions in prompts or UI copy.
- HIPAA: a hackathon demo is not a covered system. Do not collect real patient identifiers. Use sample labels in the recorded demo.

Useful endpoints:

- openFDA labels: `https://api.fda.gov/drug/label.json`
- RxNorm REST: `https://rxnav.nlm.nih.gov/REST/`
- DDInter: NLM / academic pairwise dataset (download a snapshot; do not scrape at request time)
- xAI Imagine: [docs.x.ai Imagine](https://docs.x.ai/developers/model-capabilities/imagine)
- xAI Voice / TTS: [Text to speech](https://docs.x.ai/developers/model-capabilities/audio/text-to-speech), [Speech to speech](https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech)
- ElevenLabs TTS: [Text to speech](https://elevenlabs.io/docs/overview/capabilities/text-to-speech)

Environment variables (never commit these; use `.env.local` for Cursor local runs):

```
XAI_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
OPENFDA_API_KEY=   # optional but higher rate limit
```

---

## What "done" looks like for judging

A volunteer (or judge) can:

1. Add 3–4 common meds (or photograph a sample Rx)
2. See a graph with at least one highlighted interaction
3. Hear the summary in English (default), then optionally in another language
4. Download a one-page PDF

**Stretch demo beats:**

5. Toggle **timed spoken prompts** on and hear a delayed UI prompt
6. **Ask a question out loud** via Grok Voice (e.g. "What should I ask my doctor?")

That loop is the product. Everything else is polish.
