/**
 * Build data/zip_centroids.json from a public US ZIP-centroid dataset.
 *   npx tsx scripts/build-zips.ts
 *
 * Source (2013 US Census ZCTA centroids, public domain, via a well-known gist):
 *   https://gist.github.com/erichurst/7882666
 * Set RXPLAIN_RAW_DIR=<dir containing zips.csv> to build from a local copy instead of downloading.
 * Output rows: { zip: "21550", lat: 39.4076, lon: -79.4067 } (4-decimal rounding ≈ 11 m, keeps the file small).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import os from "os";

const SOURCES = [
  "https://gist.githubusercontent.com/erichurst/7882666/raw/5bdc46db47d9515269ab12ed6fb2850377fd869e/US%20Zip%20Codes%20from%202013%20Government%20Data",
  "https://raw.githubusercontent.com/scpike/us-state-county-zip/master/geo-data.csv",
];

const OUT = path.join(process.cwd(), "data", "zip_centroids.json");
const CACHE_DIR = process.env.RXPLAIN_RAW_DIR ?? path.join(os.tmpdir(), "rxplain-raw");
const CACHE_FILE = path.join(CACHE_DIR, "zips.csv");

async function download(): Promise<string> {
  if (existsSync(CACHE_FILE)) {
    console.log(`using cached ${CACHE_FILE}`);
    return readFileSync(CACHE_FILE, "utf8");
  }
  for (const url of SOURCES) {
    try {
      console.log(`downloading ${url}`);
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!text.includes(",")) throw new Error("not a CSV");
      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(CACHE_FILE, text);
      return text;
    } catch (e) {
      console.warn(`  failed: ${(e as Error).message}`);
    }
  }
  throw new Error("All ZIP-centroid downloads failed. Nothing written.");
}

function parseRows(text: string): { zip: string; lat: number; lon: number }[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  // Accept the gist layout (ZIP,LAT,LNG) and the scpike layout (state_fips,state,...,zipcode,...,lat,lng).
  const zi = header.findIndex((h) => h === "zip" || h === "zipcode" || h === "zip_code");
  const lai = header.findIndex((h) => h === "lat" || h === "latitude");
  const loi = header.findIndex((h) => h === "lng" || h === "lon" || h === "longitude");
  if (zi < 0 || lai < 0 || loi < 0) throw new Error(`unrecognised header: ${lines[0]}`);
  const out: { zip: string; lat: number; lon: number }[] = [];
  const seen = new Set<string>();
  for (const line of lines.slice(1)) {
    const cols = line.split(",").map((c) => c.trim().replace(/"/g, ""));
    const zip = cols[zi]?.padStart(5, "0");
    const lat = Number(cols[lai]);
    const lon = Number(cols[loi]);
    if (!/^\d{5}$/.test(zip) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (seen.has(zip)) continue;
    seen.add(zip);
    out.push({ zip, lat: Math.round(lat * 1e4) / 1e4, lon: Math.round(lon * 1e4) / 1e4 });
  }
  return out.sort((a, b) => a.zip.localeCompare(b.zip));
}

async function main() {
  const rows = parseRows(await download());
  // One row per line keeps diffs readable without pretty-print bloat.
  const body = "[\n" + rows.map((r) => JSON.stringify(r)).join(",\n") + "\n]\n";
  writeFileSync(OUT, body);
  console.log(`wrote ${rows.length} ZIPs to ${OUT} (${(body.length / 1024 / 1024).toFixed(2)} MB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
