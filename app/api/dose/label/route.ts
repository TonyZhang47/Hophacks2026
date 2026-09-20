import type { NextRequest } from "next/server";
import { z } from "zod";
import { error, json } from "@/lib/http";
import { getSections } from "@/lib/openfda";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  rxcui: z.string().trim().regex(/^\d{1,12}$/),
  name: z.string().trim().max(80).optional(),
});

export interface DoseLabelPayload {
  quotes: { chunkId: string; text: string }[];
  source: "openFDA";
  section: "dosage_and_administration";
}

/**
 * GET /api/dose/label?rxcui=&name=
 * Official FDA dosage text (seed + live openFDA) for the confirmed medicine.
 */
export async function GET(req: NextRequest) {
  const raw: Record<string, string> = {};
  for (const [k, v] of new URL(req.url).searchParams) if (v !== "") raw[k] = v;
  const parsed = Query.safeParse(raw);
  if (!parsed.success) return error("Bad request", 400);
  const { rxcui, name } = parsed.data;
  const chunks = await getSections(rxcui, name || rxcui, ["dosage_and_administration"]);
  const quotes = chunks.slice(0, 2).map((c) => ({ chunkId: c.chunk_id, text: c.text }));
  return json<DoseLabelPayload>({
    quotes,
    source: "openFDA",
    section: "dosage_and_administration",
  });
}
