# Master prompt: RxPlain (Bloomberg Most Philanthropic Hack)

Paste everything below the line into Cursor as the initial build instruction.

> **Rev 2 (post-sponsor feedback).** Changes from rev 1: (a) a **Dose Explainer** with a low-risk-tolerance guardrail pipeline (RAG over official label text + numeric grounding + max-dose ceiling check) so nobody is told to under- or overdose; (b) a **Community** tab with a rural clinic finder (insurance signal) and a medication / side-effect discussion board with a top-terms cloud; (c) **click-to-listen** audio on every output that tells a person how much to take and when; (d) **ElevenLabs** allowed as a *secondary* voice vendor for translation coverage only — **Grok Voice stays primary**. Rules below that mention "rev 1 said X" are intentional reversals.

---

## Role
You are building **RxPlain** for HopHacks **[Bloomberg] Most Philanthropic Hack**. This is a **social-good / equity** product, **not** a healthcare or clinical decision-support app.

**Problem (philanthropy):** dense medication labels exclude people with low health literacy, vision or reading barriers, high cognitive load, limited English, and people in rural areas with no pharmacist nearby to ask. That is an access and inclusion problem.

**Solution:** free plain-language summaries, a simple visual map, a plain-language **"how much and when" dose explainer** grounded in the official label, **click-to-listen** audio everywhere, a **community tab** (nearby low-cost clinics + peer discussion of side effects), and a one-page share sheet people can show a caregiver or bring to a pharmacist/doctor visit.

Implement end-to-end vertical slices. Prefer a working demo path over incomplete breadth. Do not invent clinical facts; severity comes from structured data; dose numbers come only from the person's own label/prescription and official label text; the LLM only rewrites provided evidence into a fixed schema.

## Product one-liner
**RxPlain** helps people who can't use medical jargon understand their medicines: add 2–10 meds → pairwise severity from DDInter → plain-language cards → visual map → **dose explainer ("take 1 tablet, twice a day, with food")** → **tap to hear it** (Grok Voice) → share-sheet PDF → **Community: nearby clinics that take your coverage + what other people say about side effects**. Brand **RxPlain** in the UI header, PDF title, and disclaimer.

**Pitch & UI rules (critical):**
- Lead with **who is left out** and **equitable access to understanding**.
- Call it an **educational accessibility / public-good** tool — never "AI doctor," "clinical checker," or "healthcare platform."
- Do **not** compete narratively with the Healthcare track. Public APIs (RxNorm, openFDA, DDInter, HRSA, CMS) are evidence grounding, not the product story.
- **Accessibility is the product.** Design for literacy, vision, cognitive load, language, and self-advocacy. **Every output that says how much to take or when has a Listen button next to it.**

## Non-negotiable safety + accessibility rules
- Persistent disclaimer: educational only, not medical advice; discuss with a pharmacist/doctor.
- Never let generative models invent interaction severity. Severity comes from DDInter (cached open data). LLM only rewrites/explains provided evidence.
- **Dose rule (low risk tolerance):** RxPlain **never computes, recommends, or adjusts a dose.** It only *restates* the dose that is already on the person's label/prescription (entered or OCR'd), checks it against official label text, and refuses to state a number it cannot verify. Any number in a dose explanation must appear verbatim in the retrieved label text or the user's own input. If the check fails or is inconclusive → show the **"Check with your pharmacist"** card with no number in it. See **Feature 7**.
- **Community rule:** peer posts are experiences, not evidence. Label them as such, never merge them into severity or dose output, and moderate anything that tells another person to change a dose.
- Keep API keys and **Snowflake credentials** server-side. Never expose `XAI_API_KEY`, `ELEVENLABS_API_KEY`, or Snowflake secrets to the client.
- Cache lookups; respect openFDA / RxNorm / NPPES rate limits.
- Never tell the user to start, stop, or change a medicine.
- **A11y baseline:** large type, high contrast, keyboard access, visible focus, severity labeled in text (not color-only), semantic headings/buttons, **read-aloud as a primary action on every results surface** (cards, dose explainer, clinic results, community summaries).
- **Legal:** Ship footer links to Privacy Policy and Terms (`/privacy`, `/terms` pages that render [`PRIVACY.md`](PRIVACY.md) / [`TERMS.md`](TERMS.md) content, or static routes). Short first-run note: educational demo, not medical advice, see Terms. Community tab gets its own one-line note: anonymous, public, not medical advice, no personal details.
- **Copy tone:** "share sheet," "plain language," "hear this," "questions to ask," "people near you" — avoid clinic/EHR/CDS language.

