import { checkFoods, GUIDE_INGREDIENTS } from "@/lib/food";
import commonMeds from "@/data/common_meds.json";

const r = checkFoods([
  { name: "Lipitor (atorvastatin)", rxcui: "83367", ingredientName: "atorvastatin" },
  { name: "Warfarin Sodium", rxcui: "11289" },
  { name: "Metoprolol Tartrate", rxcui: "6918" },
  { name: "Potassium Chloride", rxcui: "8591", ingredientName: "potassium chloride" },
  { name: "Tamsulosin", rxcui: "77492", ingredientName: "tamsulosin" },
]);
console.log(r.map((x) => [x.medicine.name, x.food, x.severity, x.source]));
console.log("es:", checkFoods([{ name: "Zoloft (sertraline)", rxcui: "36437" }], "es").map((x) => [x.food, x.explanation]));

const uniq = Array.from(new Set((commonMeds as { ingredientName: string }[]).map((m) => m.ingredientName)));
const covered = uniq.filter((g) => GUIDE_INGREDIENTS.includes(g));
console.log(`guide ingredients: ${GUIDE_INGREDIENTS.length}; common_meds generics: ${uniq.length}; covered: ${covered.length}`);
console.log("not covered:", uniq.filter((g) => !GUIDE_INGREDIENTS.includes(g)).join(", "));
const ids = checkFoods((commonMeds as { name: string; rxcui: string; ingredientName: string }[])).map((x) => x.id);
console.log("duplicate ids:", ids.length - new Set(ids).size);
const byRx = new Map<string, { name: string; rxcui: string; ingredientName: string }>();
for (const m of commonMeds as { name: string; rxcui: string; ingredientName: string }[]) if (!byRx.has(m.rxcui)) byRx.set(m.rxcui, m);
const ids2 = checkFoods(Array.from(byRx.values())).map((x) => x.id);
console.log("duplicate ids (unique rxcui):", ids2.length - new Set(ids2).size);
console.log("brand-only:", checkFoods([{ name: "Zoloft (sertraline)", rxcui: "36437" }, { name: "Advil", rxcui: "5640" }, { name: "Norvasc", rxcui: "17767" }]).map((x) => [x.medicine.name, x.food]));
