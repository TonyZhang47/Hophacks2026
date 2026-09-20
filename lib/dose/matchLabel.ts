import "server-only";
import { z } from "zod";
import commonMeds from "@/data/common_meds.json";
import { parseDirectionsHeuristic } from "@/lib/dose/parse";
import { isXaiConfigured } from "@/lib/env";
import { chatJson } from "@/lib/llm";
import { getCommonByRxcui, searchMeds } from "@/lib/rxnorm";
import type { Med } from "@/lib/types";

const MAX_CANDIDATES = 8;

const PickSchema = z.object({
  rxcui: z.string().nullable(),
});

const ExtractSchema = z.object({
  name: z.string().nullable(),
  rxcui: z.string().nullable(),
});

const SYSTEM =
  "You match a pharmacy-label transcript to ONE medicine from the candidate list. " +
  "Return JSON { \"rxcui\": string | null }. rxcui MUST be copied exactly from a candidate. " +
  "If none of the candidates is the printed drug, return { \"rxcui\": null }. " +
  "Never invent a name, rxcui, or extra medicine.";

const EXTRACT_SYSTEM =
  "You read a pharmacy-label transcript and match it to a medicine catalog. " +
  "Return JSON { \"name\": string | null, \"rxcui\": string | null }. " +
  "name is the printed brand or generic only — no strength, form, or directions. " +
  "If that medicine is in the catalog, copy its rxcui exactly. " +
  "If it is not in the catalog, rxcui is null and name is still the printed drug. " +
  "If you cannot tell the drug, both fields are null. Never invent an rxcui.";

function catalogGenerics(): Med[] {
  const seen = new Set<string>();
  const out: Med[] = [];
  for (const raw of commonMeds as Med[]) {
    const rxcui = String(raw.rxcui || "").trim();
    if (!rxcui || seen.has(rxcui) || /\(/.test(raw.name)) continue;
    seen.add(rxcui);
    out.push({ name: raw.name, rxcui, ingredientName: raw.ingredientName });
  }
  return out;
}

function looksLikeDirections(q: string): boolean {
  return /^(?:take|taking|takes|use|using|give|apply|by mouth)\b/i.test(q) ||
    /\b(?:by mouth|twice daily|once daily|every \d|as needed|tablets? by)\b/i.test(q);
}

function uniqueMeds(hits: Med[]): Med[] {
  const seen = new Set<string>();
  const out: Med[] = [];
  for (const m of hits) {
    const id = String(m.rxcui || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(getCommonByRxcui(id) ?? m);
    if (out.length >= MAX_CANDIDATES) break;
  }
  return out;
}

/** Query for catalog search: a parsed medicine name only — never a directions/sig line. */
export function searchQueryFromLabel(drugName: string | undefined, lines: string[]): string {
  const named = drugName?.replace(/\s+/g, " ").trim();
  if (named && !looksLikeDirections(named)) return named.slice(0, 80);
  for (const line of lines) {
    const parsed = parseDirectionsHeuristic(line).drugName.trim();
    if (parsed && !looksLikeDirections(parsed)) return parsed.slice(0, 80);
  }
  return "";
}

export interface LabelMatch {
  match: Med | null;
  candidates: Med[];
}

/**
 * Map OCR text to catalog medicines (RxNorm / bundled list). Grok may only pick
 * from those candidates. First catalog hit is the fallback if Grok is down or
 * returns an id that is not in the list. A deliberate Grok "none" stays null.
 */
async function grokExtractFromCatalog(transcript: string): Promise<{ name: string | null; rxcui: string | null }> {
  const catalog = catalogGenerics();
  const picked = await chatJson(
    EXTRACT_SYSTEM,
    JSON.stringify({
      transcript: transcript.slice(0, 800),
      catalog: catalog.map((m) => ({ rxcui: m.rxcui, name: m.name })),
    }),
    ExtractSchema,
    { temperature: 0, maxTokens: 120 },
  );
  const name = picked.name?.replace(/\s+/g, " ").trim() || null;
  const rxcui = picked.rxcui?.trim() || null;
  const inCatalog = !!(rxcui && catalog.some((m) => m.rxcui === rxcui));
  return { name: name && !looksLikeDirections(name) ? name.slice(0, 80) : null, rxcui: inCatalog ? rxcui : null };
}

export async function matchLabelToCatalog(transcript: string, drugName?: string): Promise<LabelMatch> {
  const lines = transcript.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let extractedName: string | null = null;
  let extractedRxcui: string | null = null;
  if (isXaiConfigured()) {
    try {
      const extracted = await grokExtractFromCatalog(transcript);
      extractedName = extracted.name;
      extractedRxcui = extracted.rxcui;
    } catch {
      /* heuristic + RxNorm search still run below */
    }
  }
  const catalogHit = extractedRxcui ? getCommonByRxcui(extractedRxcui) : null;
  const query = extractedName || searchQueryFromLabel(drugName, lines);
  const searched = uniqueMeds(query ? await searchMeds(query) : []);
  const candidates = uniqueMeds(catalogHit ? [catalogHit, ...searched] : searched);
  if (catalogHit) return { match: catalogHit, candidates };
  if (!candidates.length) {
    return { match: null, candidates: [] };
  }

  if (!isXaiConfigured()) return { match: candidates[0] ?? null, candidates };

  try {
    const picked = await chatJson(
      SYSTEM,
      JSON.stringify({
        transcript,
        candidates: candidates.map((m) => ({
          rxcui: m.rxcui,
          name: m.name,
          ingredientName: m.ingredientName ?? "",
        })),
      }),
      PickSchema,
      { temperature: 0, maxTokens: 200 },
    );
    const id = picked.rxcui?.trim();
    const match = !id ? null : candidates.find((m) => m.rxcui === id) ?? candidates[0] ?? null;
    if (!id) return { match: null, candidates };
    return { match, candidates };
  } catch {
    return { match: candidates[0] ?? null, candidates };
  }
}
