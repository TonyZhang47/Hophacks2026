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
- a **dose explainer** — "take 1 tablet, twice a day, with food" — that only restates the directions on their own bottle after checking them against the official label, and **fails closed** (no number shown) if it can't verify (safety)
- **click-to-listen** on every card, dose line, and clinic result via Grok Voice, with ElevenLabs as a fallback for languages Grok Voice doesn't cover (vision / auditory / language access)
- a **Community** tab: nearby low-cost clinics with an honest insurance signal, plus anonymous peer talk about medications and side effects with the most-mentioned terms on top (rural / isolation access)
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
| Dose explainer retrieval | **Snowflake Cortex Search** over `LABEL_SECTIONS` (openFDA `dosage_and_administration` / `overdosage`) | RAG so the LLM can only quote official label text |
| Dose ceiling check | **`DOSE_LIMITS`** (DrugCentral / FDA max daily dose snapshot) | Independent second check; "no row" = cannot verify, not OK |
| Interaction graph | **Cytoscape.js** | Same JSON as cards; not a generative image |
| Read aloud + STT + live Q&A (stretch) | **Grok Voice** (primary) | TTS 20 languages, STT 24, realtime agent |
| Read aloud in languages Grok Voice lacks, or Grok outage | **ElevenLabs** `eleven_v3` / `scribe_v2` (secondary) | 70+ / 90+ languages; chosen by a 3-line server router, never a user picker |
| Nearby clinics | **HRSA health-center sites + CMS Rural Health Clinic** seeds in Snowflake; **NPPES** live for refresh | Lat/long, phone, program-rule coverage (Medicaid/Medicare/sliding fee) |
| Community posts + top terms | **Snowflake** `COMMUNITY_POSTS` + Grok moderation | Anonymous, moderated, word counts via SQL |
| Share sheet PDF | **Your code** | One-page handout for a caregiver or appointment — not a clinical chart |

**Rule of thumb:** Browser talks only to our APIs. APIs talk to Snowflake + RxNorm/openFDA/HRSA/NPPES/Grok/ElevenLabs. Structured data in Snowflake decides severity. Dose numbers come only from the person's own directions and quoted label text — every number is checked server-side before it is shown or spoken. Grok Voice first; ElevenLabs only as fallback.

---

## Architecture

```
[Next.js on DigitalOcean App Platform — browser]
   search meds
        |
        v
[Route Handlers — keys + Snowflake stay here]
   1. Search / normalize     →  RxNorm → optional Snowflake DRUG_CACHE
   2. Pairwise severity      →  Snowflake INTERACTIONS (DDInter seed)
   3. Evidence snippets      →  openFDA → optional cache
   4. Plain-English cards    →  Grok chat → optional CARD_CACHE
   5. Graph                  →  Cytoscape.js (client, from API JSON)
   6. Dose explainer         →  Cortex Search (LABEL_SECTIONS) + DOSE_LIMITS + Grok rewrite + guardrails (fail closed)
   7. Read aloud (everywhere)→  /api/tts router: Grok Voice → ElevenLabs fallback by language
   8. Community: clinics     →  Snowflake CLINICS + ZIP_CENTROIDS (haversine) + CLINIC_CONFIRMATIONS
   9. Community: med talk    →  Snowflake COMMUNITY_POSTS + Grok moderation + top-terms SQL
  10. Share-sheet PDF        →  your code
  11. Optional session       →  Snowflake DEMO_SESSIONS (anonymous)

Stretch (only after MVP works):
   - Grok Voice Agent over current results (Grok STT; ElevenLabs Scribe only for uncovered languages)
   - Prescription photo → Grok vision → confirm → dose explainer
   - More languages (Grok translate with number placeholders → Grok Voice or ElevenLabs)
   - NPPES / CMS clinician enrichment for clinics
   - One Grok Imagine explainer image for a validated major pair
```

**Infra:** **DigitalOcean App Platform** hosts the Next.js app (GitHub autodeploy). **Snowflake** is the database. Stack: Next.js App Router + TypeScript + Tailwind. No user login. No real PHI in the database.

### Snowflake tables (MVP)

