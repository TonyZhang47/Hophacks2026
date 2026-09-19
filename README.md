# RxPlain

**HopHacks 2026 — [Bloomberg] Most Philanthropic Hack.** A free public-good tool so people shut out by dense medication labels can **understand** what they’re taking — in plain language they can see, hear, and share.

Built with **Cursor**. Planning assisted by **Grok Bot** (team workflow only — not a runtime API).

### Why this is philanthropy (not healthcare)
Medication labels and interaction text are written for professionals. That excludes millions of people with **low health literacy**, **vision or reading barriers**, **cognitive load**, or **limited English comfort with medical jargon**. RxPlain’s goal is **equitable access to understanding** — a social-good accessibility project — **not** diagnosing, prescribing, or replacing care.

We are **not** submitting as a healthcare/clinical product. Public drug databases are only the grounding so explanations stay honest; the product value is **inclusion**.

**Who it helps:** older adults, caregivers, people with low literacy or vision barriers, and anyone who leaves a pharmacy unsure what their bottles mean — so they can ask better questions of a pharmacist or doctor.

Someone searches for their meds (2–10) and gets:

- a **plain-language** summary of possible interaction warnings (literacy access)
- a **simple visual map** instead of a wall of label text
- **spoken read-aloud** via Grok Voice (vision / auditory access)
- a **one-page share sheet** they can bring to an appointment or show a caregiver (advocacy access)

This is an **educational accessibility** product, not medical advice and not a clinical decision tool. Every screen should say: **confirm with a licensed professional before changing how you take any medicine.**

**UI accessibility baseline (MVP):** large readable type, high contrast, keyboard-usable search and actions, visible focus states, severity not conveyed by color alone (include text labels), and a persistent disclaimer. Voice is a core path, not a gimmick.

For the full Cursor build instruction, see [`CURSOR_MASTER_PROMPT.md`](CURSOR_MASTER_PROMPT.md).

**Legal:** [Privacy Policy](PRIVACY.md) · [Terms and Conditions](TERMS.md) — link both in the app footer; include a short consent line on first use (educational demo only).

---

## API split (keep it simple)

Use each source for one job. Do not add a second vendor for the same job.

| Job | Use | Why |
| --- | --- | --- |
| Persist interactions + caches | **Snowflake** (via Next.js `/api/*` only) | DDInter pairs, RxNorm/openFDA cache, optional card/session cache |
| Search / normalize brand → ingredient | **RxNorm** (+ Snowflake `DRUG_CACHE`) | Deterministic RxCUI; cache to cut rate limits |
| Pairwise severity | **Snowflake `INTERACTIONS`** (seeded from DDInter) | Structured major / moderate / minor / unknown |
| Label evidence snippets | **openFDA** (+ cache in Snowflake) | Cite real label text next to the rewrite |
| Plain-English cards | **Grok chat** (optional `CARD_CACHE`) | Rewrite provided evidence into fixed JSON |
| Interaction graph | **Cytoscape.js** | Same JSON as cards; not a generative image |
| Read aloud + timed prompt + live Q&A (stretch) | **Grok Voice** | One voice stack for the whole product |
| Share sheet PDF | **Your code** | One-page handout for a caregiver or appointment — not a clinical chart |

**Rule of thumb:** Browser talks only to our APIs. APIs talk to Snowflake + RxNorm/openFDA/Grok. Structured data in Snowflake decides severity. No ElevenLabs. No second TTS.

---

## Architecture

```
[Next.js on Vercel — browser]
   search meds
        |
        v
[Route Handlers — keys + Snowflake stay here]
   1. Search / normalize     →  RxNorm → optional Snowflake DRUG_CACHE
   2. Pairwise severity      →  Snowflake INTERACTIONS (DDInter seed)
   3. Evidence snippets      →  openFDA → optional cache
   4. Plain-English cards    →  Grok chat → optional CARD_CACHE
   5. Graph                  →  Cytoscape.js (client, from API JSON)
   6. Read aloud             →  Grok Voice
   7. Share-sheet PDF        →  your code
   8. Optional session       →  Snowflake DEMO_SESSIONS (anonymous)

Stretch (only after MVP works):
   - Grok Voice Agent over current results
   - Prescription photo → Grok vision → confirm → RxNorm
   - One non-English language (Grok translate → Grok Voice)
   - One Grok Imagine explainer image for a validated major pair
```

Stack: Next.js App Router + TypeScript + Tailwind + **Snowflake** (server-only). No user login. No real PHI in the database.

### Snowflake tables (MVP)

| Table | Stores |
| --- | --- |
| `INTERACTIONS` | Seeded DDInter pairs + severity |
| `DRUG_CACHE` | RxCUI / name / label snippets |
| `CARD_CACHE` | Optional Grok card JSON by pair |
| `DEMO_SESSIONS` | Optional anonymous med list + results |

All DB reads/writes happen inside `/api/*` via `lib/snowflake.ts`.

---

