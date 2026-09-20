# RxPlain

**HopHacks 2026 · Bloomberg Most Philanthropic Hack**
Abigail Wang · Crystal Yang · Hung-Yu Chen · Tony Zhang

RxPlain turns dense medication labels into plain words people can read, hear, and share. It is an educational accessibility tool, not medical advice. It never suggests a dose.

## Why

All of us have parents or grandparents whose English isn't strong. A bottle comes home from the pharmacy and nobody in the house can really read it, so the job of translating falls to the kids, who don't know what the medical words mean either. Many of those families also live far from any clinic they could ask. RxPlain is built for them.

## What's on the site

**Home** (`/`) — A short introduction and four entry points: My medicines, Calendar, Clinics, Community.

**Meds** (`/meds`)
- **My medicines.** Click the search box to browse the full medicine list or type the drug name. Add up to 10.
- **The food connection.** Check what foods and drinks matter for each medicine you added. The guide is built from MedlinePlus and FDA pages and covers 70+ common medicines. Each result shows a level in words (Major, Moderate, Minor, Unknown), an explanation, guidance, and a link to the source. A medicine with no entry says so explicitly rather than implying it is safe.
- **How much and when.** Type the directions from your bottle, or scan it: live camera preview, a chosen photo, or a phone linked by QR code (`/capture`). RxPlain parses the directions, shows them back for confirmation, then restates them in plain words and checks them against the official FDA label. Every number shown must already appear on your bottle or in the quoted label text. If the directions exceed the label's daily maximum or can't be verified, it fails closed with a "check with your pharmacist" card that contains no numbers.
- **Add to calendar.** From a confirmed dose, add one time slot per daily dose, repeating until a date you pick.
- **Your medicine calendar.** Planned and taken doses by day, stored only in this browser. Edit, mark taken, undo, or delete.

**Clinics** (`/clinics`) — Community health centers and rural health clinics near a ZIP code or your current location, with a travel-radius slider (5 to 100 miles) and filters for Medicaid, Medicare, sliding fee, and rural health clinics. Coverage is stated by source: "by program rule" for what these clinic types must accept, community-reported confirmations from other users, and always a call-to-confirm note with the phone number. Data comes from HRSA and CMS.

**Community** (`/community`) — Choose a medicine and read what others noticed, tagged by side effect, with the most-mentioned terms on top. Beside it, the medicine's official label text on side effects, with an optional AI summary of two to four sentences. Posts are anonymous and moderated; anything that tells another person to change a dose is rejected with a plain reason. In Spanish, posts, label text, and summaries are machine-translated with a "Ver original" toggle on each.

**Everywhere**
- **Listen** buttons on results, a **Read page** control in the header, and a floating **Listen to selection** pill on any highlighted text.
- **English and Spanish** for the whole interface. English speech uses Grok Voice; Spanish speech uses ElevenLabs.
- Medical jargon is swapped for plain phrases on screen and in audio, with the original term shown on hover.
- Severity and coverage are always stated in words, never by color alone.

## Run it locally

```bash
npm install
cp .env.example .env.local   # optional, see below
npm run dev                  # http://localhost:3000
```

Without any keys, the medicine list, food guide, dose checking, calendar, clinics, and seeded community content all work. Bottle scanning and speech need keys:

| Key | Enables |
| --- | --- |
| `XAI_API_KEY` | Bottle scanning, plain-language rewrites, moderation, translation, summaries, and English speech |
| `ELEVENLABS_API_KEY` | Spanish speech |
| `OPENFDA_API_KEY` | Optional. Higher rate limit for label lookups |
| `SNOWFLAKE_*` | Optional. Switches the data layer from bundled seed data to Snowflake |

Restart the dev server after changing `.env.local`. When a key is missing, the relevant button shows an explicit "unavailable" message rather than failing silently.

**Phone scanning on a local network.** The QR link expires after ten minutes, the photo is held in memory only until it is received, and phone and computer must be on the same network.

## How it works

- **Framework.** Next.js (App Router) with TypeScript and Tailwind. All vendor calls go through `/api/*` route handlers; no keys reach the browser.
- **Data.** `lib/db` is an adapter: Snowflake when configured, otherwise the JSON seeds in `data/` (clinics, ZIP centroids, dose limits, label sections, posts, medicine list).
- **Dose checking.** `lib/dose/` retrieves the official `dosage_and_administration` and `overdosage` text from openFDA, checks the daily total against `data/dose_limits.json`, asks Grok to restate the directions using only that text (a template does this without a key), then runs guardrails: schema, no-advice filter, and numeric grounding. Any failure fails closed.
- **Food guide.** `lib/food.ts`, entries sourced from MedlinePlus and the FDA.
- **Voice.** `lib/tts/` routes English to Grok Voice and Spanish to ElevenLabs.
- **Plain language.** `lib/glossary.ts` and `data/glossary.json` swap terms before text is shown or spoken. `lib/plainNames.ts` resolves brand names to generics.
- **Community.** `lib/community.ts` and `lib/moderation.ts`; translations via `/api/translate`, which protects numbers and units during translation.
- **Clinics.** `lib/clinics.ts` over `data/clinics.json` (HRSA and CMS sites) and `data/zip_centroids.json`.

## Scripts

```bash
npm run typecheck                                  # tsc
npm run seed:snowflake                             # load data/ into Snowflake (after sql/schema.sql)
npx tsx --tsconfig tsconfig.json scripts/dose-smoke.ts    # dose guardrail checks
npx tsx --tsconfig tsconfig.json scripts/food-smoke.ts    # food guide matching
npx tsx scripts/build-clinics.ts                   # rebuild data/clinics.json from HRSA + CMS downloads
npx tsx scripts/build-zips.ts                      # rebuild data/zip_centroids.json
```

## Deploy

`.do/app.yaml` describes the DigitalOcean App Platform service (port 8080, health check at `/api/health`). Add the keys above as encrypted environment variables.

## Data and safety

- RxPlain never computes, recommends, or adjusts a dose. It restates what is on your bottle and checks it against the official label.
- "Unknown" or "no entry" never means safe. The app says so wherever it appears.
- Community posts are experiences, not evidence, and are never used in dose or food results.
- Nothing more precise than a ZIP code is used for location. The calendar lives only in your browser. Scanned photos are not stored.

[Privacy Policy](PRIVACY.md) · [Terms](TERMS.md)