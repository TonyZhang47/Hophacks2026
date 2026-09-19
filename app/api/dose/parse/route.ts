import { z } from "zod";
import { error, json } from "@/lib/http";
import { parseDirections } from "@/lib/dose/parse";
import type { DoseInput, Med } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  text: z.string().trim().min(1).max(500),
  med: z
    .object({
      name: z.string().default(""),
      rxcui: z.string().default(""),
      ingredientName: z.string().optional(),
    })
    .optional(),
  /** When true, do not silently attach the first catalog hit — the user already confirmed or declined. */
  lockRxcui: z.boolean().optional(),
});

/** Offline resolver for the six demo meds so the explainer works with no network. */
const DEMO_RXCUI: Record<string, string> = {
  metformin: "6809",
  ibuprofen: "5640",
  warfarin: "11289",
  lisinopril: "29046",
  acetaminophen: "161",
  aspirin: "1191",
};

function demoLookup(name: string): Med | null {
  const key = name.toLowerCase().trim();
  if (!key) return null;
  for (const [ing, rxcui] of Object.entries(DEMO_RXCUI)) {
    if (key === ing || key.startsWith(`${ing} `) || key.includes(ing)) return { name: ing, rxcui, ingredientName: ing };
  }
  return null;
}

async function resolveMed(name: string): Promise<Med | null> {
  const demo = demoLookup(name);
  if (demo) return demo;
  try {
    // `lib/rxnorm.ts` is owned by another module; degrade gracefully if it is absent.
    const mod = (await import("@/lib/rxnorm").catch(() => null)) as { searchMeds?: (q: string) => Promise<Med[]> } | null;
    if (!mod?.searchMeds) return null;
    const hits = await mod.searchMeds(name);
    const hit = Array.isArray(hits) ? hits.find((h) => h && typeof h.rxcui === "string" && h.rxcui) : undefined;
    return hit ? { name: hit.name ?? name, rxcui: hit.rxcui, ingredientName: hit.ingredientName } : null;
  } catch {
    return null;
  }
}

/**
 * POST { text, med? } → { input: DoseInput }
 * Parses the directions on the person's bottle into the Feature 7 input schema.
 * The result is shown back for confirmation before anything is checked or read aloud.
 */
export async function POST(req: Request) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return error("Send { text: string, med?: { name, rxcui } }", 400);
  }

  const hint = body.med && (body.med.name || body.med.rxcui) ? body.med : undefined;
  let input: DoseInput = await parseDirections(body.text, hint);

  if (!input.rxcui && !body.lockRxcui) {
    const med = await resolveMed(input.drugName || hint?.name || "");
    if (med) {
      input = { ...input, rxcui: med.rxcui, drugName: input.drugName || med.name };
    }
  }

  return json({ input });
}