## MVP (must ship)

### 1. Search-as-you-type
RxNorm autocomplete, med chips, max 10 drugs.

### 2. Pairwise check + graph
Query Snowflake `INTERACTIONS` for every pair. openFDA snippets as evidence (live or cache). Graph: nodes = meds, edge color = severity. Click edge → card. Missing pairs = `unknown`, never invent “major.”

### 3. Plain-English cards
Grok rewrites **only** provided severity + evidence into:

```json
{
  "what_happens": "",
  "how_serious": "",
  "what_to_do": "",
  "questions_for_doctor": [],
  "citation_ids": []
}
```

Health explainer for access, not a prescriber. Never “stop taking X.” Always suggest talking with a pharmacist or doctor.

### 4. Grok Voice read-aloud (core access path)
English “Read this card” / “Read all” as primary actions on results. Optional one timed prompt after analysis. Short sentences; explain jargon. No language picker and no second TTS vendor in MVP.

### 5. Share-sheet PDF
Med list, flagged pairs, short card text, disclaimer, “questions to ask.” Same JSON as the UI. Educational handout — not a medical record. Print-to-PDF is an acceptable fallback.

---

## Stretch (only if MVP is demoable)

1. **Grok Voice Agent** — ask about the current med list / cards; answers from computed JSON only  
2. **Rx photo OCR** — Grok vision → user confirm → add via RxNorm  
3. **One other language** — Grok translates, Grok Voice speaks  
4. **Grok Imagine** — one illustration for the top major pair from validated JSON (never for the graph or PDF as a “medical diagram”)

---

## Explicitly out of scope

- ElevenLabs (or any second TTS/STT)
- Dual voice toggles / multi-provider TTS router
- Scribe / dictate-a-bottle
- DrugBank as a parallel severity source
- Google Calendar OAuth (`.ics` only if leftover time)
- User accounts / login / HIPAA productization
- Client-side Snowflake access or exposing warehouse credentials
- Storing real patient identifiers in Snowflake
- Using Imagine to invent interactions or draw the clinical graph

---

## Weekend build order

1. Scaffold Next.js + RxPlain header + disclaimer + footer (Privacy / Terms)  
2. Snowflake helper + seed `INTERACTIONS`  
3. RxNorm search + med list (`/api/meds/search`)  
4. Pairwise check via Snowflake + openFDA (`/api/interactions/check`)  
5. Grok cards + Cytoscape graph  
6. Grok Voice read-aloud  
7. Share-sheet PDF export  
8. Seed demo meds + deploy to Vercel (with Snowflake env vars)  
9. Stretch only after 1–8 work  

If you finish 1–7, you have the full philanthropy / accessibility story for judges.

---

## Data and safety

- Model output is **unverified** — show DDInter severity and openFDA snippets beside rewrites.
- Do not store prescription photos longer than the request (if you add OCR).
- Do not collect real patient identifiers. Use sample meds in the recorded demo.
- Never instruct the user to change how they take a medicine.
- Full details: [Privacy Policy](PRIVACY.md) and [Terms and Conditions](TERMS.md).

Useful endpoints:

- openFDA labels: `https://api.fda.gov/drug/label.json`
- RxNorm REST: `https://rxnav.nlm.nih.gov/REST/`
- DDInter: download a snapshot into the repo; do not scrape at request time
- xAI Voice: [Text to speech](https://docs.x.ai/developers/model-capabilities/audio/text-to-speech), [Speech to speech](https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech)
- xAI Imagine (stretch): [docs.x.ai Imagine](https://docs.x.ai/developers/model-capabilities/imagine)

Environment (never commit; use `.env.local` / Vercel):

```
XAI_API_KEY=
OPENFDA_API_KEY=              # optional but higher rate limit
SNOWFLAKE_ACCOUNT=
SNOWFLAKE_USERNAME=
SNOWFLAKE_PASSWORD=
SNOWFLAKE_WAREHOUSE=
SNOWFLAKE_DATABASE=
SNOWFLAKE_SCHEMA=
SNOWFLAKE_ROLE=               # optional
```

---

## What “done” looks like for judging

**Track:** Bloomberg Most Philanthropic Hack — help people / improve lives + technical difficulty + polish.

**Pitch order (keep it philanthropy, not healthcare):**
1. Who is excluded today (literacy, vision, cognitive load)  
2. What RxPlain gives them for free (plain language, voice, visual map, share sheet)  
3. Quick live demo of that loop  
4. Brief grounding (public data + AI rewrite) — do **not** lead with “drug interaction checker” or clinical accuracy claims  

Demo checklist:

1. Add 3–4 common meds via search (seed pair ready if APIs are slow)  
2. See a graph with text-labeled severity (not color alone)  
3. Hear the English summary via Grok Voice as a primary action  
4. Download a one-page share sheet  

**Stretch beats:** ask a question out loud about the current results; optional Rx photo; optional one other language.

That **access loop** is the product. Everything else is polish.
