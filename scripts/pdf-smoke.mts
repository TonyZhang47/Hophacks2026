/**
 * Smoke test for lib/pdf.tsx. Writes /tmp/rxplain-smoke.pdf by default and asserts it is > 5 KB
 * and that a non-"consistent" dose prints no numbers.
 *
 * @react-pdf/renderer 4.x is ESM-only and tsx's CJS resolver cannot load its `@react-pdf/hyphenate/en-us`
 * subpath (Next.js bundles it fine via serverExternalPackages). Run it as a real ESM bundle instead:
 *
 *   node_modules/.bin/esbuild scripts/pdf-smoke.mts --bundle --platform=node --format=esm \
 *     --packages=external --jsx=automatic --outfile=node_modules/.cache/rxplain/pdf-smoke.mjs \
 *   && node node_modules/.cache/rxplain/pdf-smoke.mjs [outPath]
 */
import { writeFileSync, statSync } from "node:fs";
import { buildShareSheetPdf } from "../lib/pdf";
import type { ShareSheetData } from "../components/share/ShareSheetButton";

const sample: ShareSheetData = {
  meds: [
    { name: "metformin", rxcui: "6809" },
    { name: "lisinopril", rxcui: "29046" },
    { name: "ibuprofen", rxcui: "5640" },
  ],
  cards: [
    {
      drugA: "lisinopril",
      drugB: "ibuprofen",
      severity: "moderate",
      whatHappens: "Ibuprofen can make lisinopril work less well and can be hard on the kidneys when taken together.",
      howSerious: "Moderate",
      whatToDo: "Tell your pharmacist you take both. Ask whether acetaminophen is a better choice for pain.",
      askYourClinician: "Is it okay for me to use ibuprofen while I take lisinopril?",
      citations: ["ddinter:29046-5640"],
    },
    {
      drugA: "metformin",
      drugB: "ibuprofen",
      severity: "minor",
      whatHappens: "Ibuprofen may slightly change how your body handles metformin.",
      howSerious: "Minor",
      whatToDo: "No special steps for most people. Mention it at your next visit.",
      askYourClinician: "Should I watch for anything when I take these two together?",
      citations: ["ddinter:6809-5640"],
    },
  ],
  doses: [
    {
      input: {
        drugName: "metformin",
        rxcui: "6809",
        strengthMg: 500,
        unitsPerDose: 1,
        unitLabel: "tablet",
        timesPerDay: 2,
        route: "oral",
        withFood: true,
        asNeeded: false,
        userText: "metformin 500 mg, 1 tablet twice daily with meals",
      },
      result: {
        status: "consistent",
        plainDose: "Take 1 tablet by mouth, 2 times a day, with food.",
        maxPerDayLine: "The label says do not take more than 2,550 mg in a day.",
        timing: ["morning with breakfast", "evening with dinner"],
        missedDoseLine: "",
        labelQuotes: [{ chunkId: "c1", text: "The maximum recommended daily dose is 2550 mg." }],
        numbersUsed: [500, 1, 2, 2550],
        askYourPharmacist: "Is it okay to take this with my other medicines?",
        ceilingChecked: true,
        guardrailLog: [],
      },
    },
    {
      input: {
        drugName: "ibuprofen",
        rxcui: "5640",
        strengthMg: 800,
        unitsPerDose: 2,
        unitLabel: "tablet",
        timesPerDay: 4,
        route: "oral",
        withFood: null,
        asNeeded: true,
        userText: "ibuprofen 800 mg, 2 tablets four times a day",
      },
      result: {
        status: "above_label_max",
        plainDose: "THIS SHOULD NOT PRINT: 800 mg x 2 x 4",
        maxPerDayLine: "THIS SHOULD NOT PRINT: 3200 mg",
        timing: [],
        missedDoseLine: "",
        labelQuotes: [],
        numbersUsed: [800, 2, 4],
        askYourPharmacist: "My directions add up to more than the label's daily maximum — is that right?",
        reason: "Your directions add up to more than the label's daily maximum",
        ceilingChecked: true,
        guardrailLog: ["G3 ceiling exceeded"],
      },
    },
  ],
  clinic: {
    clinic_id: "hrsa-1",
    name: "Valley Community Health Center",
    site_type: "FQHC",
    address: "120 Main St",
    city: "Cumberland",
    state: "MD",
    zip: "21502",
    lat: 39.65,
    lon: -78.76,
    phone: "(301) 555-0134",
    accepts_medicaid: true,
    accepts_medicare: true,
    sliding_fee: true,
    source: "hrsa",
    distanceMiles: 4.2,
    communityConfirmed: [{ insurer: "Blue Cross", yes: 2, no: 0 }],
  },
};

async function main() {
  const out = process.argv[2] ?? "/tmp/rxplain-smoke.pdf";
  const pdf = await buildShareSheetPdf(sample, new Date("2026-09-19T12:00:00Z"));
  writeFileSync(out, pdf);
  const size = statSync(out).size;
  const header = pdf.subarray(0, 5).toString("latin1");
  console.log(`wrote ${out} (${size} bytes) header=${JSON.stringify(header)}`);
  if (header !== "%PDF-") throw new Error("not a PDF");
  if (size <= 5 * 1024) throw new Error(`PDF too small: ${size} bytes`);
  // The fail-closed dose must not leak numbers into the PDF text stream.
  const text = pdf.toString("latin1");
  if (text.includes("SHOULD NOT PRINT")) throw new Error("fail-closed dose text leaked into PDF");
  console.log("OK: size > 5 KB, fail-closed dose omitted");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