| Table | Stores |
| --- | --- |
| `INTERACTIONS` | Seeded DDInter pairs + severity |
| `DRUG_CACHE` | RxCUI / name / label snippets |
| `LABEL_SECTIONS` | openFDA label sections by RxCUI for RAG (Cortex Search service `LABEL_SEARCH`) |
| `DOSE_LIMITS` | Max daily dose per ingredient (DrugCentral / FDA snapshot) |
| `CLINICS` + `ZIP_CENTROIDS` | HRSA + CMS RHC sites with lat/long, phone, program-rule coverage flags |
| `CLINIC_CONFIRMATIONS` | Community "I called, they take ___" counts (no identity) |
| `COMMUNITY_POSTS` | Anonymous moderated posts + side-effect tags |
| `CARD_CACHE` | Optional Grok card JSON by pair |
| `DEMO_SESSIONS` | Optional anonymous med list + results |

All DB reads/writes happen inside `/api/*` via `lib/snowflake.ts`.

### DigitalOcean deploy
- Create App from the GitHub repo; autodeploy `main`
- Set encrypted App Platform env vars (same as `.env.local`)
- Optional `.do/app.yaml` for a repeatable app spec
- Do **not** use DigitalOcean Managed DB for MVP — Snowflake already holds data
- Stretch only: Spaces for media cache if Imagine ships

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

### 4. Click-to-listen everywhere (core access path)
One `<ListenButton>` on every card, the dose explainer, each clinic result, and the community summary. `/api/tts` routes to **Grok Voice** first; falls back to **ElevenLabs** only when the language isn't in Grok's list or Grok errors. English + Spanish selector in MVP. Optional one timed prompt after analysis. Short sentences; explain jargon. No user-facing voice-vendor picker.

