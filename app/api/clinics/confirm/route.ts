import type { NextRequest } from "next/server";
import { z } from "zod";
import { error, json } from "@/lib/http";
import { confirmClinic, INSURER_MAX } from "@/lib/clinics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  clinicId: z.string().trim().min(3).max(64),
  insurer: z.string().trim().min(1).max(INSURER_MAX * 2),
  confirmed: z.boolean(),
});

/**
 * POST /api/clinics/confirm { clinicId, insurer, confirmed } → { ok: true }
 * "Community reported": one anonymous yes/no per call, aggregated per insurer on read. No identifiers stored.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("Send JSON.", 400);
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return error("Type the insurer's name and choose Yes or No.", 400);
  const { clinicId, insurer, confirmed } = parsed.data;
  const out = await confirmClinic(clinicId, insurer, confirmed);
  if (!out.ok) return error(out.error, out.status);
  return json({ ok: true });
}
