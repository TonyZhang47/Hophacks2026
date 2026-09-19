import { z } from "zod";
import { error, json } from "@/lib/http";
import { DoseInputSchema } from "@/lib/dose/parse";
import { explainDose } from "@/lib/dose/explain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  input: DoseInputSchema,
  lang: z.enum(["en", "es"]).optional(),
});

/**
 * POST { input: DoseInput, lang? } → { result: DoseResult }
 * Always 200 with a DoseResult: a fail-closed "Check with your pharmacist" result is a
 * valid answer. 400 only for a malformed body.
 */
export async function POST(req: Request) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return error("Send { input: DoseInput, lang?: 'en' | 'es' }", 400);
  }
  const result = await explainDose(body.input, body.lang ?? "en");
  return json({ result });
}
