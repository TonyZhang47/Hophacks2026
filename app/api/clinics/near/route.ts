import type { NextRequest } from "next/server";
import { z } from "zod";
import { error, json } from "@/lib/http";
import { findClinics, isFindError } from "@/lib/clinics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const flag = z
  .string()
  .optional()
  .transform((v) => v === "1" || v === "true");

const Query = z
  .object({
    zip: z.string().trim().regex(/^\d{5}(-\d{4})?$/, "ZIP must be 5 digits").optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
    radiusMiles: z.coerce.number().min(1).max(100).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    medicaid: flag,
    medicare: flag,
    slidingFee: flag,
    rural: flag,
  })
  .refine((q) => q.zip || (q.lat !== undefined && q.lon !== undefined), {
    message: "Enter a ZIP code or use your location.",
  });

/**
 * GET /api/clinics/near?zip=21550&radiusMiles=25&medicaid=1&medicare=1&slidingFee=1&rural=1
 * GET /api/clinics/near?lat=39.4&lon=-79.4
 * → { results: ClinicResult[], radiusUsed: number, widened: boolean, origin: { lat, lon, zip? } }
 * 400 { error } for an unknown ZIP ("We don't recognise that ZIP code.") or missing location.
 */
export async function GET(req: NextRequest) {
  const raw: Record<string, string> = {};
  for (const [k, v] of new URL(req.url).searchParams) if (v !== "") raw[k] = v;
  const parsed = Query.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Bad request";
    return error(/zip/i.test(msg) ? "We don't recognise that ZIP code." : msg, 400);
  }
  const q = parsed.data;
  const out = await findClinics({
    zip: q.zip?.slice(0, 5),
    lat: q.lat,
    lon: q.lon,
    radiusMiles: q.radiusMiles,
    limit: q.limit,
    filters: { medicaid: q.medicaid, medicare: q.medicare, slidingFee: q.slidingFee, rural: q.rural },
  });
  if (isFindError(out)) return error(out.error, out.status);
  return json(out);
}
