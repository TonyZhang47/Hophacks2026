/**
 * Dose Explainer guardrails (Feature 7, G1–G5).
 *
 * Pure functions, no I/O, no "server-only" import so scripts can exercise them offline.
 * Every check returns `{ ok, reason? }`; the pipeline in `explain.ts` collects a log.
 *
 * The one that matters most is G3: every number that could reach the screen or the
 * speaker must already exist in the person's own confirmed directions or verbatim in the
 * official label text we retrieved. Anything else fails closed.
 */
import { z } from "zod";
import type { DoseInput, DoseResult, DoseStatus } from "@/lib/types";

export interface GuardrailCheck {
  ok: boolean;
  reason?: string;
}

/* ------------------------------------------------------------------------------------ */
/* G1 — schema                                                                           */
/* ------------------------------------------------------------------------------------ */

export const DoseStatusSchema = z.enum(["consistent", "above_label_max", "inconsistent", "unverified"]);

/** Shape the LLM (or the template writer) must produce. Everything the UI renders is here. */
export const LlmDoseOutputSchema = z.object({
  status: DoseStatusSchema,
  plainDose: z.string().default(""),
  maxPerDayLine: z.string().default(""),
  timing: z.array(z.string()).default([]),
  missedDoseLine: z.string().default(""),
  labelQuotes: z.array(z.object({ chunkId: z.string(), text: z.string() })).default([]),
  numbersUsed: z.array(z.number()).default([]),
  askYourPharmacist: z.string().default(""),
});
export type LlmDoseOutput = z.infer<typeof LlmDoseOutputSchema>;

export function g1Schema(obj: unknown): GuardrailCheck & { data?: LlmDoseOutput } {
  const r = LlmDoseOutputSchema.safeParse(obj);
  if (r.success) return { ok: true, data: r.data };
  const issues = r.error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
    .join("; ");
  return { ok: false, reason: `schema: ${issues}` };
}

/* ------------------------------------------------------------------------------------ */
/* G2 — no-advice filter                                                                 */
/* ------------------------------------------------------------------------------------ */

/**
 * Phrases that would turn a reading aid into dosing advice. A negated form
 * ("do not double", "never skip") is label language, not advice, and is allowed.
 */
