import { json } from "@/lib/http";
import { modeSummary } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Health check for App Platform. Deliberately does NOT touch Snowflake. */
export async function GET() {
  return json({ ok: true, app: "rxplain", mode: modeSummary(), time: new Date().toISOString() });
}