## Stack (do not expand without a strong reason)
- **Frontend:** Next.js (App Router) + TypeScript + Tailwind
- **Backend:** Next.js Route Handlers (**only** place that talks to Snowflake or vendor APIs)
- **Database:** **Snowflake** — interaction data, label text for RAG, clinic directory, community posts, lookup caches. Browser never gets Snowflake credentials.
- **Retrieval for dose explainer:** **Snowflake Cortex Search** over label sections stored in Snowflake (managed hybrid search; no separate vector DB). If Cortex Search is unavailable in the trial account, fall back to a plain SQL section lookup by RxCUI + section name — that is still RAG, just not semantic.
- **Drug identity / search:** NLM **RxNorm** REST (live); cache hits in Snowflake when possible
- **Label evidence:** **openFDA** `drug/label.json`; cache full sections (`dosage_and_administration`, `overdosage`, `boxed_warning`, `warnings`, `adverse_reactions`) in Snowflake by RxCUI
- **Pairwise severity:** **DDInter** loaded into Snowflake tables (not a giant CSV parse on every request)
- **Max-dose ceiling (secondary check):** **DrugCentral** MRTD / FDA Maximum Recommended Daily Dose snapshot loaded into a small Snowflake table (mg/day or mg/kg/day per ingredient). Coverage is partial (~900–1200 ingredients); treat "no row" as "cannot verify," not as "OK."
- **Plain-English rewrite:** **xAI Grok** chat with strict JSON output; optionally cache card JSON in Snowflake by pair hash
- **Voice — primary:** **xAI Grok Voice** — TTS (`POST https://api.x.ai/v1/tts`, `language` param, 20 languages incl. `en`, `es-MX`, `es-ES`, `pt-BR`, `zh`, `hi`, `ar`, `vi`, `ko`, `ja`, `fr`, `de`), STT (`POST https://api.x.ai/v1/stt`, model `grok-voice-transcribe-2.0`, 24 languages), and speech-to-speech (`wss://api.x.ai/v1/realtime`, `grok-voice-latest`) for the stretch voice agent.
- **Voice — secondary (translation coverage only):** **ElevenLabs** — TTS `eleven_v3` (70+ languages) or `eleven_flash_v2_5` (32 languages, ~75 ms) and STT `scribe_v2` (90+ languages). Used **only** when the requested language is not in Grok Voice's list, or as automatic fallback when the Grok call errors. Do **not** use ElevenLabs Dubbing (batch only, not real-time) and do not build a voice picker UI.
- **Translation of text:** Grok chat translates the *already-validated* card / dose JSON. Numbers, units, and drug names are passed through untouched (see Feature 7 guardrail G4).
- **Clinic directory:** **HRSA Health Center Service Delivery & Look-Alike Sites** CSV (≈16k sites: name, address, lat/long, phone, NPI, site type) + **CMS Rural Health Clinic Enrollments** (data.cms.gov API/CSV) seeded into Snowflake. **NPPES NPI Registry API** (`https://npiregistry.cms.hhs.gov/api/?version=2.1`) live for phone/taxonomy enrichment on demand. ZIP → lat/long from a ZIP-centroid CSV in Snowflake (or `api.zippopotam.us` with cache).
- **Interaction graph:** **Cytoscape.js** from the same JSON as the cards (not Imagine)
- **Share-sheet export:** client or server PDF from structured JSON (`@react-pdf/renderer` or `pdf-lib`) — labeled as a handout, not a medical record
- **Hosting:** **DigitalOcean App Platform** (GitHub → autodeploy). Secrets encrypted in App Platform env vars + local `.env.local`
- **Optional DO extras (stretch only):** Spaces for cached Imagine assets; skip Droplets/Managed DB — Snowflake is the database

