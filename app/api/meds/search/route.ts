import type { NextRequest } from "next/server";
import { error, json } from "@/lib/http";
import { getCommonByRxcui, searchMeds } from "@/lib/rxnorm";
import type { Med } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/meds/search?q=<text>      → { results: Med[] }   (common list, then live RxNorm)
 * GET /api/meds/search?rxcui=<id>    → { results: Med[] }   (0 or 1 entry from the common list)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rxcui = searchParams.get("rxcui")?.trim();
  if (rxcui) {
    const med = getCommonByRxcui(rxcui);
    return json<{ results: Med[] }>({ results: med ? [med] : [] });
  }

  const q = searchParams.get("q")?.trim() ?? "";
  if (!q) return error("Missing q (search text) or rxcui.", 400);
  if (q.length > 80) return error("Search text is too long.", 400);

  const results = await searchMeds(q);
  return json<{ results: Med[] }>({ results });
}
