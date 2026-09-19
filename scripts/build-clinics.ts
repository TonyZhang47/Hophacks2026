/**
 * Build data/clinics.json from two REAL public directories:
 *   1. HRSA "Health Center Service Delivery and Look-Alike Sites" (FQHC + Look-Alike, geocoded)
 *      https://data.hrsa.gov/data/download
 *   2. CMS "Rural Health Clinic Enrollments" (RHC; no lat/lon → geocoded by ZIP centroid)
 *      https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/rural-health-clinic-enrollments
 *
 *   npx tsx scripts/build-zips.ts      # first — RHC rows are geocoded from data/zip_centroids.json
 *   npx tsx scripts/build-clinics.ts
 *
 * Set RXPLAIN_RAW_DIR=<dir containing hrsa.csv / rhc.csv> to build from local copies instead of downloading.
 *
 * Coverage flags are PROGRAM RULES, not per-site facts (the UI labels them "by program rule"):
 *   FQHC / Look-Alike → Medicaid yes, Medicare yes, sliding fee yes (HRSA §330 requirements)
 *   RHC               → Medicaid yes, Medicare yes, sliding fee no (not required by the RHC program)
 *
 * Always dropped: HRSA "Administrative" sites (no patient care at that address); rows with no usable
 * coordinates; exact duplicates (same name + address + ZIP).
 *
 * Size budget (default 3 MB, override with CLINICS_BUDGET_MB=8 to keep everything): every RHC is always kept
 * (rural focus). HRSA sites are thinned in this order, stopping as soon as the file fits, and each step is
 * printed so the report is honest:
 *   1. non-public settings (school-based, nursing home, correctional)     2. mobile vans / seasonal sites
 *   3. one site per health-center organisation per city                    4. at most N HRSA sites per ZIP (3 → 2 → 1)
 *   5. one RHC enrollment per organisation per city                         6. at most 2 RHCs per ZIP
 *   7. drop the optional npi field
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import os from "os";

type SiteType = "FQHC" | "LOOKALIKE" | "RHC";
interface Clinic {
  clinic_id: string;
  name: string;
  site_type: SiteType;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lon: number;
  phone: string;
  npi?: string;
  accepts_medicaid: boolean;
  accepts_medicare: boolean;
  sliding_fee: boolean;
  source: string;
}

const HRSA_URLS = [
  "https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv",
];
// The CMS catalog (https://data.cms.gov/data.json) lists a dated CSV per release; the API endpoint is stable.
const RHC_URLS = [
  "https://data.cms.gov/sites/default/files/2026-07/7ac03830-a6c6-41bd-93cb-ca06d37d2a80/RHC_Enrollments_2026.07.17.csv",
  "https://data.cms.gov/data-api/v1/dataset/3b7e7659-067e-41ea-8e36-f9ee2036e1f6/data?size=10000",
];

const SIZE_BUDGET_BYTES = Number(process.env.CLINICS_BUDGET_MB ?? 3) * 1024 * 1024;
const ROOT = process.cwd();
const OUT = path.join(ROOT, "data", "clinics.json");
const ZIPS = path.join(ROOT, "data", "zip_centroids.json");
const CACHE_DIR = process.env.RXPLAIN_RAW_DIR ?? path.join(os.tmpdir(), "rxplain-raw");

async function fetchText(name: string, urls: string[]): Promise<string | null> {
  const cached = path.join(CACHE_DIR, name);
  if (existsSync(cached)) {
    console.log(`using cached ${cached}`);
    return readFileSync(cached, "utf8");
  }
  for (const url of urls) {
    try {
      console.log(`downloading ${url}`);
      const res = await fetch(url, { headers: { "User-Agent": "rxplain-build/1.0" }, signal: AbortSignal.timeout(180_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let text = await res.text();
      if (text.trimStart().startsWith("[")) text = jsonToCsv(text); // CMS API returns JSON rows
      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(cached, text);
      return text;
    } catch (e) {
      console.warn(`  failed: ${(e as Error).message}`);
    }
  }
  return null;
}

function jsonToCsv(text: string): string {
  const rows = JSON.parse(text) as Record<string, string>[];
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [keys.map(esc).join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
}

/** RFC-4180-ish CSV parser (quoted fields, embedded commas/newlines). */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((r) => r.length >= header.length - 1)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