**Do not use:** Scribe / dictate-a-bottle as a product feature, DrugBank as a second severity source, Google Calendar OAuth, user auth / real patient DB, pronunciation maps, ElevenLabs Dubbing, a user-facing voice-vendor picker, or Grok Imagine in MVP. Do not query Snowflake from the browser. Do not put secrets in `NEXT_PUBLIC_*`. Do not let the LLM produce a dose number that is not in retrieved text.

> Rev 1 said "no ElevenLabs, no dual TTS router." Sponsors asked for ElevenLabs as a secondary path for translation. The router now exists but is **one function** (`lib/tts/index.ts`) with a language allow-list, not a settings system.

## Snowflake data model (keep small)

Access Snowflake **only** from server modules (`lib/snowflake.ts`) used by Route Handlers.

| Table | Purpose |
| --- | --- |
| `INTERACTIONS` | DDInter pairs: `drug_a`, `drug_b`, `severity`, `mechanism?`, `management?`, `source` |
| `DRUG_CACHE` | RxNorm/openFDA cache: `rxcui`, `name`, `ingredient_name`, `label_snippets`, `fetched_at` |
| `LABEL_SECTIONS` | RAG corpus: `rxcui`, `ingredient_name`, `section` (`dosage_and_administration` / `overdosage` / `boxed_warning` / `warnings` / `adverse_reactions`), `chunk_id`, `text`, `set_id`, `effective_time`. Cortex Search service `LABEL_SEARCH` over `text`, filterable by `rxcui` + `section`. |
| `DOSE_LIMITS` | Ceiling check: `ingredient_name`, `max_daily_mg?`, `max_daily_mg_per_kg?`, `route`, `source` (`drugcentral` / `fda_mrtd`), `notes` |
| `CARD_CACHE` | Optional: `pair_hash`, `card_json`, `created_at` (avoid re-calling Grok for same pair) |
| `CLINICS` | HRSA + CMS RHC seed: `clinic_id`, `name`, `site_type` (`FQHC` / `LOOKALIKE` / `RHC`), `address`, `city`, `state`, `zip`, `lat`, `lon`, `phone`, `npi?`, `accepts_medicaid` (TRUE for FQHC/RHC by program rule), `accepts_medicare` (same), `sliding_fee` (TRUE for FQHC by program rule), `source`, `updated_at` |
| `CLINIC_CONFIRMATIONS` | Community-confirmed coverage: `clinic_id`, `insurance_label` (free text e.g. "Medicaid", "Blue Cross"), `confirmed` (bool), `created_at`. No identity. |
| `ZIP_CENTROIDS` | `zip`, `lat`, `lon` (public ZIP centroid file) |
| `COMMUNITY_POSTS` | `post_id`, `rxcui?`, `drug_name`, `body`, `side_effect_tags` (array), `moderation_status`, `created_at`, `anon_handle` (random, per session, never an account) |
| `DEMO_SESSIONS` | Optional anonymous: `session_id`, `meds_json`, `results_json`, `updated_at` (no real names/PHI) |

Seed `INTERACTIONS`, `LABEL_SECTIONS` (for the demo meds at minimum), `DOSE_LIMITS`, `CLINICS`, and `ZIP_CENTROIDS` once via script or SQL. Prefer warehouse suspend / small warehouse for hackathon cost. Cortex Search is billed on top of the warehouse — index only `LABEL_SECTIONS`, nothing else.

