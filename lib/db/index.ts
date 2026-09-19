import "server-only";
import { isSnowflakeConfigured } from "@/lib/env";
import type { Db } from "@/lib/db/types";
import { MemoryDb } from "@/lib/db/memory";

export type { Db, ClinicFilters, PostQuery } from "@/lib/db/types";
export { STOP_WORDS, tokenize, haversineMiles } from "@/lib/db/util";

let instance: Db | null = null;

/** Data adapter: Snowflake when configured, otherwise in-memory seeds from /data. */
export async function getDb(): Promise<Db> {
  if (instance) return instance;
  if (isSnowflakeConfigured()) {
    const { SnowflakeDb } = await import("@/lib/db/snowflake");
    instance = new SnowflakeDb();
  } else {
    instance = new MemoryDb();
  }
  return instance;
}
