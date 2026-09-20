import "server-only";
import { getDb, type ClinicFilters } from "@/lib/db";
import type { ClinicResult, SiteType } from "@/lib/types";

/**
 * Clinic finder (Feature 8). Coverage flags are program rules, not per-site facts —
 * the UI must always label them "by program rule". Nothing here is ever more precise than a ZIP centroid.
 */
export const RADIUS_STEPS = [25, 50, 100] as const;
export const MAX_CLINIC_RESULTS = 100;
export const UNKNOWN_ZIP_MESSAGE = "We don't recognise that ZIP code.";

/** More miles → more rows, so a 100-mile search is not truncated to the nearest ~35 miles. */
export function clinicLimitForRadius(radiusMiles: number, requested?: number): number {
  if (requested != null) return Math.min(Math.max(requested, 1), MAX_CLINIC_RESULTS);
  return Math.min(MAX_CLINIC_RESULTS, Math.max(20, Math.round(radiusMiles)));
}

export interface FindClinicsInput {
  zip?: string;
  lat?: number;
  lon?: number;
  radiusMiles?: number;
  filters?: ClinicFilters;
  limit?: number;
}

export interface FindClinicsOutput {
  results: ClinicResult[];
  radiusUsed: number;
  widened: boolean;
  /** Centre we searched from (ZIP centroid or the caller's coordinates rounded to ~1 km). */
  origin: { lat: number; lon: number; zip?: string };
}

export type FindClinicsError = { error: string; status: 400 };

export function isFindError(x: FindClinicsOutput | FindClinicsError): x is FindClinicsError {
  return "error" in x;
}

export async function findClinics(input: FindClinicsInput): Promise<FindClinicsOutput | FindClinicsError> {
  const db = await getDb();
  const filters = input.filters ?? {};
  let lat: number;
  let lon: number;
  let zip: string | undefined;

  if (input.zip) {
    zip = input.zip.replace(/\D/g, "").slice(0, 5);
    if (zip.length !== 5) return { error: UNKNOWN_ZIP_MESSAGE, status: 400 };
    const c = await db.zipCentroid(zip);
    if (!c) return { error: UNKNOWN_ZIP_MESSAGE, status: 400 };
    lat = c.lat;
    lon = c.lon;
  } else if (typeof input.lat === "number" && typeof input.lon === "number") {
    // Snap browser coordinates to the nearest ZIP centroid so nothing finer than a ZIP is ever used or logged.
    const nearest = await db.nearestZip(input.lat, input.lon);
    const c = nearest ? await db.zipCentroid(nearest) : null;
    if (c) {
      zip = nearest ?? undefined;
      lat = c.lat;
      lon = c.lon;
    } else {
      lat = Math.round(input.lat * 100) / 100;
      lon = Math.round(input.lon * 100) / 100;
    }
  } else {
    return { error: "Enter a ZIP code or use your location.", status: 400 };
  }

  const requested = input.radiusMiles && input.radiusMiles > 0 ? Math.min(input.radiusMiles, 100) : RADIUS_STEPS[0];
  const limit = clinicLimitForRadius(requested, input.limit);
  const steps = [requested, ...RADIUS_STEPS.filter((r) => r > requested)];
  let results: ClinicResult[] = [];
  let radiusUsed = requested;
  for (const r of steps) {
    radiusUsed = r;
    results = await db.clinicsNear(lat, lon, r, filters, limit);
    if (results.length) break;
  }
  return { results, radiusUsed, widened: radiusUsed !== requested, origin: { lat, lon, zip } };
}

// ---- confirmations ("community reported") -------------------------------------------------------

export const INSURER_MIN = 2;
export const INSURER_MAX = 40;

/** Keep letters, spaces, & and -; collapse whitespace. Returns null when what is left is too short. */
export function cleanInsurer(raw: string): string | null {
  const cleaned = raw
    .normalize("NFKC")
    .replace(/[^A-Za-z&\-\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, INSURER_MAX);
  if (cleaned.length < INSURER_MIN) return null;
  // Title-case for consistent aggregation ("blue cross" and "Blue Cross" count together in the DB anyway).
  return cleaned.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

export type ConfirmResult = { ok: true } | { ok: false; error: string; status: 400 | 404 };

export async function confirmClinic(clinicId: string, insurer: string, confirmed: boolean): Promise<ConfirmResult> {
  const id = clinicId.trim();
  if (!/^[a-z0-9-]{3,64}$/i.test(id)) return { ok: false, error: "That clinic id doesn't look right.", status: 400 };
  const label = cleanInsurer(insurer);
  if (!label) return { ok: false, error: "Type the insurer's name (letters only, 2 to 40 characters).", status: 400 };
  const db = await getDb();
  const clinic = await db.getClinic(id);
  if (!clinic) return { ok: false, error: "We couldn't find that clinic.", status: 404 };
  await db.addClinicConfirmation(id, label, confirmed);
  return { ok: true };
}

// ---- read-aloud sentence -----------------------------------------------------------------------

export const SITE_TYPE_WORDS: Record<SiteType, { en: string; es: string }> = {
  FQHC: { en: "Community health center", es: "Centro de salud comunitario" },
  LOOKALIKE: { en: "Look-alike health center", es: "Centro de salud tipo FQHC" },
  RHC: { en: "Rural health clinic", es: "Clínica de salud rural" },
};

/** "301-555-0142" → "3 0 1, 5 5 5, 0 1 4 2" so a voice reads each digit. */
export function spellPhone(phone: string): string {
  return phone
    .replace(/\D/g, "")
    .split("")
    .join(" ")
    .replace(/^(\d \d \d) (\d \d \d) /, "$1, $2, ");
}

/**
 * One sentence per clinic for the Listen button. The client builds the same wording
 * (components/community/ClinicFinder.tsx) so audio and text always agree.
 */
export function describeClinicForAudio(c: ClinicResult, lang: "en" | "es" = "en"): string {
  const miles = c.distanceMiles < 1 ? (lang === "es" ? "menos de una milla" : "less than a mile") : `${c.distanceMiles} ${lang === "es" ? "millas" : "miles"}`;
  const phone = c.phone ? spellPhone(c.phone) : "";
  const coverage: string[] = [];
  if (c.accepts_medicaid && c.accepts_medicare) coverage.push(lang === "es" ? "Acepta Medicaid y Medicare" : "Takes Medicaid and Medicare");
  else if (c.accepts_medicaid) coverage.push(lang === "es" ? "Acepta Medicaid" : "Takes Medicaid");
  else if (c.accepts_medicare) coverage.push(lang === "es" ? "Acepta Medicare" : "Takes Medicare");
  if (c.sliding_fee) coverage.push(lang === "es" ? "tarifa según ingresos" : "sliding fee");
  if (lang === "es") {
    const cov = coverage.length ? ` ${coverage.join(", ")}, por regla del programa.` : "";
    return `${c.name}, a ${miles}.${phone ? ` Teléfono ${phone}.` : ""}${cov} Llame para confirmar.`;
  }
  const cov = coverage.length ? ` ${coverage.join(", ")} by program rule.` : "";
  return `${c.name}, ${miles} away.${phone ? ` Phone ${phone}.` : ""}${cov} Call to confirm.`;
}