**API rule:** Client → `/api/*` → `lib/snowflake.ts` (SQL / Cortex Search) and/or live RxNorm/openFDA/NPPES/Grok/ElevenLabs. Never expose connection strings, keys, or raw SQL to the client.

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
- Render cards grouped by severity (major first). Each card has a **Listen** button (Feature 5).

### 4) Interaction graph
- Nodes = meds; edges = interactions colored by severity.
- Click edge → focus matching card.
- Built from the same JSON as the cards.

### 5) Click-to-listen everywhere (Grok Voice primary) — core accessibility path
- One reusable `<ListenButton text={...} lang={...} />` component. Put it on: every interaction card, "Read all" on the summary, **the dose explainer card (Feature 7) — mandatory**, each clinic result, and the community top-terms summary. Controls are obvious (next to the text), not buried.
- Server route `/api/tts` → `lib/tts/index.ts` → `lib/tts/grok.ts` by default. Router logic is three lines: if `lang` in `GROK_TTS_LANGS` → Grok; else if `ELEVENLABS_API_KEY` set → `lib/tts/elevenlabs.ts`; else return 422 with a "language not available yet" message. Also fall back to ElevenLabs if the Grok call throws. Log which provider served each request (no text logged).
- Stream MP3 back; client uses a single `<audio>` element with play/pause/replay and a visible "Playing…" state. Cache audio by `sha256(provider+lang+text)` in memory or DO Spaces (stretch).
- One optional timed prompt after analysis (e.g. "Found 2 moderate interactions. Tap a red edge to hear more.") — hard-coded or simple toggle; do not build a settings system for this.
- **Dose audio must read the exact validated dose string** (e.g. "Take one tablet by mouth, two times a day, with food. Do not take more than six tablets in one day."). Never synthesize audio from unvalidated LLM text.
- Cards use short sentences and everyday words; avoid medical jargon unless immediately explained.
- Language: `en` default. A single language selector (English + Spanish in MVP; more in stretch). Text is translated by Grok chat from validated JSON; audio provider chosen by the router above.

### 6) Share-sheet PDF
- One page from the same JSON: med list, date, flagged pairs, short card text, **dose explainer lines**, nearest clinic (if the person looked one up), disclaimer, "questions to ask."
- Title it as an educational handout / share sheet — not a clinical chart.
- No second LLM pass for layout.

### 7) Dose Explainer — "how much and when," with low risk tolerance
**What it is:** the person types (or OCRs, stretch) the directions on their own bottle — e.g. `metformin 500 mg, 1 tablet twice daily with meals` — and RxPlain restates it in plain language and audio, *after* checking it against the official label. It is a **reading aid**, not a dose calculator.

**Why RAG + guardrails, not a plain "compare to a number online" check:** correct doses depend on indication, age, weight, and kidney/liver function, so no single "recommended amount" exists to compare against; openFDA dose text is prose, not a number; and the max-dose datasets (DrugCentral MRTD, FDA MRDD) cover only ~900–1200 ingredients and are per-kg for many entries. So the primary path is retrieval of the official `dosage_and_administration` + `overdosage` text and an LLM that may only quote it; the numeric ceiling is a *second* independent check. Published pharma RAG benchmarks still show double-digit hallucination rates, so retrieval alone is not the guardrail — the numeric-grounding check (G3) is.

**Input schema** (parse with Grok into this, then show it back for confirmation before anything else):
```json
{
  "drugName": "", "rxcui": "", "strengthMg": null, "unitsPerDose": null,
  "unitLabel": "tablet|capsule|mL|puff|drop|patch|unit",
  "timesPerDay": null, "route": "oral|topical|inhaled|other",
  "withFood": null, "asNeeded": false, "userText": ""
}
```

