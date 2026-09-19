import commonMeds from "@/data/common_meds.json";
import { TtlCache } from "@/lib/http";
import type { Med } from "@/lib/types";

/**
 * Medicine search. Fast path: the bundled common-meds list (offline/demo fallback).
 * Slow path: live RxNorm approximateTerm, resolved to the ingredient-level RxCUI.
 * Never throws — network problems just mean fewer results.
 */

const COMMON: Med[] = (commonMeds as Med[]).map((m) => ({
  name: m.name,
  rxcui: String(m.rxcui),
  ingredientName: m.ingredientName?.toLowerCase(),
}));

const MAX_RESULTS = 8;
const LIVE_MIN_CHARS = 3;
const LIVE_THRESHOLD = 3; // fewer common hits than this → also ask RxNorm
const TIMEOUT_MS = 4000;
const RXNAV = "https://rxnav.nlm.nih.gov/REST";

const liveCache = new TtlCache<Med[]>(60 * 60 * 1000); // 1h
const ingredientCache = new TtlCache<{ rxcui: string; name: string } | null>(60 * 60 * 1000);

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Prefix/substring match against the bundled list. Prefix matches rank first. */
export function searchCommon(q: string, limit = MAX_RESULTS): Med[] {
  const needle = norm(q);
  if (!needle) return [];
  const scored: { med: Med; score: number }[] = [];
  for (const med of COMMON) {
    const name = norm(med.name);
    const ing = med.ingredientName ?? "";
    let score = -1;
    if (name.startsWith(needle)) score = 0;
    else if (ing.startsWith(needle)) score = 1;
    else if (name.split(/[\s(]+/).some((w) => w.startsWith(needle))) score = 2;
    else if (name.includes(needle) || ing.includes(needle)) score = 3;
    if (score >= 0) scored.push({ med, score });
  }
  scored.sort((x, y) => x.score - y.score || x.med.name.localeCompare(y.med.name));
  return scored.slice(0, limit).map((s) => s.med);
}

/** Lookup by rxcui in the bundled list (generic entry preferred over brand alias). */
export function getCommonByRxcui(rxcui: string): Med | null {
  const hits = COMMON.filter((m) => m.rxcui === String(rxcui).trim());
  if (!hits.length) return null;
  return hits.find((m) => !m.name.includes("(")) ?? hits[0];
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface ApproxResponse {
  approximateGroup?: { candidate?: { rxcui?: string; name?: string; score?: string; rank?: string }[] };
}
interface RelatedResponse {
  relatedGroup?: { conceptGroup?: { tty?: string; conceptProperties?: { rxcui: string; name: string; tty?: string }[] }[] };
}
interface PropResponse {
  propConceptGroup?: { propConcept?: { propName?: string; propValue?: string }[] };
}

/** Resolve any RxNorm concept to its ingredient (IN, else multi-ingredient MIN). */
async function resolveIngredient(rxcui: string): Promise<{ rxcui: string; name: string } | null> {
  const cached = ingredientCache.get(rxcui);
  if (cached !== undefined) return cached;
  const data = await getJson<RelatedResponse>(`${RXNAV}/rxcui/${encodeURIComponent(rxcui)}/related.json?tty=IN+MIN`);
  const groups = data?.relatedGroup?.conceptGroup ?? [];
  const pick =
    groups.find((g) => g.tty === "IN")?.conceptProperties?.[0] ?? groups.find((g) => g.tty === "MIN")?.conceptProperties?.[0];
  const out = pick ? { rxcui: String(pick.rxcui), name: pick.name } : null;
  ingredientCache.set(rxcui, out);
  return out;
}

async function conceptName(rxcui: string): Promise<string | null> {
  const data = await getJson<PropResponse>(`${RXNAV}/rxcui/${encodeURIComponent(rxcui)}/property.json?propName=RxNorm%20Name`);
  return data?.propConceptGroup?.propConcept?.[0]?.propValue ?? null;
}

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Live RxNorm lookup, resolved to ingredient rxcui. Cached 1h. Swallows all errors. */
export async function searchRxNormLive(q: string): Promise<Med[]> {
  const key = norm(q);
  const hit = liveCache.get(key);
  if (hit) return hit;

  const approx = await getJson<ApproxResponse>(
    `${RXNAV}/approximateTerm.json?term=${encodeURIComponent(key)}&maxEntries=${MAX_RESULTS}`,
  );
  const candidates = approx?.approximateGroup?.candidate ?? [];
  const seenCandidate = new Set<string>();
  const uniq = candidates.filter((c) => {
    if (!c.rxcui || seenCandidate.has(c.rxcui)) return false;
    seenCandidate.add(c.rxcui);
    return true;
  });

  const resolved = await Promise.all(
    uniq.map(async (c): Promise<Med | null> => {
      const rxcui = String(c.rxcui);
      const ing = await resolveIngredient(rxcui);
      // Only keep candidates that resolve to a real ingredient; this drops devices,
      // supplies and odd product names that approximateTerm also matches.
      if (!ing) return null;
      const candName = c.name ?? (await conceptName(rxcui));
      const ingName = ing.name.toLowerCase();
      const showBrand = candName && norm(candName) !== ingName && candName.length <= 40 && !/\d/.test(candName);
      return {
        name: showBrand ? `${candName} (${ingName})` : titleCase(ingName),
        rxcui: ing.rxcui,
        ingredientName: ingName,
      };
    }),
  );

  const out: Med[] = [];
  const seen = new Set<string>();
  for (const m of resolved) {
    if (!m || seen.has(m.rxcui)) continue;
    seen.add(m.rxcui);
    out.push(m);
  }
  liveCache.set(key, out);
  return out;
}

/**
 * Search-as-you-type entry point. Common list first; live RxNorm when the local
 * list has fewer than 3 hits and the query is at least 3 characters. Deduped by rxcui.
 */
export async function searchMeds(q: string): Promise<Med[]> {
  const query = norm(q);
  if (!query) return [];
  const local = searchCommon(query, MAX_RESULTS);
  if (local.length >= LIVE_THRESHOLD || query.length < LIVE_MIN_CHARS) return local;

  const live = await searchRxNormLive(query);
  const seen = new Set(local.map((m) => m.rxcui));
  const merged = [...local];
  for (const m of live) {
    if (seen.has(m.rxcui)) continue;
    seen.add(m.rxcui);
    // Prefer our curated display name when the ingredient is one we know.
    merged.push(getCommonByRxcui(m.rxcui) ?? m);
    if (merged.length >= MAX_RESULTS) break;
  }
  return merged;
}
