import commonMeds from "@/data/common_meds.json";
import type { Med } from "@/lib/types";

/**
 * Client-safe helpers over the bundled medicine list: one row per ingredient (generic
 * entry preferred), instant filtering by generic OR brand alias, and a merge step for
 * live RxNorm results. Used by the Meds search and the Community picker.
 */
const ALL = commonMeds as Med[];

/** One entry per rxcui, generic name preferred, alphabetical by generic. */
export const GENERIC_OPTIONS: Med[] = (() => {
  const byRxcui = new Map<string, Med>();
  for (const m of ALL) {
    const cur = byRxcui.get(m.rxcui);
    if (!cur || (cur.name.includes("(") && !m.name.includes("("))) byRxcui.set(m.rxcui, m);
  }
  return [...byRxcui.values()].sort((a, b) =>
    (a.ingredientName || a.name).localeCompare(b.ingredientName || b.name),
  );
})();

export function normalizeQuery(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Filter the bundled list. Matches generic names AND brand aliases ("advil" → Ibuprofen),
 * but always returns the generic entry. Empty query → the full alphabetical list.
 */
export function filterCommon(q: string): Med[] {
  const needle = normalizeQuery(q);
  if (!needle) return GENERIC_OPTIONS;
  const scored = new Map<string, number>();
  for (const m of ALL) {
    const name = normalizeQuery(m.name);
    const ing = (m.ingredientName ?? "").toLowerCase();
    let score = -1;
    if (name.startsWith(needle) || ing.startsWith(needle)) score = 0;
    else if (name.split(/[\s(]+/).some((w) => w.startsWith(needle))) score = 1;
    else if (name.includes(needle) || ing.includes(needle)) score = 2;
    if (score < 0) continue;
    const prev = scored.get(m.rxcui);
    if (prev === undefined || score < prev) scored.set(m.rxcui, score);
  }
  return GENERIC_OPTIONS.filter((m) => scored.has(m.rxcui)).sort(
    (a, b) => scored.get(a.rxcui)! - scored.get(b.rxcui)! || (a.ingredientName || a.name).localeCompare(b.ingredientName || b.name),
  );
}

/** Append live results that are not already in the local list. */
export function mergeLive(local: Med[], live: Med[], max = 8): Med[] {
  const seen = new Set(local.map((m) => m.rxcui));
  const out = [...local];
  let extra = 0;
  for (const m of live) {
    if (seen.has(m.rxcui)) continue;
    seen.add(m.rxcui);
    out.push(m);
    if (++extra >= max) break;
  }
  return out;
}