**Pipeline (`/api/dose/explain`):**
1. **Retrieve** — Cortex Search (or SQL fallback) on `LABEL_SECTIONS` filtered to this `rxcui` and sections `dosage_and_administration`, `overdosage`, `boxed_warning`. Top 5 chunks. If zero chunks → return `status: "unverified"` (see G5).
2. **Ceiling check** — compute `dailyMg = strengthMg × unitsPerDose × timesPerDay`. Look up `DOSE_LIMITS` by ingredient. If `dailyMg > max_daily_mg` → `status: "above_label_max"`. If no row → note `ceilingChecked: false` (does **not** count as pass).
3. **Rewrite** — Grok chat, `temperature: 0`, JSON mode, system prompt: *"You are a reading aid. You may only restate the user's own directions and quote the provided label text. Never suggest a different dose. If the label text and the user's directions disagree, say so plainly and tell them to ask a pharmacist. Output the JSON schema exactly."*
   ```json
   {
     "status": "consistent|above_label_max|inconsistent|unverified",
     "plainDose": "Take 1 tablet by mouth, 2 times a day, with food.",
     "maxPerDayLine": "The label says do not take more than 2,550 mg in a day.",
     "timing": ["morning with breakfast", "evening with dinner"],
     "missedDoseLine": "",
     "labelQuotes": [{ "chunkId": "", "text": "" }],
     "numbersUsed": [500, 1, 2, 2550],
     "askYourPharmacist": ""
   }
   ```
4. **Guardrails (all server-side, all must pass before the card renders):**
   - **G1 Schema** — `zod` parse; on failure retry once, then `status: "unverified"`.
   - **G2 No-advice filter** — regex + Grok classifier on `plainDose` / `askYourPharmacist` for "increase / decrease / double / skip / stop / instead take"; any hit → `unverified`.
   - **G3 Numeric grounding (the critical one)** — every number in `numbersUsed` and every number appearing in `plainDose` / `maxPerDayLine` / `timing` must be present either in the user's confirmed input or in one of the `labelQuotes` chunk texts (exact match after normalising commas/units). Any unmatched number → `unverified` and log it. This is what stops "hallucinated dosing."
   - **G4 Translation pass-through** — when translating, send numbers/units/drug names as `{{0}}`, `{{1}}` placeholders and re-insert after translation; re-run G3 on the result.
   - **G5 Fail closed** — `unverified` / `inconsistent` / `above_label_max` all render the same **"Check with your pharmacist"** card: no number, one sentence on why (e.g. "Your directions add up to more than the label's daily maximum"), a Listen button, and the label quote shown as evidence. Never show a partial dose line.
   - **G6 Optional Cortex Guard** — if the rewrite is run through `SNOWFLAKE.CORTEX.COMPLETE(..., {'guardrails': true})` instead of the xAI API, keep it; it filters harmful content but does **not** check numbers, so G3 still runs.
5. **Render** — dose card with big text, `plainDose` first, `maxPerDayLine` second, Listen button, "Where this came from" expander showing `labelQuotes`, and the disclaimer. Add the line to the share sheet.

**Do not** ship a weight-based or pediatric calculator, a "suggested dose" UI, or any path where a dose number reaches the screen or the speaker without passing G3.

### 8) Community tab — nearby clinics (rural focus)
- Route `/community` with two panels: **Find a clinic** and **Medication talk** (Feature 9).
- Input: ZIP (or "use my location" → browser geolocation → nearest ZIP centroid). Optional filters: "takes Medicaid," "takes Medicare," "sliding-fee / pay what you can," "rural health clinic."
- `/api/clinics/near?zip=&radiusMiles=25&filters=` → Snowflake Haversine over `CLINICS` joined to `ZIP_CENTROIDS`, order by distance, top 20. Return `{ name, siteType, distanceMiles, address, phone, acceptsMedicaid, acceptsMedicare, slidingFee, communityConfirmed[] }`.
- **Insurance signal, honestly labeled:** there is no public dataset of which commercial insurers a clinic accepts. Show three tiers in text, not color:
  - **"Takes Medicaid & Medicare, sliding fee available"** — set from program rules (HRSA-funded health centers must offer a sliding-fee scale and accept Medicaid/Medicare; Rural Health Clinics accept Medicare/Medicaid). Label this "by program rule."
  - **"People here confirmed: Blue Cross (2), Medicaid (5)"** — from `CLINIC_CONFIRMATIONS`, aggregated counts, with a one-tap "I called and they take ___" form (free text insurer, yes/no). Label this "community reported."
  - **"Call to confirm"** — always shown, with the phone number as a `tel:` link and a Listen button that reads the clinic name, distance, and phone aloud.
