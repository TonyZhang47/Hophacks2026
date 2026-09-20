import { z } from "zod";
import { isXaiConfigured } from "@/lib/env";
import { error, json } from "@/lib/http";
import { readImageText } from "@/lib/vision";
import { parseDirectionsHeuristic } from "@/lib/dose/parse";
import { formatOcrLabelText } from "@/lib/dose/ocrText";
import { matchLabelToCatalog } from "@/lib/dose/matchLabel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ocr/prescription  { image: "data:image/jpeg;base64,…" }
 *   200 { text, drugName?, strengthMg?, match, candidates, provider: "grok" }
 *   400 malformed body / unsupported type / image over 6 MB decoded
 *   422 { error: "unreadable" }          Grok could not read the label
 *   502 { error: "vision-failed" }       upstream error
 *   503 { error: "no-vision-provider" }  no XAI_API_KEY (demo mode)
 *
 * Reads the directions off a photo of a pharmacy label so people who cannot see the
 * small print can still use the Dose Explainer. Text only: whatever comes back goes
 * through the same confirmation step and guardrails as typed directions. The image is
 * never stored; only byte sizes are logged.
 */
const MAX_DECODED_BYTES = 6 * 1024 * 1024;

const BodySchema = z.object({
  image: z
    .string()
    .min(32)
    .regex(/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/, "unsupported image"),
});

const PROMPT = [
  "This is a photo of a prescription medicine label from a pharmacy bottle.",
  "Transcribe ONLY these parts, exactly as printed, one per line, in this order:",
  "1. The drug name and strength (for example: METFORMIN HCL 500 MG TABLET).",
  "2. The directions / sig line(s) (for example: TAKE 1 TABLET BY MOUTH TWICE DAILY WITH MEALS).",
  "Copy every number exactly. Do not add, change, round, or explain anything.",
  "Use normal sentence capitalization, not all caps. Capitalize the first letter of each line and sentence.",
  "Do not include the patient name, prescriber, pharmacy, address, phone, Rx number, refills, or dates.",
  "Reply with plain text lines only, no labels, no markdown.",
  "If you cannot read the drug name or the directions clearly, reply with exactly: UNREADABLE",
].join("\n");

/** Decoded byte length of a base64 payload without materialising it. */
function decodedLength(b64: string): number {
  const clean = b64.replace(/\s/g, "");
  const pad = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - pad;
}

/** Strip a leading "1." / "1)" / "Drug:" / "Directions:" the model may add despite the prompt. */
function cleanLine(line: string): string {
  return line
    .replace(/^\s*(?:\d+[.)]\s*|[-*•]\s*)/, "")
    .replace(/^\s*(?:drug(?: name)?|name|strength|directions?|sig|instructions?)\s*:\s*/i, "")
    .trim();
}

export async function POST(req: Request) {
  if (!isXaiConfigured()) return error("no-vision-provider", 503);

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return error("Send { image: 'data:image/(png|jpeg|webp);base64,…' }", 400);
  }

  const comma = body.image.indexOf(",");
  const decoded = decodedLength(body.image.slice(comma + 1));
  if (decoded > MAX_DECODED_BYTES) return error("image too large (max 6 MB)", 400);

  let raw: string;
  try {
    raw = await readImageText(body.image, PROMPT);
  } catch (e) {
    console.warn("[ocr] vision failed", { bytes: decoded, message: (e as Error).message.slice(0, 120) });
    return error("vision-failed", 502);
  }

  const lines = raw
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((l) => l && !/^unreadable$/i.test(l));
  const text = formatOcrLabelText(lines.join("\n"));
  console.info("[ocr] read label", { bytes: decoded, chars: text.length, lines: lines.length });

  if (/^\s*unreadable\b/i.test(raw) || text.length < 6) return error("unreadable", 422);

  // Drug name: first line that yields one. Strength: anywhere in the transcript.
  let drugName: string | undefined;
  for (const line of lines) {
    const name = parseDirectionsHeuristic(line).drugName;
    if (name) {
      drugName = name;
      break;
    }
  }
  const strengthMg = parseDirectionsHeuristic(text.replace(/\n/g, ", ")).strengthMg;
  const { match, candidates } = await matchLabelToCatalog(text, drugName);

  return json({
    text,
    drugName,
    strengthMg,
    match,
    candidates,
    provider: "grok" as const,
  });
}
