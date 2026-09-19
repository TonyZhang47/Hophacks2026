import { z } from "zod";
import { error } from "@/lib/http";
import { buildShareSheetPdf } from "@/lib/pdf";
import type { ShareSheetData } from "@/components/share/ShareSheetButton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/export/pdf  ShareSheetData (lenient)
 *   200 application/pdf, Content-Disposition: attachment; filename="rxplain-share-sheet.pdf"
 * Built from the same validated JSON as the UI; no LLM pass.
 */
const Severity = z.enum(["major", "moderate", "minor", "unknown"]).catch("unknown");
const Str = z.string().max(2000).catch("");

const Med = z.object({ name: z.string().max(200), rxcui: z.string().max(40).catch(""), ingredientName: z.string().max(200).optional() });

const Card = z.object({
  drugA: z.string().max(200),
  drugB: z.string().max(200),
  severity: Severity,
  whatHappens: Str,
  howSerious: Str,
  whatToDo: Str,
  askYourClinician: Str,
  citations: z.array(z.string()).catch([]),
});

const DoseInput = z.object({
  drugName: z.string().max(200).catch(""),
  rxcui: z.string().max(40).catch(""),
  strengthMg: z.number().nullable().catch(null),
  unitsPerDose: z.number().nullable().catch(null),
  unitLabel: z.enum(["tablet", "capsule", "mL", "puff", "drop", "patch", "unit"]).catch("unit"),
  timesPerDay: z.number().nullable().catch(null),
  howOftenText: z.string().max(200).catch(""),
  route: z.enum(["oral", "topical", "inhaled", "other"]).catch("other"),
  withFood: z.boolean().nullable().catch(null),
  asNeeded: z.boolean().catch(false),
  userText: z.string().max(2000).catch(""),
});

const DoseResult = z.object({
  status: z.enum(["consistent", "above_label_max", "inconsistent", "unverified"]).catch("unverified"),
  plainDose: Str,
  maxPerDayLine: Str,
  timing: z.array(z.string()).catch([]),
  missedDoseLine: Str,
  labelQuotes: z.array(z.object({ chunkId: z.string().catch(""), text: z.string().catch("") })).catch([]),
  numbersUsed: z.array(z.number()).catch([]),
  askYourPharmacist: Str,
  reason: z.string().optional(),
  ceilingChecked: z.boolean().catch(false),
  guardrailLog: z.array(z.string()).catch([]),
});

const Clinic = z
  .object({
    clinic_id: z.string().catch(""),
    name: z.string().max(300),
    site_type: z.enum(["FQHC", "LOOKALIKE", "RHC"]).catch("FQHC"),
    address: Str,
    city: Str,
    state: Str,
    zip: Str,
    lat: z.number().catch(0),
    lon: z.number().catch(0),
    phone: Str,
    npi: z.string().optional(),
    accepts_medicaid: z.boolean().catch(false),
    accepts_medicare: z.boolean().catch(false),
    sliding_fee: z.boolean().catch(false),
    source: z.string().catch(""),
    updated_at: z.string().optional(),
    distanceMiles: z.number().catch(NaN),
    communityConfirmed: z.array(z.object({ insurer: z.string(), yes: z.number().catch(0), no: z.number().catch(0) })).catch([]),
  })
  .nullable()
  .optional();

const Body = z.object({
  meds: z.array(Med).max(10),
  cards: z.array(Card).max(60).catch([]),
  doses: z.array(z.object({ input: DoseInput, result: DoseResult })).max(10).catch([]),
  clinic: Clinic,
});

export async function POST(req: Request) {
  let data: ShareSheetData;
  try {
    data = Body.parse(await req.json()) as ShareSheetData;
  } catch {
    return error("invalid-body", 400, { hint: "Send ShareSheetData { meds, cards, doses, clinic? }" });
  }

  try {
    const pdf = await buildShareSheetPdf(data, new Date());
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="rxplain-share-sheet.pdf"',
        "Content-Length": String(pdf.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error(`[pdf] render failed: ${(e as Error).message}`);
    return error("pdf-failed", 500);
  }
}
