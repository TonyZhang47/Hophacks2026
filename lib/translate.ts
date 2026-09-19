import "server-only";
import { chatText, isXaiConfigured } from "@/lib/llm";

/**
 * Text translation of already-validated strings with the G4 placeholder pass-through
 * (Feature 7 guardrail): numbers (with units), drug names and time spans are swapped for
 * `{{n}}` tokens before the LLM sees the text and restored afterwards. If any token does not
 * come back exactly once, that string is returned UNCHANGED (fail closed).
 *
 * This file implements protect/restore itself; it deliberately does not import lib/dose.
 */

export type TranslateTarget = "es" | "en";
export type TranslateProvider = "grok" | "none";

export interface TranslateOptions {
  /** Apply the G4 placeholder pass (default true). */
  protect?: boolean;
  /** Drug names to shield verbatim (case-insensitive match). */
  names?: string[];
}

export interface TranslateResult {
  translated: string[];
  /** "grok" when every string was translated; "none" when the key is missing or any item failed. */
  provider: TranslateProvider;
  /** Per-item provider so callers can show a partial result honestly. */
  perItem: TranslateProvider[];
}

const LANG_NAME: Record<TranslateTarget, string> = { es: "Spanish (Latin American, plain everyday words)", en: "English (plain everyday words)" };

// Only true measurement units ride inside the placeholder; countable words (tablets, times, hours)
// stay outside so they get translated ("2 times" → "2 veces").
const UNIT = "(?:mg|mcg|µg|ug|g|kg|mL|ml|L|%|IU)";
// Order matters: number+unit first ("2,550 mg"), then bare numbers.
const NUMBER_TIME_RE = new RegExp(
  `\\d[\\d,.]*\\s?${UNIT}\\b|\\d[\\d,.]*`,
  "g",
);

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface Protected {
  text: string;
  slots: string[];
}

/** Replace protected spans with `{{n}}` tokens. Exported for tests. */
export function protect(text: string, names: string[] = []): Protected {
  const slots: string[] = [];
  const spans: { start: number; end: number }[] = [];

  const claim = (start: number, end: number) => {
    if (spans.some((s) => start < s.end && end > s.start)) return; // overlap → first claim wins
    spans.push({ start, end });
  };

  // 1) Drug names (longest first so "metformin er" beats "metformin").
  const cleanNames = [...new Set(names.map((n) => n.trim()).filter((n) => n.length >= 2))].sort((a, b) => b.length - a.length);
  for (const name of cleanNames) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(name)}(?![\\p{L}\\p{N}])`, "giu");
    for (const m of text.matchAll(re)) claim(m.index!, m.index! + m[0].length);
  }
  // 2) Numbers with optional units / time words.
  for (const m of text.matchAll(NUMBER_TIME_RE)) {
    let raw = m[0];
    // Don't swallow a trailing sentence period ("2,550." → "2,550").
    while (/[.,]$/.test(raw)) raw = raw.slice(0, -1);
    if (!raw) continue;
    claim(m.index!, m.index! + raw.length);
  }

  spans.sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  for (const s of spans) {
    out += text.slice(cursor, s.start);
    slots.push(text.slice(s.start, s.end));
    out += `{{${slots.length - 1}}}`;
    cursor = s.end;
  }
  out += text.slice(cursor);
  return { text: out, slots };
}

/**
 * Put the original spans back. Returns `null` when any placeholder is missing, duplicated,
 * or an unknown placeholder appears — the caller must then fall back to the original string.
 * Exported for tests.
 */
export function restore(translated: string, slots: string[]): string | null {
  const seen = new Map<number, number>();
  const tokenRe = /\{\{\s*(\d+)\s*\}\}/g;
  for (const m of translated.matchAll(tokenRe)) {
    const i = Number(m[1]);
    seen.set(i, (seen.get(i) ?? 0) + 1);
  }
  for (let i = 0; i < slots.length; i++) if (seen.get(i) !== 1) return null;
  for (const k of seen.keys()) if (k >= slots.length) return null;
  // Reject any stray number the model may have introduced or "helpfully" expanded.
  const stripped = translated.replace(tokenRe, "");
  if (/\d/.test(stripped)) return null;
  return translated.replace(tokenRe, (_, n) => slots[Number(n)]);
}

const SYSTEM = (target: TranslateTarget) => `You are a translation engine for a medicine reading aid. Translate each line into ${LANG_NAME[target]}.
Rules — follow all of them exactly:
1. Translate meaning only. Do not add, remove, merge or split sentences. Do not add advice, warnings or explanations.
2. Placeholders that look like {{0}}, {{1}} ... stand for numbers, units, times and drug names. Copy every placeholder into the translation EXACTLY as written, exactly once, in the natural position. Never translate, reorder digits inside, drop, or duplicate a placeholder.
3. Never write any digit yourself. Numbers only ever appear via placeholders.
4. Use plain everyday words a person without medical training understands. Keep it short and preserve the source's tone and level of formality. Do not replace simple descriptions with medical jargon, abbreviations, or complicated wording. For formal Spanish text, use natural, neutral Latin American Spanish and "usted" if addressing the reader directly; avoid casual expressions such as "panza" (use "vientre"). Preserve the meaning of risks and uncertainty.
5. Input is a JSON array of strings. Output ONLY a JSON array of translated strings, same length, same order. No markdown, no commentary.`;

/**
 * Translate `strings` to `target`. When XAI_API_KEY is missing, returns the originals with
 * provider "none". Every returned string either passed the placeholder round-trip or is
 * the untouched original.
 */
export async function translateStrings(
  strings: string[],
  target: TranslateTarget,
  opts: TranslateOptions = {},
): Promise<TranslateResult> {
  const useProtect = opts.protect ?? true;
  const names = opts.names ?? [];
  const none: TranslateResult = { translated: [...strings], provider: "none", perItem: strings.map(() => "none" as const) };
  if (strings.length === 0) return { translated: [], provider: "grok", perItem: [] };
  if (!isXaiConfigured()) return none;

  const prepared = strings.map((s) => (useProtect ? protect(s, names) : { text: s, slots: [] as string[] }));

  let raw: unknown;
  try {
    const content = await chatText(SYSTEM(target), JSON.stringify(prepared.map((p) => p.text)), {
      temperature: 0,
      maxTokens: Math.min(4000, 200 + strings.reduce((n, s) => n + s.length, 0) * 2),
    });
    raw = JSON.parse(content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim());
  } catch (e) {
    console.warn(`[translate] provider error: ${(e as Error).message}`);
    return none;
  }
  if (!Array.isArray(raw) || raw.length !== strings.length) {
    console.warn(`[translate] bad array shape (${Array.isArray(raw) ? raw.length : typeof raw} vs ${strings.length}); returning originals`);
    return none;
  }

  const translated: string[] = [];
  const perItem: TranslateProvider[] = [];
  raw.forEach((item, i) => {
    const original = strings[i];
    if (typeof item !== "string" || !item.trim()) {
      translated.push(original);
      perItem.push("none");
      return;
    }
    const restored = restore(item, prepared[i].slots);
    if (restored === null) {
      console.warn(`[translate] G4 placeholder mismatch on item ${i}; keeping original`);
      translated.push(original);
      perItem.push("none");
      return;
    }
    translated.push(restored);
    perItem.push("grok");
  });

  return { translated, perItem, provider: perItem.every((p) => p === "grok") ? "grok" : "none" };
}
