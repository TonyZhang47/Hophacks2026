import type { NextRequest } from "next/server";
import { z } from "zod";
import { error, json } from "@/lib/http";
import { getDb } from "@/lib/db";
import { SummarizeError, summarizeOfficialLabel } from "@/lib/community";
import { searchMeds } from "@/lib/rxnorm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  rxcui: z.string().trim().regex(/^\d{1,12}$/).optional(),
  name: z.string().trim().max(80).optional(),
  lang: z.enum(["en", "es"]).optional(),
});

/**
 * POST /api/community/summarize { rxcui?, name?, lang? } → { summary }
 * Opt-in Grok summary of the official adverse-reactions section. Fail closed.
 */
export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return error("Send JSON.", 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return error("Bad request", 400);
  const { rxcui, name, lang } = parsed.data;
  const resolved = await resolveRxcui(rxcui, name);
  if (!resolved) return error("Pick a medicine first.", 400);
  try {
    const summary = await summarizeOfficialLabel(resolved.rxcui, resolved.ingredient, lang ?? "en");
    return json({ summary });
  } catch (e) {
    if (e instanceof SummarizeError) {
      const status = e.code === "nolabel" ? 404 : 503;
      return error(e.message, status);
    }
    return error("We couldn't summarize that right now.", 503);
  }
}

async function resolveRxcui(rxcui?: string, name?: string) {
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
  return { rxcui: rx, ingredient: ingredient || name || "" };
}
