/**
 * Smoke test for the G4 placeholder protect/restore in lib/translate.ts (no network).
 * Run: npx tsx scripts/translate-smoke.ts
 */
import { protect, restore } from "../lib/translate";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` → ${JSON.stringify(detail)}`}`);
  if (!ok) failures++;
}

// 1) Numbers + units + times + drug names are shielded.
const src = "Take 1 tablet of Metformin by mouth, 2 times a day, with food. Do not take more than 2,550 mg in a day. Wait 6 hours between doses.";
const p = protect(src, ["metformin"]);
console.log("protected:", p.text);
console.log("slots:", p.slots);
check("no digits remain in protected text", !/\d(?![^{]*\}\})/.test(p.text.replace(/\{\{\d+\}\}/g, "")));
check("drug name shielded", p.slots.some((s) => s.toLowerCase() === "metformin"));
check("2,550 mg shielded as one unit", p.slots.includes("2,550 mg"));
check("6 hours shielded as one unit", p.slots.includes("6 hours"));
check("2 times shielded", p.slots.includes("2 times"));
check("round trip identity", restore(p.text, p.slots) === src, restore(p.text, p.slots));

// 2) Simulated good translation keeps every placeholder once → restored.
const fake = "Tome {{1}} de {{0}} por la boca, {{2}} al día, con comida. No tome más de {{3}} en un día. Espere {{4}} entre dosis.";
const r = restore(fake, p.slots);
check("restored translation has originals", r !== null && r.includes("2,550 mg") && r.includes("Metformin") && r.includes("6 hours"), r);

// 3) Dropped placeholder → null (caller keeps original).
check("dropped placeholder rejected", restore("Tome {{1}} de {{0}} por la boca, con comida.", p.slots) === null);
// 4) Duplicated placeholder → null.
check("duplicated placeholder rejected", restore(fake + " {{3}}", p.slots) === null);
// 5) Model invented a digit → null.
check("stray digit rejected", restore(fake.replace("con comida", "con comida 3 veces"), p.slots) === null);
// 6) Unknown placeholder → null.
check("unknown placeholder rejected", restore(fake + " {{9}}", p.slots) === null);
// 7) Trailing period not swallowed.
const p2 = protect("Do not take more than 8.");
check("trailing period kept outside slot", p2.slots.includes("8") && p2.text.endsWith("."), p2);
// 8) protect=false path shape (no names, no numbers).
const p3 = protect("Talk with your pharmacist.");
check("no placeholders when nothing to protect", p3.slots.length === 0 && p3.text === "Talk with your pharmacist.");

if (failures) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
console.log("OK: G4 protect/restore behaves");
