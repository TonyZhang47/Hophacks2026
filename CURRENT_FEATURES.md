# RxPlain — current local build

The Meds page now checks **medicine–food** relationships. The former medicine-pair endpoint returns HTTP 410. Existing dose verification is unchanged.

- Warm paper / ink design inspired by [LinkLetter](https://linkletter.press/), with serif headings and restrained terracotta accents.
- Seven medicines have curated food notes in `lib/food.ts`: warfarin, simvastatin, ciprofloxacin, levothyroxine, ibuprofen, metformin, and lisinopril. Entries link to MedlinePlus or the FDA; the simvastatin mechanism is supported by the [FDA grapefruit guide](https://www.fda.gov/consumers/consumer-updates/grapefruit-juice-and-some-drugs-dont-mix). This is a limited educational guide, not a comprehensive interaction service. Unlisted names return Unknown. Severity is an editorial reading aid, not an official clinical rating.
- Search or add a typed medicine name. Unknown names remain explicitly unverified.
- Scan a bottle using a live camera preview, a chosen photo, or a phone linked by QR. Live camera needs a secure context (`localhost` or HTTPS). For a phone on a local HTTP network address, use the native Take or choose photo control. Browser/device camera permission is required.
- QR links expire after ten minutes. The phone token can upload one image but cannot retrieve it; a separate desktop token retrieves it. Photos are held briefly in process memory and removed when received, closed, or expired. Tokens stay in the URL fragment, not query logs. The current pairing store supports one long-running Node process; use a shared TTL store before deploying multiple workers. Phone and computer must be on the same reachable network during local development; Wi-Fi client isolation can prevent pairing.
- `XAI_API_KEY` enables Grok bottle OCR and **English-only** speech. `ELEVENLABS_API_KEY` enables **Spanish-only** speech. There is no browser voice or cross-provider fallback. Missing keys show an explicit unavailable message. Read page queues all important visible text without the old 4,000-character truncation. Community contributions and source excerpts retain their original language.
- The Meds calendar stores one-off or seven-day planned doses and taken-dose records in localStorage. Users can edit, mark taken now, undo taken, or delete entries. It uses local device dates/times. This is a log, not a dose recommendation, background reminder, or cloud-synced calendar.
- Community terms and posts follow the selected medicine. Other opens manual search/entry. Unrecognized manual medicines are scoped by name rather than assigned a fake RxNorm identifier. Empty medicine-specific results stay empty rather than showing terms from other medicines.

Run `npm install`, then `npm run dev` (port 3000). No keys are needed for the food guide, calendar, or seeded community content. After changing `.env.local`, restart the development server.

Validation: `npm run typecheck`; `node --conditions=react-server --import tsx scripts/workflow-smoke.ts`. The latter uses fake provider responses and does not call paid APIs. QR transfer was also exercised using a synthetic label image through the local network capture page.
