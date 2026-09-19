import commonMeds from "@/data/common_meds.json";
import type { Med } from "@/lib/types";

/**
 * Drug name ↔ common (brand) name. Isomorphic. Built from data/common_meds.json where
 * brand entries look like "Advil (ibuprofen)" and share the ingredient rxcui.
 */
interface Row {
  name: string;
  rxcui: string;
  ingredientName: string;
}
const ROWS = commonMeds as Row[];

const byRxcui = new Map<string, { generic: string; brands: string[] }>();
for (const r of ROWS) {
  const entry = byRxcui.get(r.rxcui) ?? { generic: r.ingredientName, brands: [] };
  const m = r.name.match(/^(.+?)\s*\((.+)\)$/);
  if (m) {
    const brand = m[1].trim();
    if (!entry.brands.includes(brand)) entry.brands.push(brand);
  } else {
    entry.generic = r.ingredientName || r.name.toLowerCase();
  }
  byRxcui.set(r.rxcui, entry);
}

const brandToGeneric = new Map<string, string>();
for (const [, e] of byRxcui) for (const b of e.brands) brandToGeneric.set(b.toLowerCase(), e.generic);

/** Brand names people know this ingredient by (e.g. ibuprofen → ["Advil", "Motrin"]). */
export function brandNamesFor(rxcui: string): string[] {
  return byRxcui.get(rxcui)?.brands ?? [];
}

/** Generic (ingredient) name for a brand, if we know it. */
export function genericFor(name: string): string | null {
  return brandToGeneric.get(name.toLowerCase().trim()) ?? null;
}

/** "ibuprofen (also sold as Advil, Motrin)" — for chips, cards, confirmation screens. */
export function displayName(med: Pick<Med, "name" | "rxcui" | "ingredientName">): string {
  const generic = med.ingredientName || byRxcui.get(med.rxcui)?.generic || med.name;
  const brands = brandNamesFor(med.rxcui).filter((b) => b.toLowerCase() !== generic.toLowerCase());
  const g = capitalize(generic);
  return brands.length ? `${g} (also sold as ${brands.slice(0, 3).join(", ")})` : g;
}

/** Short form for tight spaces: "Ibuprofen · Advil, Motrin". */
export function shortName(med: Pick<Med, "name" | "rxcui" | "ingredientName">): { generic: string; brands: string[] } {
  const generic = capitalize(med.ingredientName || byRxcui.get(med.rxcui)?.generic || med.name);
  return { generic, brands: brandNamesFor(med.rxcui).slice(0, 3) };
}

export function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
