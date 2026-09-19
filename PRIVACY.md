# Privacy Policy — RxPlain

**Last updated:** September 18, 2026  
**Product:** RxPlain (HopHacks 2026 — Philanthropy track hackathon demo)

This Privacy Policy explains what RxPlain does and does not collect. This is an educational hackathon project, not a commercial health product and not a HIPAA-covered entity.

## 1. Who we are
RxPlain is a student-built **philanthropy / social-good** demo for HopHacks. It widens access to understanding medication labels for people shut out by jargon, vision barriers, or cognitive load. It is not a pharmacy, clinic, healthcare platform, or medical device manufacturer.

## 2. What the product is for
RxPlain lets you search medications, view plain-language summaries grounded in public data sources, hear results aloud, and optionally export a one-page educational share sheet for a caregiver or appointment discussion.

## 3. Information we process

### Information you provide
- Medication names you search or select (and related identifiers such as RxCUI from public databases)
- Optional first name if you enter one for a PDF export
- Optional prescription images if you use photo upload (stretch feature)

### Information processed automatically
- Basic technical logs needed to run the demo (e.g. request errors, rate-limit handling)
- Server-side caches in **Snowflake** (drug lookup cache, interaction rows, optional anonymous session JSON) — no advertising IDs, precise location, or contact lists

### Sensitive health information
Medication lists can imply health status. Treat anything you enter as **sensitive**. Prefer sample or fictional meds during demos. Do not enter real patient identifiers (full legal name, MRN, address, phone, SSN, insurance ID). Do not store those identifiers in Snowflake.

## 4. How we use information
- To look up drug names and interaction evidence (RxNorm, openFDA, DDInter)
- To generate plain-language explanations and spoken audio via xAI Grok APIs
- To generate a PDF you download
- To keep the service working (caching, rate limits, debugging during the hackathon)

We do **not** sell personal information. We do **not** use your medication list for advertising.

## 5. Third-party services
RxPlain sends necessary request data to third parties to function:

| Service | Purpose |
| --- | --- |
| NLM RxNorm | Drug name search / normalization |
| openFDA | Label evidence snippets |
| Snowflake | Server-side interaction store + caches (credentials never in the browser) |
| xAI (Grok) | Plain-language rewrite, voice, optional vision/Imagine |
| Hosting (e.g. Vercel) | App hosting |

Those providers process data under their own terms and policies. Do not submit information you are not comfortable sharing with those services.

## 6. Storage and retention
- Hackathon default: anonymous or local UI state plus optional Snowflake caches/sessions without login.
- Prescription photos (if enabled): process for the request only; do not store longer than needed unless you explicitly opt in to save (default: do not save).
- Snowflake: interaction seed data and caches; purge demo session rows after the event when practical.
- Server logs: keep only as long as needed for debugging during the event, then discard.
- We do not operate a production patient database or user accounts.

## 7. Children
RxPlain is not directed at children under 13. Do not use it to manage a minor’s real prescriptions as a clinical tool.

## 8. Security
We keep API keys on the server and never embed them in the browser. No method of transmission over the Internet is fully secure. Do not upload real clinical documents containing identifiers.

## 9. Your choices
- Clear meds from the UI / clear site data in your browser to remove local state
- Do not upload photos or enter names you want kept private
- Stop using the demo at any time

## 10. Not medical advice / not a covered entity
RxPlain is for education and accessibility demonstration only. It does not create a patient–provider relationship. A hackathon demo is **not** a HIPAA “covered entity” or “business associate” product. Do not use it for real clinical decision-making.

## 11. International users
Servers and third-party APIs may be located in the United States or other regions. If that is not acceptable, do not use the demo.

## 12. Changes
We may update this policy during or after the hackathon. The “Last updated” date will change when we do.

## 13. Contact
For questions about this demo’s privacy practices during HopHacks 2026, contact the RxPlain team via the project repository:
https://github.com/TonyZhang47/Hophacks2026
