import type { NextRequest } from "next/server";
import { z } from "zod";
import { error, json } from "@/lib/http";
import { checkInteractions } from "@/lib/interactions";
import { buildCards, summarize } from "@/lib/cards";
import type { InteractionCard, InteractionResult, Med } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MedSchema = z.object({
  name: z.string().trim().min(1).max(120),
  rxcui: z.string().trim().min(1).max(20),
  ingredientName: z.string().trim().max(120).optional(),
});

const BodySchema = z.object({
  meds: z.array(MedSchema).min(2).max(10),
  lang: z.enum(["en", "es"]).optional(),
});

export interface CheckResponse {
  results: InteractionResult[];
  cards: InteractionCard[];
  summary: string;
}

/**
 * POST /api/interactions/check
 * Body: { meds: Med[] (2–10), lang?: "en" | "es" }
 * → { results: InteractionResult[], cards: InteractionCard[], summary: string }
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("Body must be JSON.", 400);
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return error("Send between 2 and 10 medicines, each with a name and rxcui.", 400, {
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }

  const lang = parsed.data.lang ?? "en";
  const meds: Med[] = parsed.data.meds;

  try {
    const results = await checkInteractions(meds);
    const cards = await buildCards(results, lang);
    const uniqueMeds = new Set(meds.map((m) => m.rxcui)).size;
    const summary = summarize(results, uniqueMeds, lang);
    return json<CheckResponse>({ results, cards, summary });
  } catch (e) {
    console.error("[interactions/check]", (e as Error).message);
    return error("We could not check these medicines right now. Please try again.", 500);
  }
}
