/**
 * Seed Snowflake from /data JSON. Run locally with .env.local — NEVER from an API route.
 *   npx tsx scripts/seed-snowflake.ts
 * Applies sql/schema.sql first (idempotent), then loads each table.
 */
import { readFileSync } from "fs";
import path from "path";
import snowflake from "snowflake-sdk";

function loadEnv() {
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").replace(/\s+#.*$/, "");
    }
  } catch {}
}
loadEnv();

const s = {
  account: process.env.SNOWFLAKE_ACCOUNT!,
  username: process.env.SNOWFLAKE_USERNAME!,
  password: process.env.SNOWFLAKE_PASSWORD,
  privateKeyB64: process.env.SNOWFLAKE_PRIVATE_KEY_B64,
  warehouse: process.env.SNOWFLAKE_WAREHOUSE,
  database: process.env.SNOWFLAKE_DATABASE,
  schema: process.env.SNOWFLAKE_SCHEMA ?? "PUBLIC",
  role: process.env.SNOWFLAKE_ROLE,
};
if (!s.account || !s.username) {
  console.error("Missing SNOWFLAKE_* env vars");
  process.exit(1);
}

const conn = snowflake.createConnection({
  account: s.account,
  username: s.username,
  ...(s.privateKeyB64
    ? { authenticator: "SNOWFLAKE_JWT", privateKey: Buffer.from(s.privateKeyB64, "base64").toString("utf8") }
    : { password: s.password }),
  warehouse: s.warehouse,
  database: s.database,
  schema: s.schema,
  role: s.role,
} as never);

const q = (sqlText: string, binds: unknown[] = []) =>
  new Promise<unknown[]>((resolve, reject) =>
    conn.execute({ sqlText, binds: binds as never, complete: (err, _st, rows) => (err ? reject(err) : resolve(rows ?? [])) }),
  );

const data = (f: string) => JSON.parse(readFileSync(path.join(process.cwd(), "data", f), "utf8")) as Record<string, unknown>[];

async function main() {
  await new Promise<void>((res, rej) => conn.connect((e) => (e ? rej(e) : res())));
  console.log("connected");

  const schema = readFileSync(path.join(process.cwd(), "sql", "schema.sql"), "utf8");
  for (const stmt of schema.split(";").map((x) => x.trim()).filter((x) => x && !x.startsWith("--"))) {
    const clean = stmt
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n")
      .trim();
    if (clean) await q(clean);
  }
  console.log("schema ok");

  const load = async (table: string, file: string, cols: string[], jsonCols: string[] = []) => {
    const rows = data(file);
    await q(`DELETE FROM ${table}`);
    for (const r of rows) {
      const vals = cols.map((c) => (jsonCols.includes(c) ? JSON.stringify(r[c] ?? null) : (r[c] ?? null)));
      const sel = cols.map((c) => (jsonCols.includes(c) ? "PARSE_JSON(?)" : "?")).join(",");
      await q(`INSERT INTO ${table} (${cols.join(",")}) SELECT ${sel}`, vals);
    }
    console.log(`${table}: ${rows.length} rows`);
  };

  await load("INTERACTIONS", "interactions.json", ["drug_a", "drug_b", "severity", "mechanism", "management", "source"]);
  await load("LABEL_SECTIONS", "label_sections.json", ["rxcui", "ingredient_name", "section", "chunk_id", "text", "set_id", "effective_time"]);
  await load("DOSE_LIMITS", "dose_limits.json", ["ingredient_name", "max_daily_mg", "max_daily_mg_per_kg", "route", "source", "notes"]);
  await load("CLINICS", "clinics.json", ["clinic_id", "name", "site_type", "address", "city", "state", "zip", "lat", "lon", "phone", "npi", "accepts_medicaid", "accepts_medicare", "sliding_fee", "source"]);
  await load("ZIP_CENTROIDS", "zip_centroids.json", ["zip", "lat", "lon"]);
  await load("COMMUNITY_POSTS", "posts.json", ["post_id", "rxcui", "drug_name", "body", "side_effect_tags", "moderation_status", "created_at", "anon_handle"], ["side_effect_tags"]);

  conn.destroy(() => {});
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