- Stretch: NPPES live lookup by `npi` to refresh phone/taxonomy; CMS Doctors & Clinicians file for "accepts Medicare assignment" at the individual-provider level.
- Empty state for rural ZIPs with nothing in 25 mi: widen to 50 / 100 mi automatically and say so.

### 9) Community tab — medication talk with top-terms cloud
- Anonymous, no accounts. `anon_handle` is a random adjective-animal per session, stored client-side only.
- Post form: pick a med (RxNorm search, optional), free-text body (≤ 500 chars), optional checkboxes for common side-effect tags (nausea, dizziness, sleep, appetite, headache, stomach, mood, other).
- `/api/community/posts` GET (by `rxcui` or all, newest first, paginated) / POST.
- **Moderation before insert:** (1) regex + Grok classifier rejects posts that tell others to change a dose, name a person, or include a phone/email; (2) optional Cortex Guard; rejected posts get a plain reason ("Please don't share personal contact details"). Store `moderation_status`.
- **Top terms at the top of the panel:** server computes the most frequent words across approved posts (per med if filtered) — SQL `SPLIT_TO_TABLE` + lowercase + stop-word list + minimum 3 chars + `GROUP BY` → top 15. Render as text chips sized by count *and* labeled with the count (not size alone). Tap a chip → filter posts containing it. Cache 60 s.
- Beside the cloud, show the **official** list: openFDA `adverse_reactions` snippet for the selected med with "from the label" label, so peer talk sits next to the source of truth.
- Every post list has a Listen button that reads the top terms and the first three posts.
- Banner: "These are other people's experiences, not medical advice. If a side effect worries you, call your pharmacist or clinic." Link to FDA MedWatch for reporting.

## Stretch only (after MVP works end-to-end)
Do these in order; skip freely if time is short:

1. **Grok Voice Agent** — user asks about the *current* results; agent answers from already-computed JSON only (`wss://api.x.ai/v1/realtime`, `instructions` = the validated cards + dose JSON; `tools` optional; no free-hallucinated drug knowledge). Grok STT (`grok-voice-transcribe-2.0`) for push-to-talk if the realtime socket is too much; ElevenLabs `scribe_v2` only for languages Grok STT lacks.
2. **Prescription photo OCR** — Grok vision → parse into the Feature 7 input schema → user confirms → dose explainer runs. Never skip the confirmation step.
3. **More languages** — extend the selector; text via Grok chat with G4 placeholders; audio via the router (Grok for its 20, ElevenLabs `eleven_v3` beyond that).
4. **Clinic enrichment** — NPPES live refresh; CMS Doctors & Clinicians "accepts Medicare assignment."
5. **Grok Imagine** — one "Generate explainer image" for the top major pair from validated JSON only. Never use Imagine for the graph or severity.