### 5. Dose explainer (low risk tolerance)
Person enters the directions on their own bottle → Grok parses to a schema → they confirm → server retrieves the official `dosage_and_administration` / `overdosage` text from Snowflake (Cortex Search) → checks total daily mg against `DOSE_LIMITS` → Grok restates in plain language, quoting only the label → guardrails: schema, no-advice filter, **numeric grounding (every number must appear in the user's input or the quoted label)**, translation placeholders, fail closed. Any failure renders a **”Check with your pharmacist”** card with no number. Never a calculator, never a “suggested dose.”

### 6. Community tab
**Find a clinic:** ZIP → nearest HRSA health centers / Rural Health Clinics with distance, `tel:` phone, “takes Medicaid & Medicare, sliding fee” by program rule, community-reported insurers (“People here confirmed: Medicaid (5)”), and always “call to confirm.” Widens the radius automatically for rural ZIPs.
**Medication talk:** anonymous posts about a med and its side effects, moderated (no dose advice, no contact details), with the **most-mentioned terms as labeled chips at the top** that filter the list, next to the official openFDA adverse-reactions snippet.

### 7. Share-sheet PDF
Med list, flagged pairs, short card text, dose lines, nearest clinic (if looked up), disclaimer, “questions to ask.” Same JSON as the UI. Educational handout — not a medical record. Print-to-PDF is an acceptable fallback.

---

## Stretch (only if MVP is demoable)

1. **Grok Voice Agent** — ask about the current med list / cards; answers from computed JSON only  
2. **Rx photo OCR** — Grok vision → user confirm → dose explainer  
3. **More languages** — Grok translates (numbers/units as placeholders), Grok Voice or ElevenLabs speaks  
4. **Clinic enrichment** — NPPES refresh, CMS “accepts Medicare assignment”  
5. **Grok Imagine** — one illustration for the top major pair from validated JSON (never for the graph or PDF as a “medical diagram”)

---

## Explicitly out of scope

- Dose calculators, weight/age-based dosing, or any dose number not present in the label text or the user's own directions
- A user-facing voice-vendor picker; ElevenLabs Dubbing; ElevenLabs for English when Grok Voice is healthy
- Scribe / dictate-a-bottle as a product feature
- Using community posts to alter severity, dose, or clinic data
- DrugBank as a parallel severity source
- Google Calendar OAuth (`.ics` only if leftover time)
- User accounts / login / HIPAA productization
- Client-side Snowflake access or exposing warehouse credentials
- Storing real patient identifiers, precise locations, or contact details in Snowflake
- Using Imagine to invent interactions or draw the clinical graph

---

## Weekend build order

1. Scaffold Next.js + RxPlain header + disclaimer + footer (Privacy / Terms) + Meds / Community nav  
2. Snowflake helper + seed `INTERACTIONS`, `DOSE_LIMITS`, `ZIP_CENTROIDS`, `CLINICS`  
3. RxNorm search + med list (`/api/meds/search`)  
4. Pairwise check via Snowflake + openFDA (`/api/interactions/check`); write label sections into `LABEL_SECTIONS`  
5. Grok cards + Cytoscape graph  
6. `<ListenButton>` + `/api/tts` router (Grok → ElevenLabs)  
7. Dose explainer + guardrails (`/api/dose/explain`)  
8. Community: clinics (`/api/clinics/near`)  
9. Community: medication talk + top terms (`/api/community/posts`)  
10. Share-sheet PDF export  
11. Seed demo meds + rural ZIP + posts; deploy to **DigitalOcean App Platform** (Snowflake + XAI + ElevenLabs env vars)  
12. Stretch only after 1–11 work  

If you finish 1–10, you have the full philanthropy / accessibility story for judges.

---

## Data and safety

- Model output is **unverified** — show DDInter severity and openFDA snippets beside rewrites.
- **Dose numbers fail closed.** Every number in a dose explanation must appear in the person's own directions or in the quoted label text; otherwise the UI shows "Check with your pharmacist" with no number. RxPlain never suggests a dose.
- Community posts are experiences, not evidence; they are anonymous, moderated, and never feed severity or dose output.
- Clinic insurance info is labeled by source: "by program rule" (HRSA/RHC requirements), "community reported," and always "call to confirm."
- Do not store prescription photos longer than the request (if you add OCR).
- Do not collect real patient identifiers. Use sample meds in the recorded demo.
- Never instruct the user to change how they take a medicine.
- Full details: [Privacy Policy](PRIVACY.md) and [Terms and Conditions](TERMS.md).

Useful endpoints:

- openFDA labels: `https://api.fda.gov/drug/label.json` (fields: `dosage_and_administration`, `overdosage`, `boxed_warning`, `adverse_reactions`)
- RxNorm REST: `https://rxnav.nlm.nih.gov/REST/`
- DDInter: download a snapshot into the repo; do not scrape at request time
- Max daily dose snapshot: [DrugCentral](https://drugcentral.org/) MRTD or FDA MRDD via [PubChem AID 1195](https://pubchem.ncbi.nlm.nih.gov/bioassay/1195) — seed once into `DOSE_LIMITS`
- Clinics: [HRSA Health Center Sites download](https://data.hrsa.gov/data/download), [CMS Rural Health Clinic Enrollments](https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/rural-health-clinic-enrollments), [NPPES NPI Registry API](https://npiregistry.cms.hhs.gov/api-page)
- Snowflake: [Cortex Search](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-search/cortex-search-overview), [COMPLETE with `guardrails`](https://docs.snowflake.com/en/sql-reference/functions/complete-snowflake-cortex)
- xAI Voice (primary): [Text to speech](https://docs.x.ai/developers/model-capabilities/audio/text-to-speech), [Speech to text](https://docs.x.ai/developers/model-capabilities/audio/speech-to-text), [Speech to speech](https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech)
- ElevenLabs (secondary): [Models](https://elevenlabs.io/docs/overview/models) — `eleven_v3`, `eleven_flash_v2_5`, `scribe_v2`
- xAI Imagine (stretch): [docs.x.ai Imagine](https://docs.x.ai/developers/model-capabilities/imagine)

Environment (never commit; use `.env.local` / DigitalOcean App Platform encrypted env vars):

```
XAI_API_KEY=
ELEVENLABS_API_KEY=           # secondary voice only; app must run without it
ELEVENLABS_VOICE_ID=          # optional
OPENFDA_API_KEY=              # optional but higher rate limit
SNOWFLAKE_ACCOUNT=
SNOWFLAKE_USERNAME=
SNOWFLAKE_PASSWORD=
SNOWFLAKE_WAREHOUSE=
SNOWFLAKE_DATABASE=
SNOWFLAKE_SCHEMA=
SNOWFLAKE_ROLE=               # optional
```

DigitalOcean: [App Platform](https://docs.digitalocean.com/products/app-platform/) · [Next.js sample](https://docs.digitalocean.com/products/app-platform/getting-started/sample-apps/next.js/)

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
3. Tap Listen on a card — Grok Voice reads it  
4. Enter "metformin 500 mg, 1 tablet twice a day" → plain-language dose card with the label quote → tap Listen; then enter a too-high dose → "Check with your pharmacist" card with no number  
5. Community: enter a rural ZIP → nearest health centers with phone + coverage signal; open Medication talk → top terms + a post  
6. Download a one-page share sheet  

**Stretch beats:** ask a question out loud about the current results; optional Rx photo; switch to a language Grok Voice lacks and hear ElevenLabs take over without any UI change.

That **access loop** is the product. Everything else is polish.
