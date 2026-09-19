/**
 * Offline smoke test for the Dose Explainer pipeline against the in-memory seed DB.
 *   npx tsx --tsconfig tsconfig.json scripts/dose-smoke.ts
 * Exits non-zero if any expectation fails.
 */
import { MemoryDb } from "@/lib/db/memory";
import { plainifyForSpeech } from "@/lib/glossary";
import { parseDirectionsHeuristic } from "@/lib/dose/parse";
import { explainDose, plainifyDraft, templateRewrite } from "@/lib/dose/explain";
import { extractNumbers, g2NoAdvice, g3NumericGrounding, g4Placeholders, restorePlaceholders } from "@/lib/dose/guardrails";
import type { DoseInput, LabelChunk } from "@/lib/types";

const RXCUI: Record<string, string> = { metformin: "6809", ibuprofen: "5640", warfarin: "11289", lisinopril: "29046", acetaminophen: "161", aspirin: "1191" };

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? `  → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

function parse(text: string): DoseInput {
  const p = parseDirectionsHeuristic(text);
  if (!p.rxcui && p.drugName && RXCUI[p.drugName]) p.rxcui = RXCUI[p.drugName];
  return p;
}

async function main() {
  const db = new MemoryDb();
  console.log("== Parser ==");
  const cases: [string, Partial<DoseInput>][] = [
    ["metformin 500 mg, 1 tablet twice daily with meals", { drugName: "metformin", strengthMg: 500, unitsPerDose: 1, timesPerDay: 2, withFood: true, unitLabel: "tablet" }],
    ["take 2 tablets every 6 hours", { unitsPerDose: 2, timesPerDay: 4, unitLabel: "tablet" }],
    ["ibuprofen 200mg 1 tab q6h prn", { drugName: "ibuprofen", strengthMg: 200, unitsPerDose: 1, timesPerDay: 4, asNeeded: true }],
    ["lisinopril 10 mg once a day", { drugName: "lisinopril", strengthMg: 10, timesPerDay: 1 }],
    ["5 tablets 4 times a day", { unitsPerDose: 5, timesPerDay: 4 }],
    ["1 capsule at bedtime", { unitsPerDose: 1, timesPerDay: 1, unitLabel: "capsule" }],
    ["2 puffs twice daily", { unitsPerDose: 2, timesPerDay: 2, unitLabel: "puff", route: "inhaled" }],
    ["ibuprofen 200 mg, 5 tablets 4 times a day", { drugName: "ibuprofen", strengthMg: 200, unitsPerDose: 5, timesPerDay: 4 }],
    ["take 1 tablet 6 to 8 times a day", { unitsPerDose: 1, timesPerDay: null, howOftenText: "6 to 8 times a day" }],
    ["1-2 tablets every 6 to 8 hours", { timesPerDay: null, howOftenText: "every 6 to 8 hours" }],
    // Typical scanned pharmacy-label lines (uppercase, salt + form words).
    ["TAKE 1 TABLET BY MOUTH TWICE DAILY WITH MEALS", { unitsPerDose: 1, timesPerDay: 2, withFood: true, unitLabel: "tablet", route: "oral", drugName: "" }],
    ["METFORMIN HCL 500 MG TABLET", { drugName: "metformin", strengthMg: 500, unitLabel: "tablet" }],
    ["METFORMIN HCL 500 MG TABLET\nTAKE 1 TABLET BY MOUTH TWICE DAILY WITH MEALS".replace("\n", ", "), { drugName: "metformin", strengthMg: 500, unitsPerDose: 1, timesPerDay: 2, withFood: true }],
  ];
  for (const [text, want] of cases) {
    const got = parseDirectionsHeuristic(text);
    const bad = Object.entries(want).filter(([k, v]) => got[k as keyof DoseInput] !== v);
    check(`parse "${text}"`, bad.length === 0, bad.length ? { got, want } : { strengthMg: got.strengthMg, unitsPerDose: got.unitsPerDose, timesPerDay: got.timesPerDay, unitLabel: got.unitLabel, drugName: got.drugName });
  }

  console.log("\n== Guardrails (unit) ==");
  check("G2 flags 'you should take 2 tablets instead'", !g2NoAdvice("you should take 2 tablets instead").ok);
  check("G2 flags 'double the dose'", !g2NoAdvice("double the dose").ok);
  check("G2 allows label 'Do not double the dose'", g2NoAdvice("Do not double the dose the next day.").ok);
  check("G2 allows plain restatement", g2NoAdvice("Take 1 tablet by mouth, 2 times a day, with food.").ok);
  const metIn = parse("metformin 500 mg, 1 tablet twice a day with meals");
  const g3bad = g3NumericGrounding({ plainDose: "Take 1 tablet, 2 times a day", maxPerDayLine: "Do not take more than 3000 mg", timing: [], missedDoseLine: "", numbersUsed: [1, 2, 3000] }, metIn, [{ text: "The maximum recommended daily dose is 2550 mg in adults." }]);
  check("G3 rejects 3000 (not in label or input)", !g3bad.ok && g3bad.unmatched.includes(3000), g3bad.reason);
  const g3good = g3NumericGrounding({ plainDose: "Take 1 tablet, 2 times a day", maxPerDayLine: "The label says do not take more than 2,550 mg in a day.", timing: ["every 12 hours"], missedDoseLine: "", numbersUsed: [1, 2, 2550, 12] }, metIn, [{ text: "The maximum recommended daily dose is 2550 mg in adults." }]);
  check("G3 accepts 2,550 / 12 (label + derived)", g3good.ok, g3good.reason);
  const g3dodge = g3NumericGrounding({ plainDose: "Take it as directed.", maxPerDayLine: "", timing: [], missedDoseLine: "", numbersUsed: [] }, metIn, []);
  check("G3 rejects a plainDose with no numbers", !g3dodge.ok, g3dodge.reason);
  const ph = g4Placeholders("Take 1 tablet of metformin, 500 mg, 2 times a day.", "metformin");
  const bare = ph.template.replace(/\{\{\d+\}\}/g, "");
  check("G4 placeholders round-trip", restorePlaceholders(ph.template, ph.values) === "Take 1 tablet of metformin, 500 mg, 2 times a day." && !/\d|metformin/.test(bare), ph);

  console.log("\n== Plain language (template path) ==");
  const plainChunks: LabelChunk[] = [
    {
      rxcui: "6809",
      ingredient_name: "metformin",
      section: "dosage_and_administration",
      chunk_id: "test-da-1",
      text: "The maximum recommended daily dose is 2550 mg in adults; hypoglycemia may occur with concomitant NSAIDs. If a dose is missed, take it PO with the next meal; do not double the dose.",
    },
  ];
  const rawDraft = templateRewrite(metIn, plainChunks, "en");
  const plainDraft = plainifyDraft(rawDraft);
  check("plainify swaps 'hypoglycemia' → 'low blood sugar' in maxPerDayLine", /low blood sugar/i.test(plainDraft.maxPerDayLine) && !/hypoglycemia/i.test(plainDraft.maxPerDayLine), plainDraft.maxPerDayLine);
  check("plainify swaps 'PO' → 'by mouth' in missedDoseLine", /by mouth/.test(plainDraft.missedDoseLine) && !/\bPO\b/.test(plainDraft.missedDoseLine), plainDraft.missedDoseLine);
  check("plainify adds no digits", extractNumbers(plainDraft.plainDose + plainDraft.maxPerDayLine + plainDraft.missedDoseLine + plainDraft.askYourPharmacist).length === extractNumbers(rawDraft.plainDose + rawDraft.maxPerDayLine + rawDraft.missedDoseLine + rawDraft.askYourPharmacist).length);
  check("G2 still ok after plainify", g2NoAdvice([plainDraft.plainDose, plainDraft.maxPerDayLine, ...plainDraft.timing, plainDraft.missedDoseLine, plainDraft.askYourPharmacist].join("\n")).ok);
  const g3plain = g3NumericGrounding(plainDraft, metIn, plainChunks);
  check("G3 still ok after plainify", g3plain.ok, g3plain.reason);

  console.log("\n== Pipeline: metformin demo (expect consistent) ==");
  const met = await explainDose(metIn, "en", { db });
  console.log(JSON.stringify(met, null, 2));
  check("metformin status consistent", met.status === "consistent", met.status);
  check("metformin plainDose set", met.plainDose.length > 0, met.plainDose);
  check("metformin maxPerDayLine quotes 2550 mg", /2550 mg/.test(met.maxPerDayLine), met.maxPerDayLine);
  check("metformin ceilingChecked", met.ceilingChecked === true);
  check("metformin timing morning/evening", met.timing.join("|") === "morning|evening", met.timing);
  check("metformin plainDose has no medical terms after plainify", met.plainDose === plainifyForSpeech(met.plainDose) && /\bby mouth\b/.test(met.plainDose), met.plainDose);
  check("metformin G3 passed after plainify", met.guardrailLog.some((l) => l.startsWith("G3 ok")), met.guardrailLog);

  console.log("\n== Pipeline: ibuprofen demo (expect above_label_max, fail closed) ==");
  const ibuIn = parse("ibuprofen 200 mg, 5 tablets 4 times a day");
  const ibu = await explainDose(ibuIn, "en", { db });
  console.log(JSON.stringify(ibu, null, 2));
  check("ibuprofen status above_label_max", ibu.status === "above_label_max", ibu.status);
  check("ibuprofen no dose text leaks", ibu.plainDose === "" && ibu.maxPerDayLine === "" && ibu.timing.length === 0 && ibu.numbersUsed.length === 0);
  check("ibuprofen reason has no digits", !!ibu.reason && !/\d/.test(ibu.reason), ibu.reason);
  check("ibuprofen askYourPharmacist has no digits", !/\d/.test(ibu.askYourPharmacist), ibu.askYourPharmacist);
  check("ibuprofen keeps label evidence", ibu.labelQuotes.length > 0, ibu.labelQuotes.map((q) => q.chunkId));

  console.log("\n== Pipeline: extra cases ==");
  const warf = await explainDose(parse("warfarin 5 mg, 1 tablet once a day"), "en", { db });
  check("warfarin consistent with ceilingChecked=false (no limit)", warf.status === "consistent" && warf.ceilingChecked === false, { status: warf.status, ceilingChecked: warf.ceilingChecked });
  check("warfarin missedDoseLine quotes label", /missed dose/i.test(warf.missedDoseLine), warf.missedDoseLine);
  const unknown = await explainDose({ ...parse("2 tablets every 6 hours"), drugName: "mystery", rxcui: "999999" }, "en", { db });
  check("unknown rxcui → unverified, no numbers", unknown.status === "unverified" && unknown.plainDose === "", unknown.reason);
  const es = await explainDose(metIn, "es", { db });
  check("spanish metformin consistent", es.status === "consistent", es.plainDose);
  check("spanish timing", es.timing.join("|") === "mañana|noche", es.timing);
  const prn = await explainDose(parse("ibuprofen 200mg 1 tab q6h prn"), "en", { db });
  check("ibuprofen prn consistent (800 mg/day)", prn.status === "consistent", { plainDose: prn.plainDose, timing: prn.timing, max: prn.maxPerDayLine });

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