const round4 = (n: number) => Math.round(n * 1e4) / 1e4;
const zip5 = (z: string) => {
  const d = z.replace(/\D/g, "").slice(0, 5);
  return d.length === 5 ? d : "";
};
function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d.startsWith("1")) return formatPhone(d.slice(1));
  return raw.trim();
}
/** "WEST RIVER HEALTH CLINIC - SCRANTON" → "West River Health Clinic - Scranton" (keeps short acronyms). */
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])([a-z']*)/g, (_, a: string, rest: string) => a.toUpperCase() + rest)
    .replace(/\b(Llc|Inc|Pc|Pa|Md|Do|Fnp|Np|Pllc|Lp|Ltd)\b\.?/g, (m) => m.toUpperCase())
    .replace(/\b(Of|And|The|For|At|In|On|By|De|La|Del)\b/g, (m) => m.toLowerCase())
    .replace(/^([a-z])/, (m) => m.toUpperCase());
}
function cleanAddress(s: string): string {
  return s.replace(/\s+/g, " ").replace(/,\s*$/, "").trim();
}

interface HrsaMeta {
  mobileOrSeasonal: Set<string>;
  nonPublic: Set<string>;
  orgCity: Map<string, string>; // clinic_id → "orgnumber|city|state"
}

function buildHrsa(csv: string): { rows: Clinic[]; droppedAdmin: number; droppedGeo: number; meta: HrsaMeta } {
  const recs = parseCsv(csv);
  const rows: Clinic[] = [];
  const meta: HrsaMeta = { mobileOrSeasonal: new Set(), nonPublic: new Set(), orgCity: new Map() };
  let droppedAdmin = 0;
  let droppedGeo = 0;
  for (const r of recs) {
    if ((r["Site Status Description"] || "Active") !== "Active") continue;
    if (r["Health Center Type Description"] === "Administrative") {
      droppedAdmin++;
      continue;
    }
    const lon = Number(r["Geocoding Artifact Address Primary X Coordinate"]);
    const lat = Number(r["Geocoding Artifact Address Primary Y Coordinate"]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat === 0 || lon === 0) {
      droppedGeo++;
      continue;
    }
    const type = r["Health Center Type"] || "";
    const site_type: SiteType = /look-?alike/i.test(type) ? "LOOKALIKE" : "FQHC";
    const id = r["BPHC Assigned Number"] || r["Health Center Location Identification Number"];
    const clinic: Clinic = {
      clinic_id: `hrsa-${id.replace(/^BPS-/i, "").toLowerCase()}`,
      name: r["Site Name"].replace(/\s+/g, " ").trim(),
      site_type,
      address: cleanAddress(r["Site Address"]),
      city: titleCase(r["Site City"]),
      state: r["Site State Abbreviation"].toUpperCase(),
      zip: zip5(r["Site Postal Code"]),
      lat: round4(lat),
      lon: round4(lon),
      phone: formatPhone(r["Site Telephone Number"]),
      accepts_medicaid: true,
      accepts_medicare: true,
      sliding_fee: true,
      source: "hrsa-2026",
    };
    const npi = r["FQHC Site NPI Number"]?.replace(/\D/g, "");
    if (npi && npi.length === 10) clinic.npi = npi;
    if (/mobile|seasonal/i.test(r["Health Center Location Type Description"] || "")) meta.mobileOrSeasonal.add(clinic.clinic_id);
    if (/school|nursing|correctional|carceral/i.test(r["Health Center Service Delivery Site Location Setting Description"] || ""))
      meta.nonPublic.add(clinic.clinic_id);
    meta.orgCity.set(clinic.clinic_id, `${r["Health Center Number"]}|${clinic.city.toLowerCase()}|${clinic.state}`);
    rows.push(clinic);
  }
  return { rows, droppedAdmin, droppedGeo, meta };
}

function buildRhc(
  csv: string,
  zips: Map<string, { lat: number; lon: number }>,
): { rows: Clinic[]; droppedGeo: number; orgCity: Map<string, string> } {
  const recs = parseCsv(csv);
  const rows: Clinic[] = [];
  const orgCity = new Map<string, string>();
  let droppedGeo = 0;
  for (const r of recs) {
    const zip = zip5(r["ZIP CODE"] || r["zip code"] || "");
    const c = zips.get(zip);
    if (!c) {
      droppedGeo++;
      continue;
    }
    const dba = (r["DOING BUSINESS AS NAME"] || "").trim();
    const org = (r["ORGANIZATION NAME"] || "").trim();
    const address = cleanAddress([r["ADDRESS LINE 1"], r["ADDRESS LINE 2"]].filter(Boolean).join(", "));
    const clinic: Clinic = {
      clinic_id: `rhc-${(r["ENROLLMENT ID"] || "").toLowerCase()}`,
      name: titleCase(dba || org),
      site_type: "RHC",
      address: titleCase(address),
      city: titleCase(r["CITY"] || ""),
      state: (r["STATE"] || "").toUpperCase(),
      zip,
      lat: c.lat,
      lon: c.lon,
      phone: formatPhone(r["TELEPHONE NUMBER"] || ""),
      accepts_medicaid: true,
      accepts_medicare: true,
      sliding_fee: false,
      source: "cms-rhc-2026",
    };
    const npi = (r["NPI"] || "").replace(/\D/g, "");
    if (npi.length === 10) clinic.npi = npi;
    orgCity.set(clinic.clinic_id, `${org.toLowerCase()}|${clinic.city.toLowerCase()}|${clinic.state}`);
    rows.push(clinic);
  }
  return { rows, droppedGeo, orgCity };
}

function dedupe(rows: Clinic[]): Clinic[] {
  const seen = new Set<string>();
  const out: Clinic[] = [];
  for (const c of rows) {
    const k = `${c.name}|${c.address}|${c.zip}`.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

function serialize(rows: Clinic[]): string {
  return "[\n" + rows.map((r) => JSON.stringify(r)).join(",\n") + "\n]\n";
}

async function main() {
  if (!existsSync(ZIPS)) throw new Error("data/zip_centroids.json missing — run scripts/build-zips.ts first");
  const zipRows = JSON.parse(readFileSync(ZIPS, "utf8")) as { zip: string; lat: number; lon: number }[];
  const zips = new Map(zipRows.map((z) => [z.zip, { lat: z.lat, lon: z.lon }]));

  const [hrsaCsv, rhcCsv] = await Promise.all([fetchText("hrsa.csv", HRSA_URLS), fetchText("rhc.csv", RHC_URLS)]);
  if (!hrsaCsv && !rhcCsv) {
    throw new Error("Both HRSA and CMS downloads failed. data/clinics.json NOT overwritten.");
  }

  let all: Clinic[] = [];
  let meta: HrsaMeta = { mobileOrSeasonal: new Set(), nonPublic: new Set(), orgCity: new Map() };
  const rhcOrgCity = new Map<string, string>();
  if (hrsaCsv) {
    const h = buildHrsa(hrsaCsv);
    console.log(`HRSA: ${h.rows.length} sites kept (dropped ${h.droppedAdmin} administrative-only, ${h.droppedGeo} without coordinates)`);
    all.push(...h.rows);
    meta = h.meta;
  } else console.warn("HRSA download failed — FQHC/Look-Alike sites omitted");
  if (rhcCsv) {
    const r = buildRhc(rhcCsv, zips);
    console.log(`CMS RHC: ${r.rows.length} clinics kept (geocoded by ZIP centroid; dropped ${r.droppedGeo} with unknown ZIP)`);
    all.push(...r.rows);
    for (const [k, v] of r.orgCity) rhcOrgCity.set(k, v);
  } else console.warn("CMS RHC download failed — rural health clinics omitted");

  const before = all.length;
  all = dedupe(all);
  console.log(`deduped ${before - all.length} exact duplicates (same name + address + ZIP)`);

  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(2)} MB`;
  const isHrsa = (c: Clinic) => c.site_type !== "RHC";
  const onePerOrgCity = (label: string, which: (c: Clinic) => boolean, map: Map<string, string>) => ({
    label,
    apply: (rows: Clinic[]) => {
      const seen = new Set<string>();
      return rows.filter((c) => {
        if (!which(c)) return true;
        const k = map.get(c.clinic_id) ?? c.clinic_id;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    },
  });
  const capPerZip = (label: string, which: (c: Clinic) => boolean, cap: number) => ({
    label,
    apply: (rows: Clinic[]) => {
      const per = new Map<string, number>();
      return rows.filter((c) => {
        if (!which(c)) return true;
        const k = c.zip || `${c.city}|${c.state}`;
        const n = per.get(k) ?? 0;
        if (n >= cap) return false;
        per.set(k, n + 1);
        return true;
      });
    },
  });
  const isRhc = (c: Clinic) => c.site_type === "RHC";
  const steps: { label: string; apply: (rows: Clinic[]) => Clinic[] }[] = [
    { label: "non-public settings (school-based, nursing home, correctional)", apply: (rows) => rows.filter((c) => !meta.nonPublic.has(c.clinic_id)) },
    { label: "mobile-van / seasonal sites", apply: (rows) => rows.filter((c) => !meta.mobileOrSeasonal.has(c.clinic_id)) },
    onePerOrgCity("extra HRSA sites of the same organisation in the same city", isHrsa, meta.orgCity),
    ...[3, 2, 1].map((cap) => capPerZip(`HRSA sites beyond ${cap} per ZIP`, isHrsa, cap)),
    onePerOrgCity("extra RHC enrollments of the same organisation in the same city", isRhc, rhcOrgCity),
    capPerZip("RHCs beyond 2 per ZIP", isRhc, 2),
    { label: "optional npi field", apply: (rows) => rows.map(({ npi: _npi, ...rest }) => rest) },
  ];

  let body = serialize(all);
  console.log(`full set: ${all.length} rows, ${mb(body.length)} (budget ${mb(SIZE_BUDGET_BYTES)})`);
  for (const step of steps) {
    if (body.length <= SIZE_BUDGET_BYTES) break;
    const next = step.apply(all);
    console.warn(`  over budget → dropping ${step.label}: ${all.length - next.length} rows removed`);
    all = next;
    body = serialize(all);
    console.warn(`    now ${all.length} rows, ${mb(body.length)}`);
  }

  all.sort((a, b) => a.state.localeCompare(b.state) || a.zip.localeCompare(b.zip) || a.name.localeCompare(b.name));
  body = serialize(all);
  writeFileSync(OUT, body);
  const counts = all.reduce<Record<string, number>>((m, c) => ((m[c.site_type] = (m[c.site_type] ?? 0) + 1), m), {});
  console.log(`wrote ${all.length} clinics to ${OUT} (${mb(body.length)})`, counts);
  if (body.length > SIZE_BUDGET_BYTES) console.warn("WARNING: file is still over the size budget");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