## Architecture
```
Client (Next.js on DigitalOcean App Platform) — no DB credentials
  → /api/meds/search          (RxNorm; write-through DRUG_CACHE in Snowflake)
  → /api/interactions/check   (Snowflake INTERACTIONS + openFDA + Grok rewrite; optional CARD_CACHE)
  → /api/dose/explain         (Cortex Search over LABEL_SECTIONS + DOSE_LIMITS ceiling + Grok rewrite + guardrails G1–G6)
  → /api/tts                  (router: Grok Voice primary → ElevenLabs fallback by language)
  → /api/translate            (Grok chat, placeholder pass-through for numbers/units/names)
  → /api/clinics/near         (Snowflake CLINICS + ZIP_CENTROIDS haversine; CLINIC_CONFIRMATIONS)
  → /api/clinics/confirm      (POST community insurance confirmation)
  → /api/community/posts      (GET/POST; moderation; top-terms aggregate)
  → /api/export/pdf           (or client-side PDF from JSON)
  → /api/sessions  (optional) (anonymous DEMO_SESSIONS in Snowflake)

Stretch:
  → /api/stt                  (Grok STT primary → ElevenLabs Scribe fallback)
  → /api/ocr/prescription     (Grok vision → Feature 7 input schema)
  → /api/voice/agent          (Grok Voice Agent over current JSON / session)
  → /api/imagine/explainer    (Grok Imagine, optional)
```

**Infra split:** DigitalOcean hosts the app; Snowflake holds interaction data, label RAG corpus, clinic directory, community posts, and caches. All Snowflake access goes through Route Handlers + `lib/snowflake.ts`. No user accounts; no real PHI anywhere; community posts are anonymous and moderated.

Deploy: connect the GitHub repo to **App Platform**, enable autodeploy from `main`, set encrypted env vars (XAI + ElevenLabs + Snowflake + openFDA). Optional `.do/app.yaml` for reproducible deploy.

## Env vars
```
XAI_API_KEY=
ELEVENLABS_API_KEY=           # secondary TTS/STT only; app must run without it
ELEVENLABS_VOICE_ID=          # optional; default to a multilingual stock voice
OPENFDA_API_KEY=              # optional but recommended
SNOWFLAKE_ACCOUNT=
SNOWFLAKE_USERNAME=
SNOWFLAKE_PASSWORD=           # or key-pair / PAT — prefer least privilege
SNOWFLAKE_WAREHOUSE=
SNOWFLAKE_DATABASE=
SNOWFLAKE_SCHEMA=
SNOWFLAKE_ROLE=               # optional
CORTEX_SEARCH_SERVICE=LABEL_SEARCH   # optional; if unset, use SQL section lookup
```

Document in README + `.env.example`. Never commit secrets.

## Build order (follow this)
1. Scaffold Next.js + Tailwind; RxPlain header + disclaimer banner; footer links to Privacy + Terms; top nav with **Meds** and **Community**.
2. `lib/snowflake.ts` connection helper + create/seed `INTERACTIONS`, `DOSE_LIMITS`, `ZIP_CENTROIDS`, `CLINICS` (and empty cache/community tables).
3. RxNorm search UI + med chips (`/api/meds/search`, optional cache write).
4. Pairwise check via Snowflake + openFDA evidence (`/api/interactions/check`). While here, write full label sections for each looked-up RxCUI into `LABEL_SECTIONS`.
5. Grok JSON cards + Cytoscape graph (optional `CARD_CACHE`).
6. `<ListenButton>` + `/api/tts` with the Grok→ElevenLabs router. Wire onto cards and "Read all."
7. **Dose Explainer** (`/api/dose/explain`) with G1–G5; Listen button on the dose card; demo with metformin 500 mg BID and one deliberately-wrong input (e.g. 5 tablets × 4/day) to show the fail-closed card.
8. **Community → clinics** (`/api/clinics/near`, confirmations) with Listen on results.
9. **Community → medication talk** (posts, moderation, top-terms cloud, openFDA adverse-reactions panel).
10. Share-sheet PDF export (now includes dose lines + nearest clinic).
11. Seed demo page (e.g. ibuprofen + warfarin + metformin, ZIP for a rural county) for judges; deploy to **DigitalOcean App Platform** with Snowflake + XAI + ElevenLabs env vars.
12. Stretch items only after 1–11 work.

