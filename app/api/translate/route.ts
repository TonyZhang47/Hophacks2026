import { z } from "zod";
import { error, json } from "@/lib/http";
import { translateStrings } from "@/lib/translate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/translate  { strings: string[], target: "es" | "en", names?: string[], protect?: boolean }
 *   200 { translated: string[], provider: "grok" | "none", perItem: ("grok"|"none")[] }
 * Numbers, units and drug names never pass through the model (G4). Without XAI_API_KEY the
 * originals come back with provider "none".
 */
const Body = z.object({
  strings: z.array(z.string().max(4000)).min(1).max(60),
  target: z.enum(["es", "en"]),
  names: z.array(z.string().max(120)).max(40).optional(),
  protect: z.boolean().optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return error("invalid-body", 400, { hint: "Send { strings: string[], target: 'es'|'en', names?: string[] }" });
  }
  const result = await translateStrings(body.strings, body.target, { names: body.names, protect: body.protect });
  return json(result);
}
