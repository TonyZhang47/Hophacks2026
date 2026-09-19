import "server-only";
import { extractNumbers } from "@/lib/dose/guardrails";
import { chatText, isXaiConfigured } from "@/lib/llm";

/** First ~500 characters of cleaned label text; the UI owns the See more control. */
export const PREVIEW_CHARS = 500;
/** Grok sees at most this much; the rest of the source is appended verbatim. */
export const GROK_INPUT_CAP = 8000;

const SYSTEM = `You are a copy editor for FDA drug-label text (the adverse reactions section).

Rules:
- Do not paraphrase, summarize, add, omit, or complete cut-off medical content from memory.
- Do not rename clinical terms. Keep "adverse reactions", frequencies, drug names, and ® as they appear in the source.
- Do not invent side effects. Do not finish a truncated sentence using outside knowledge.
- Allowed: collapse duplicate section titles (e.g. repeated "ADVERSE REACTIONS"), drop sentences that only say reactions "are discussed in more detail in other sections of the labeling" or "discussed elsewhere" without listing any reaction, and fix broken whitespace.
- Keep every listed reaction and frequency that appears in the input.
- Output only the cleaned label text. No preamble, quotes, or markdown.`;

export function joinAdverseChunks(texts: string[]): string {
  return texts
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip section headers and empty "see other sections" pointers. Never drops listed reactions. */
export function stripLabelHeaders(text: string): string {
  let s = text.replace(/\s+/g, " ").trim();
  s = s.replace(/^\s*\d+(?:\.\d+)*\s+ADVERSE REACTIONS\s*/i, "");
  s = s.replace(/(?:^|[.]\s+)\d+(?:\.\d+)*\s+ADVERSE REACTIONS\s*/gi, ". ");
  s = s.replace(
    /(?:^|[.]\s+)?The following[^.]*?(?:discussed in more detail in other sections of the labeling|discussed elsewhere in (?:the )?(?:labeling|label))[:.]?\s*/gi,
    " ",
  );
  return s.replace(/\s+/g, " ").replace(/^[.\s]+/, "").trim();
}

export function previewLabel(full: string, max = PREVIEW_CHARS): string {
  const t = full.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max).replace(/\s+\S*$/, "");
  return cut.trim() || t.slice(0, max).trim();
}

function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function sentences(s: string): string[] {
  return s
    .split(/(?<=[.!?;:])\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Fail closed unless output is a subset of the source (numbers + sentence substrings). */
export function labelGroundingOk(source: string, output: string): boolean {
  const src = collapse(source);
  const out = collapse(output);
  if (!out) return false;
  if (out.length > src.length * 1.05 + 40) return false;
  const allowed = extractNumbers(source);
  for (const n of extractNumbers(output)) {
    if (!allowed.some((x) => Math.abs(x - n) < 1e-9)) return false;
  }
  for (const sent of sentences(output)) {
    const c = collapse(sent);
    if (c.length < 8) continue;
    if (!src.includes(c)) return false;
  }
  return true;
}

async function grokCopyEdit(source: string): Promise<string | null> {
  if (!isXaiConfigured() || source.length < 40) return null;
  try {
    const cleaned = (await chatText(SYSTEM, source, { temperature: 0, maxTokens: 4000 })).replace(/\s+/g, " ").trim();
    if (!cleaned || !labelGroundingOk(source, cleaned)) return null;
    return cleaned;
  } catch {
    return null;
  }
}

/**
 * Deterministic join/strip, then optional Grok copy-edit of the first window.
 * Remaining source after GROK_INPUT_CAP is appended verbatim.
 */
export async function cleanOfficialLabel(joined: string): Promise<string> {
  const stripped = stripLabelHeaders(joined);
  if (!stripped) return "";
  const head = stripped.slice(0, GROK_INPUT_CAP);
  const tail = stripped.slice(GROK_INPUT_CAP);
  const edited = (await grokCopyEdit(head)) ?? head;
  return `${edited}${tail}`.replace(/\s+/g, " ").trim();
}

export interface OfficialLabel {
  preview: string;
  full: string;
}

export function toOfficialLabel(full: string): OfficialLabel | null {
  const text = full.replace(/\s+/g, " ").trim();
  if (!text) return null;
  const preview = previewLabel(text);
  return { preview, full: text };
}