## Acceptance criteria (first demo)
- Pitch/UI lead with **philanthropy**: who is excluded → free plain language / voice / visual / dose explainer / community. Do not pitch as a healthcare app.
- Add Advil (ibuprofen) + warfarin (or similar) via search.
- Severity from Snowflake-backed DDInter; plain-language cards from Grok.
- Graph with severity-colored edges **and** text labels; click edge → card.
- **Every** card, dose line, clinic result, and community summary has a working Listen button; audio comes from Grok Voice for English/Spanish; switching to a language outside Grok's list falls through to ElevenLabs without UI change.
- **Dose explainer:** metformin 500 mg 1 tab BID → consistent card with a quoted label line and a max-per-day line; 5 tabs × 4/day → "Check with your pharmacist" card with **no number**. Server logs show G3 ran. No dose number ever reaches the UI without passing G3.
- **Community → clinics:** a rural ZIP returns ≥ 1 FQHC/RHC within 50 mi, with distance, phone (`tel:`), "by program rule" coverage text, any community confirmations, and a Listen button.
- **Community → talk:** posting works anonymously; a post saying "just double it" is rejected with a reason; the top-terms chips show counts and filter the list; the openFDA adverse-reactions snippet is visible beside them.
- Share-sheet PDF downloads with med list + flagged pairs + dose lines + disclaimer.
- Keyboard can complete the main path; focus states visible.
- All lookups go through `/api/*` → Snowflake (not client-side DB); no `ELEVENLABS_API_KEY` / `XAI_API_KEY` in the client bundle.
- App is reachable on a DigitalOcean App Platform URL for judges.
- README: setup, env vars, DigitalOcean + Snowflake + Grok-primary / ElevenLabs-secondary voice, guardrail explanation, philanthropy + accessibility focus.

## Out of scope for v1
- Dose calculators, weight-/age-based dosing, "suggested dose," or any dose number the label text does not contain
- Using community posts to change severity, dose, or clinic data
- A user-facing voice-vendor picker; ElevenLabs Dubbing; ElevenLabs for English when Grok is healthy
- Live Voice Agent before MVP works
- Imagine-driven graphs or invented interactions
- Clinical decision support claims; Healthcare-track positioning; replacing clinicians
- Google Calendar OAuth; HIPAA productization; user accounts / login
- Client-side Snowflake drivers or exposing warehouse credentials
- Storing real patient identifiers, locations more precise than ZIP, or contact details in Snowflake
- Scraping HRSA / NPPES at request time (seed once; NPPES live only for single-record refresh)

## Deliverables
1. Runnable Next.js app branded **RxPlain**: MVP path against live RxNorm/openFDA + Snowflake-hosted DDInter, label RAG corpus, dose limits, clinics, and community posts.
2. Modules: `lib/snowflake.ts`, `lib/rxnorm.ts`, `lib/openfda.ts`, `lib/interactions.ts`, `lib/llm.ts`, `lib/dose/explain.ts`, `lib/dose/guardrails.ts`, `lib/tts/index.ts`, `lib/tts/grok.ts`, `lib/tts/elevenlabs.ts`, `lib/translate.ts`, `lib/clinics.ts`, `lib/community.ts`, `lib/pdf.ts`.
3. Short README + `.env.example` + Privacy Policy + Terms + SQL seed scripts for `INTERACTIONS`, `LABEL_SECTIONS` (demo meds), `DOSE_LIMITS`, `CLINICS`, `ZIP_CENTROIDS` + optional `.do/app.yaml`.
4. Seed/demo meds, a seeded rural ZIP with clinics, and 10–15 seeded community posts if APIs are slow.
5. App routes or pages for `/privacy`, `/terms`, `/community` (footer/nav linked).
6. Live DigitalOcean App Platform deploy for the science-fair demo.

Start by scaffolding Next.js, Snowflake connection + seeded tables, RxNorm search UI, and the interactions API. Then wire Grok rewrite, the graph, and the Listen button. Then the Dose Explainer with its guardrails, then Community. PDF next. Stretch last.

When uncertain, choose the path that preserves medical grounding, fails closed on dose numbers, and ships a demoable vertical slice.
