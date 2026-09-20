import commonMeds from "@/data/common_meds.json";
import type { Med } from "@/lib/types";

/**
 * Client-safe helpers over the bundled medicine list: one row per ingredient (generic
 * entry preferred). My medicines filters by generic/ingredient only; brand-alias
 * matching stays available for OCR via filterCommon.
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

function ingredientName(med: Med): string {
  return (med.ingredientName ?? "").toLowerCase();
}

function tokensMatch(haystack: string, needle: string): boolean {
  if (!haystack || !needle) return false;
  return haystack.startsWith(needle) || haystack.split(/\s+/).some((w) => w.startsWith(needle)) || haystack.includes(needle);
}

/**
 * Names that count as the actual drug: ingredient, parenthetical generic, and
 * (for bundled generic rows) the display name including "Vitamin D3".
 * Brand prefixes like "Advil" in "Advil (ibuprofen)" are excluded.
 */
function actualDrugNames(med: Med, includeGenericDisplay: boolean): string[] {
  const ing = ingredientName(med);
  const m = med.name.match(/^(.+?)\s*\((.+)\)$/);
  const names = new Set<string>();
  if (ing) names.add(ing);
  if (m) {
    names.add(normalizeQuery(m[2]));
    if (includeGenericDisplay) names.add(normalizeQuery(m[1]));
  } else {
    const bare = normalizeQuery(med.name);
    if (!ing || bare === ing || includeGenericDisplay) names.add(bare);
  }
  return [...names].filter(Boolean);
}

/** True when the typed query appears in the generic or ingredient name (not a brand alias). */
export function queryMatchesGeneric(q: string, med: Med): boolean {
  const needle = normalizeQuery(q);
  if (!needle) return true;
  return actualDrugNames(med, false).some((n) => tokensMatch(n, needle));
}

function rankGeneric(needle: string, med: Med): number {
  const names = actualDrugNames(med, true);
  if (names.some((n) => n.startsWith(needle))) return 0;
  if (names.some((n) => n.split(/\s+/).some((w) => w.startsWith(needle)))) return 1;
  if (names.some((n) => n.includes(needle))) return 2;
  return -1;
}

/**
 * My medicines: match generic/ingredient names only. Typing a brand (e.g. Advil)
 * does not list the ingredient. Empty query → the full alphabetical list.
 */
export function filterGenericOnly(q: string): Med[] {
  const needle = normalizeQuery(q);
  if (!needle) return GENERIC_OPTIONS;
  return GENERIC_OPTIONS.map((m) => ({ m, score: rankGeneric(needle, m) }))
    .filter((x) => x.score >= 0)
    .sort(
      (a, b) =>
        a.score - b.score ||
        (a.m.ingredientName || a.m.name).localeCompare(b.m.ingredientName || b.m.name),
    )
    .map((x) => x.m);
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

/** Live RxNorm hits whose generic/ingredient contains the typed query (drops brand→generic mapping). */
export function mergeLiveGeneric(local: Med[], live: Med[], q: string, max = 8): Med[] {
  return mergeLive(
    local,
    live.filter((m) => queryMatchesGeneric(q, m)),
    max,
  );
}