const ADVICE_PATTERNS: RegExp[] = [
  /\b(?:increase|increasing|decrease|decreasing|reduce|reducing|raise|raising|lower|lowering)\b(?!\s+blood)/i,
  /(?<!\b(?:do not|don't|never|not|without)\s)\bdouble\b/i,
  /(?<!\b(?:do not|don't|never|not)\s)\bskip(?:ping)?\b/i,
  /(?<!\b(?:do not|don't|never|not)\s)\bstop(?:ping)?\b/i,
  /\binstead,? take\b/i,
  /\btake\b[^.]{0,40}\binstead\b/i,
  /\byou (?:should|could|can|may|might) take\b/i,
  /\btry taking\b/i,
  /\bcut (?:it |them |the (?:pill|tablet|dose) )?in half\b/i,
  /\bhalve\b/i,
  /\btake (?:more|less|extra|another|an extra|an additional|additional)\b/i,
  /\bextra (?:dose|tablet|pill)\b/i,
  /\badd (?:a|an|another|one more)\b/i,
  /\bmore than (?:the|what the) label\b/i,
  /\bup the dose\b/i,
  /\bswitch to\b/i,
  /\btaper\b/i,
  /\bwe (?:recommend|suggest)\b/i,
  /\b(?:recommended|suggested) dose for you\b/i,
];

export function g2NoAdvice(text: string): GuardrailCheck {
  const hits: string[] = [];
  for (const re of ADVICE_PATTERNS) {
    const m = text.match(re);
    if (m) hits.push(m[0].trim());
  }
  if (hits.length) return { ok: false, reason: `advice language: "${[...new Set(hits)].join('", "')}"` };
  return { ok: true };
}

/* ------------------------------------------------------------------------------------ */
/* Number extraction + normalisation (shared by G3 and the template writer)              */
/* ------------------------------------------------------------------------------------ */

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  twenty: 20,
  thirty: 30,
  once: 1,
  twice: 2,
  thrice: 3,
  half: 0.5,
  // Spanish (template output can be Spanish; numbers pass through as digits, but be safe)
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  doce: 12,
};

/** "2,550" → "2550". Only strips commas used as thousands separators. */
export function normaliseNumberText(text: string): string {
  return text.replace(/(\d),(?=\d{3}\b)/g, "$1");
}

/**
 * Every number in a string: digits (with decimals, thousands commas removed) and the
 * common number words ("one", "twice"). Units are irrelevant — "500 mg" yields 500.
 */
export function extractNumbers(text: string): number[] {
  const out: number[] = [];
  const clean = normaliseNumberText(text);
  for (const m of clean.match(/\d+(?:\.\d+)?/g) ?? []) out.push(Number(m));
  for (const m of clean.toLowerCase().match(/\b[a-záéíóú]+\b/g) ?? []) {
    if (m in NUMBER_WORDS) out.push(NUMBER_WORDS[m]);
  }
  return out;
}

function sameNumber(a: number, b: number) {
  return Math.abs(a - b) < 1e-9;
}

/** Numbers the person themselves gave us, plus the two arithmetic derivations we allow. */
export function allowedNumbersFromInput(input: DoseInput): number[] {
  const nums: number[] = [];
  const { strengthMg, unitsPerDose, timesPerDay } = input;
  if (strengthMg != null) nums.push(strengthMg);
  if (unitsPerDose != null) nums.push(unitsPerDose);
  if (timesPerDay != null) nums.push(timesPerDay);
  if (strengthMg != null && unitsPerDose != null && timesPerDay != null) {
    nums.push(strengthMg * unitsPerDose * timesPerDay); // dailyMg
  }
  if (strengthMg != null && unitsPerDose != null) nums.push(strengthMg * unitsPerDose); // mg per dose
  if (timesPerDay != null && timesPerDay > 0 && Number.isInteger(24 / timesPerDay)) {
    nums.push(24 / timesPerDay); // hours between doses
  }
  // The person's own text is part of the confirmed input.
  nums.push(...extractNumbers(input.userText ?? ""));
  return nums;
}

/* ------------------------------------------------------------------------------------ */
/* G3 — numeric grounding (the critical one)                                             */
/* ------------------------------------------------------------------------------------ */

export type QuoteLike = { text: string };

export interface G3Result extends GuardrailCheck {
  /** Numbers found in the output that were verified. */
  grounded: number[];
  /** Numbers found in the output with no source. */
  unmatched: number[];
}

export function g3NumericGrounding(
  result: Pick<LlmDoseOutput, "plainDose" | "maxPerDayLine" | "timing" | "missedDoseLine" | "numbersUsed">,
  input: DoseInput,
  quotes: QuoteLike[],
): G3Result {
  const allowed: number[] = [...allowedNumbersFromInput(input)];
  for (const q of quotes) allowed.push(...extractNumbers(q.text));

  const found: number[] = [
    ...extractNumbers(result.plainDose),
    ...extractNumbers(result.maxPerDayLine),
    ...result.timing.flatMap((t) => extractNumbers(t)),
    ...extractNumbers(result.missedDoseLine),
    ...result.numbersUsed,
  ];

  const grounded: number[] = [];
  const unmatched: number[] = [];
  for (const n of found) {
    if (allowed.some((a) => sameNumber(a, n))) {
      if (!grounded.some((g) => sameNumber(g, n))) grounded.push(n);
    } else if (!unmatched.some((u) => sameNumber(u, n))) {
      unmatched.push(n);
    }
  }

  if (unmatched.length) {
    return {
      ok: false,
      grounded,
      unmatched,
      reason: `${unmatched.join(", ")} not in label or input`,
    };
  }

  const inputHadNumbers = input.unitsPerDose != null || input.timesPerDay != null;
  if (inputHadNumbers && extractNumbers(result.plainDose).length === 0) {
    return {
      ok: false,
      grounded,
      unmatched,
      reason: "plainDose contains no numbers although the directions did",
    };
  }

  return { ok: true, grounded, unmatched, reason: `${grounded.length} numbers grounded` };
}

/* ------------------------------------------------------------------------------------ */
/* G4 — placeholder pass-through for translation                                         */
/* ------------------------------------------------------------------------------------ */

export interface PlaceholderResult {
  template: string;
  values: string[];
}

const MEASURE_UNIT = "(?:mg|mcg|µg|ug|g|kg|mL|ml|L|units?|%)";

/**
 * Replace every number (with its measurement unit, if any) and the drug name with
 * `{{0}}`, `{{1}}`… so a translator can never alter them. `restore` puts them back.
 * Re-run G3 on the restored text — translation is not trusted either.
 */
export function g4Placeholders(text: string, drugName?: string): PlaceholderResult {
  const values: string[] = [];
  // One pass with one alternation, so a placeholder we insert is never re-scanned.
  const numberPart = `\\d[\\d,]*(?:\\.\\d+)?(?:\\s?${MEASURE_UNIT}\\b)?`;
  const namePart = drugName && drugName.trim() ? `\\b${drugName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b|` : "";
  const template = text.replace(new RegExp(`${namePart}${numberPart}`, "gi"), (m) => {
    values.push(m);
    return `{{${values.length - 1}}}`;
  });
  return { template, values };
}

export function restorePlaceholders(template: string, values: string[]): string {
  return template.replace(/\{\{\s*(\d+)\s*\}\}/g, (_m, i: string) => values[Number(i)] ?? "");
}

/* ------------------------------------------------------------------------------------ */
/* G5 — fail closed                                                                      */
/* ------------------------------------------------------------------------------------ */

export const FAIL_CLOSED_REASON: Record<Exclude<DoseStatus, "consistent">, { en: string; es: string }> = {
  above_label_max: {
    en: "Your directions add up to more than the label's daily maximum.",
    es: "Sus indicaciones suman más que el máximo diario de la etiqueta.",
  },
  inconsistent: {
    en: "Your directions do not match what the official label says.",
    es: "Sus indicaciones no coinciden con lo que dice la etiqueta oficial.",
  },
  unverified: {
    en: "We could not verify these directions against the official label.",
    es: "No pudimos verificar estas indicaciones con la etiqueta oficial.",
  },
};

/** Any status other than `consistent` renders the "Check with your pharmacist" card. */
export function g5FailClosed(status: DoseStatus, lang: "en" | "es" = "en"): GuardrailCheck {
  if (status === "consistent") return { ok: true };
  return { ok: false, reason: FAIL_CLOSED_REASON[status][lang] };
}

/** Remove every digit so a fail-closed string can never carry a number. */
export function stripDigits(s: string): string {
  return s.replace(/\d[\d,.]*/g, "").replace(/\s{2,}/g, " ").trim();
}

/**
 * Apply G5 to a result: blank every field that could carry a number, keep the label
 * quotes as evidence, and make sure the pharmacist question has no digits.
 */
export function applyFailClosed(result: DoseResult, lang: "en" | "es" = "en"): DoseResult {
  if (result.status === "consistent") return result;
  const reason = result.reason && result.reason.trim() ? result.reason : FAIL_CLOSED_REASON[result.status][lang];
  return {
    ...result,
    plainDose: "",
    maxPerDayLine: "",
    timing: [],
    missedDoseLine: "",
    numbersUsed: [],
    reason: stripDigits(reason),
    askYourPharmacist: stripDigits(result.askYourPharmacist),
  };
}
