import "server-only";
import { z } from "zod";
import { isXaiConfigured } from "@/lib/env";
import { chatJson } from "@/lib/llm";
import { getCommonByRxcui, searchMeds } from "@/lib/rxnorm";
import type { Med } from "@/lib/types";

const MAX_CANDIDATES = 8;

const PickSchema = z.object({
  rxcui: z.string().nullable(),
});

const SYSTEM =
  "You match a pharmacy-label transcript to ONE medicine from the candidate list. " +
  "Return JSON { \"rxcui\": string | null }. rxcui MUST be copied exactly from a candidate. " +
  "If none of the candidates is the printed drug, return { \"rxcui\": null }. " +
  "Never invent a name, rxcui, or extra medicine.";

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

/** Query for catalog search: heuristic name, else first transcript line without strength. */
export function searchQueryFromLabel(drugName: string | undefined, lines: string[]): string {
  const named = drugName?.replace(/\s+/g, " ").trim();
  if (named) return named.slice(0, 80);
  const first = (lines[0] ?? "")
    .replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml)\b/gi, " ")
    .replace(/\b(?:hcl|hydrochloride|tablet[s]?|capsule[s]?|oral)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return first.slice(0, 80);
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
export async function matchLabelToCatalog(transcript: string, drugName?: string): Promise<LabelMatch> {
  const lines = transcript.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const query = searchQueryFromLabel(drugName, lines);
  const candidates = uniqueMeds(query ? await searchMeds(query) : []);
  if (!candidates.length) return { match: null, candidates: [] };

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
    if (!id) return { match: null, candidates };
    return { match: candidates.find((m) => m.rxcui === id) ?? candidates[0] ?? null, candidates };
  } catch {
    return { match: candidates[0] ?? null, candidates };
  }
}
