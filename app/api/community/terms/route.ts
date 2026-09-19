import type { NextRequest } from "next/server";
import { z } from "zod";
import { error, json } from "@/lib/http";
import { getDb } from "@/lib/db";
import { officialAdverseReactions, topTerms } from "@/lib/community";
import type { TopTerm } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  rxcui: z.string().trim().regex(/^\d{1,12}$/).optional(),
  /** Ingredient/drug name; used only to fetch the label live when it is not cached yet. */
  name: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(30).optional(),
});

/**
 * GET /api/community/terms?rxcui=&name= → { terms: TopTerm[], official: string | null }
 * terms: most frequent words/tags across approved posts (per med when rxcui given), cached 60 s.
 * official: openFDA adverse_reactions snippet ("From the label") for that med, or null when no rxcui / not available.
 */
export async function GET(req: NextRequest) {
  const raw: Record<string, string> = {};
  for (const [k, v] of new URL(req.url).searchParams) if (v !== "") raw[k] = v;
  const parsed = Query.safeParse(raw);
  if (!parsed.success) return error("Bad request", 400);
  const { rxcui, name, limit } = parsed.data;

  const [terms, official] = await Promise.all([
    topTerms(rxcui, limit ?? 15),
    rxcui ? resolveOfficial(rxcui, name) : Promise.resolve<string | null>(null),
  ]);
  return json<{ terms: TopTerm[]; official: string | null }>({ terms, official });
}

async function resolveOfficial(rxcui: string, name?: string): Promise<string | null> {
  let ingredient = name ?? "";
  if (!ingredient) {
    try {
      const cached = await (await getDb()).getDrugCache(rxcui);
      ingredient = cached?.med.ingredientName ?? cached?.med.name ?? "";
    } catch {
      ingredient = "";
    }
  }
  return officialAdverseReactions(rxcui, ingredient);
}
