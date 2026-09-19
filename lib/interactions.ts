import "server-only";
import { getDb } from "@/lib/db";
import { getSections } from "@/lib/openfda";
import type { EvidenceSnippet, InteractionResult, LabelChunk, Med } from "@/lib/types";

/**
 * Pairwise interaction engine. Severity comes ONLY from the interaction table (DDInter seed
 * or Snowflake). No row → "unknown". Evidence is attached from openFDA label sections
 * (boxed warning + warnings) plus the DDInter mechanism/management text.
 */

const SNIPPETS_PER_DRUG = 2;
const SNIPPET_MAX_CHARS = 400;

/** Ingredient name for matching: explicit ingredientName, else "(x)" in a brand alias, else the name. */
export function ingredientOf(m: Med): string {
  if (m.ingredientName?.trim()) return m.ingredientName.toLowerCase().trim();
  const paren = m.name.match(/\(([^)]+)\)/);
  return (paren?.[1] ?? m.name).toLowerCase().trim();
}

/** Trim to a sentence boundary under the cap; append an ellipsis if cut. */
function clip(text: string, max = SNIPPET_MAX_CHARS): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const head = clean.slice(0, max - 1); // leave room for the ellipsis
  const cut = Math.max(head.lastIndexOf(". "), head.lastIndexOf("; "));
  return (cut > max * 0.5 ? head.slice(0, cut + 1) : head.trimEnd()) + "…";
}

function toSnippet(c: LabelChunk): EvidenceSnippet {
  return {
    id: c.chunk_id,
    source: c.set_id === "demo-seed" ? "seed" : "openfda",
    drug: c.ingredient_name,
    section: c.section,
    text: clip(c.text),
  };
}

/** Label evidence for one drug (boxed warning first), at most 2 snippets. Never throws. */
async function labelEvidence(m: Med): Promise<EvidenceSnippet[]> {
  try {
    const chunks = await getSections(m.rxcui, ingredientOf(m), ["boxed_warning", "warnings"]);
    const boxed = chunks.filter((c) => c.section === "boxed_warning");
    const warn = chunks.filter((c) => c.section === "warnings");
    return [...boxed, ...warn].slice(0, SNIPPETS_PER_DRUG).map(toSnippet);
  } catch {
    return [];
  }
}

export async function checkInteractions(meds: Med[]): Promise<InteractionResult[]> {
  const db = await getDb();

  // Dedupe meds by rxcui so the same ingredient added twice does not pair with itself.
  const uniq: Med[] = [];
  const seen = new Set<string>();
  for (const m of meds) {
    if (seen.has(m.rxcui)) continue;
    seen.add(m.rxcui);
    uniq.push(m);
  }

  // Fetch label evidence once per drug, not once per pair.
  const evidenceByRxcui = new Map<string, EvidenceSnippet[]>();
  await Promise.all(
    uniq.map(async (m) => {
      evidenceByRxcui.set(m.rxcui, await labelEvidence(m));
    }),
  );

  const pairs: [Med, Med][] = [];
  for (let i = 0; i < uniq.length; i++) {
    for (let j = i + 1; j < uniq.length; j++) pairs.push([uniq[i], uniq[j]]);
  }

  const results = await Promise.all(
    pairs.map(async ([a, b]): Promise<InteractionResult> => {
      const ingA = ingredientOf(a);
      const ingB = ingredientOf(b);
      let row = null;
      try {
        row = await db.getInteraction(ingA, ingB);
      } catch {
        row = null;
      }

      const snippets: EvidenceSnippet[] = [
        ...(evidenceByRxcui.get(a.rxcui) ?? []),
        ...(evidenceByRxcui.get(b.rxcui) ?? []),
      ];

      if (row) {
        const text = [row.mechanism, row.management].filter(Boolean).join(" ");
        if (text) {
          snippets.push({
            id: `ddinter-${[a.rxcui, b.rxcui].sort().join("-")}`,
            source: "ddinter",
            drug: `${ingA} + ${ingB}`,
            section: "interaction",
            text: clip(text),
          });
        }
      }

      return {
        a,
        b,
        severity: row?.severity ?? "unknown",
        evidenceSnippets: snippets,
        sourceIds: snippets.map((s) => s.id),
        mechanism: row?.mechanism,
        management: row?.management,
      };
    }),
  );

  return results;
}
