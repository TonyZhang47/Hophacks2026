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

/** Display name = the generic only ("Ibuprofen"). Brands are searchable but never appended (team decision). */
export function displayName(med: Pick<Med, "name" | "rxcui" | "ingredientName">): string {
  return capitalize(genericNameOf(med));
}

/** Short form: generic only; `brands` is kept in the shape for callers but is always empty now. */
export function shortName(med: Pick<Med, "name" | "rxcui" | "ingredientName">): { generic: string; brands: string[] } {
  return { generic: capitalize(genericNameOf(med)), brands: [] };
}

function genericNameOf(med: Pick<Med, "name" | "rxcui" | "ingredientName">): string {
  if (med.ingredientName) return med.ingredientName;
  const known = byRxcui.get(med.rxcui)?.generic;
  if (known) return known;
  const m = med.name.match(/^(.+?)\s*\((.+)\)$/); // "Advil (ibuprofen)" from live RxNorm
  return m ? m[2].trim() : med.name;
}

export function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
