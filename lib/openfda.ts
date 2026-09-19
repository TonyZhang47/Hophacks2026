import "server-only";
import { env } from "@/lib/env";
import { getDb } from "@/lib/db";
import { TtlCache } from "@/lib/http";
import type { LabelChunk, LabelSectionName } from "@/lib/types";

/**
 * openFDA drug label access. Strategy: seeds/DB first, then live fetch (cached in-process
 * and written through to LABEL_SECTIONS). Never throws on network failure — returns what it has.
 */
export const LABEL_SECTIONS: LabelSectionName[] = [
  "dosage_and_administration",
  "overdosage",
  "boxed_warning",
  "warnings",
  "adverse_reactions",
  "indications_and_usage",
];

const fetched = new TtlCache<boolean>(6 * 60 * 60 * 1000); // remember which rxcui we already pulled

function chunkText(text: string, max = 700): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return [clean];
  const sentences = clean.split(/(?<=[.;:])\s+/);
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + " " + s).length > max && cur) {
      out.push(cur.trim());
      cur = s;
    } else {
      cur = cur ? `${cur} ${s}` : s;
    }
  }
  if (cur) out.push(cur.trim());
  return out;
}

interface OpenFdaLabel {
  set_id?: string;
  effective_time?: string;
  openfda?: { generic_name?: string[]; rxcui?: string[]; brand_name?: string[] };
  [k: string]: unknown;
}

async function fetchLabel(ingredient: string, rxcui: string): Promise<OpenFdaLabel | null> {
  const key = env.openFdaKey ? `&api_key=${env.openFdaKey}` : "";
  const tries = [
    `openfda.rxcui:"${rxcui}"`,
    `openfda.generic_name:"${ingredient.toUpperCase()}"`,
    `openfda.substance_name:"${ingredient.toUpperCase()}"`,
  ];
  for (const search of tries) {
    try {
      const url = `https://api.fda.gov/drug/label.json?search=${encodeURIComponent(search)}&limit=1${key}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) continue;
      const data = (await res.json()) as { results?: OpenFdaLabel[] };
      if (data.results?.[0]) return data.results[0];
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * Ensure label sections exist for an rxcui. Returns everything available (seed + live).
 */
export async function ensureLabel(rxcui: string, ingredient: string): Promise<LabelChunk[]> {
  const db = await getDb();
  const existing = await db.getLabelSections(rxcui, LABEL_SECTIONS);
  if (existing.length || fetched.get(rxcui)) return existing;
  fetched.set(rxcui, true);

  const label = await fetchLabel(ingredient, rxcui);
  if (!label) return existing;

  const chunks: LabelChunk[] = [];
  for (const section of LABEL_SECTIONS) {
    const raw = label[section];
    if (!Array.isArray(raw)) continue;
    const text = raw.filter((x) => typeof x === "string").join(" ");
    if (!text) continue;
    chunkText(text).forEach((t, i) => {
      chunks.push({
        rxcui,
        ingredient_name: ingredient.toLowerCase(),
        section,
        chunk_id: `${rxcui}-${section}-${i}`,
        text: t,
        set_id: label.set_id,
        effective_time: label.effective_time,
      });
    });
  }
  if (chunks.length) await db.upsertLabelSections(chunks);
  return chunks;
}

/** Convenience: sections for one rxcui, fetching if needed. */
export async function getSections(rxcui: string, ingredient: string, sections: LabelSectionName[]) {
  const all = await ensureLabel(rxcui, ingredient);
  return all.filter((c) => sections.includes(c.section));
}
