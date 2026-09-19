import glossary from "@/data/glossary.json";

/**
 * Technical term → plain phrase. Isomorphic (no server-only) so both the UI and the
 * TTS text can use it. Longest match wins; matches are case-insensitive on word
 * boundaries, except short all-caps abbreviations (PO, BID, GI…) which must match
 * exactly to avoid false hits ("go" ≠ "GI").
 */
const ENTRIES = Object.entries(glossary as Record<string, string>).sort((a, b) => b[0].length - a[0].length);

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PATTERN = new RegExp(
  ENTRIES.map(([term]) => {
    const isAbbrev = /^[A-Za-z.]{1,5}$/.test(term) && term === term.toUpperCase();
    return isAbbrev ? `(?<![A-Za-z])${esc(term)}(?![A-Za-z])` : `\\b${esc(term)}\\b`;
  }).join("|"),
  "gi",
);

const LOOKUP = new Map(ENTRIES.map(([k, v]) => [k.toLowerCase(), { term: k, plain: v, abbrev: k === k.toUpperCase() && k.length <= 5 }]));

export interface Segment {
  text: string;
  /** Present when this segment is a replaced term. */
  original?: string;
}

function resolve(match: string) {
  const exact = LOOKUP.get(match.toLowerCase());
  if (!exact) return null;
  if (exact.abbrev && match !== exact.term) return null; // abbreviations are case-sensitive
  return exact;
}

/** Split text into plain segments and replaced-term segments (for rendering with tooltips). */
export function plainify(text: string): Segment[] {
  if (!text) return [];
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(PATTERN)) {
    const hit = resolve(m[0]);
    if (!hit) continue;
    const i = m.index ?? 0;
    let before = text.slice(last, i);
    // Fix a/an before the replacement ("an anticoagulant" → "a blood thinner").
    const art = before.match(/(^|\s)(a|an|A|An)\s$/);
    if (art) {
      const vowel = /^[aeiou]/i.test(hit.plain);
      const want = art[2][0] === "A" ? (vowel ? "An" : "A") : vowel ? "an" : "a";
      before = before.slice(0, before.length - art[2].length - 1) + want + " ";
    }
    if (before) out.push({ text: before });
    out.push({ text: hit.plain, original: m[0] });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** Plain string version (used for speech and PDFs). */
export function plainifyForSpeech(text: string): string {
  return plainify(text)
    .map((s) => s.text)
    .join("")
    .replace(/\s{2,}/g, " ");
}

/** True if the text contains at least one term we would replace. */
export function hasTechnicalTerms(text: string): boolean {
  return plainify(text).some((s) => s.original);
}
