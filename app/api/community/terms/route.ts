import type { NextRequest } from "next/server";
import { z } from "zod";
import { error, json } from "@/lib/http";
import { getDb } from "@/lib/db";
import { officialAdverseReactions, topTerms } from "@/lib/community";
import { searchMeds } from "@/lib/rxnorm";
import type { TopTerm } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  rxcui: z.string().trim().regex(/^\d{1,12}$/).optional(),
  /** Ingredient/drug name; used to fetch the label live when it is not cached yet. */
  name: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(30).optional(),
  /** When set, official preview is the full cleaned section (same cache). */
  full: z.enum(["1", "true"]).optional(),
});

export interface TermsOfficialPayload {
  terms: TopTerm[];
  official: string | null;
  officialFull: string | null;
  officialHasMore: boolean;
}

/**
 * GET /api/community/terms?rxcui=&name= → terms + official label preview/full.
 * official: cleaned preview (~500 chars). officialFull: entire adverse_reactions section.
 */
export async function GET(req: NextRequest) {
  const raw: Record<string, string> = {};
  for (const [k, v] of new URL(req.url).searchParams) if (v !== "") raw[k] = v;
  const parsed = Query.safeParse(raw);
  if (!parsed.success) return error("Bad request", 400);
  const { rxcui, name, limit, full } = parsed.data;

  const [terms, label] = await Promise.all([
    topTerms(rxcui, limit ?? 15, name),
    resolveOfficial(rxcui, name),
  ]);
  const wantFull = !!full;
  const officialFull = label?.full ?? null;
  const preview = label?.preview ?? null;
  const official = wantFull ? officialFull : preview;
  const officialHasMore = !!(officialFull && preview && officialFull.length > preview.length);
  return json<TermsOfficialPayload>({ terms, official, officialFull, officialHasMore });
}

async function resolveOfficial(rxcui?: string, name?: string) {
  let rx = rxcui;
  let ingredient = name ?? "";
  if (!rx && name) {
    try {
      const hits = await searchMeds(name);
      const first = hits.find((m) => /^\d{1,12}$/.test(m.rxcui));
      if (first) {
        rx = first.rxcui;
        ingredient = first.ingredientName || first.name || name;
      }
    } catch {
      /* keep looking with name only */
    }
  }
  if (!rx) return null;
  if (!ingredient) {
    try {
      const cached = await (await getDb()).getDrugCache(rx);
      ingredient = cached?.med.ingredientName ?? cached?.med.name ?? "";
    } catch {
      ingredient = "";
    }
  }
  return officialAdverseReactions(rx, ingredient || name || "");
}
