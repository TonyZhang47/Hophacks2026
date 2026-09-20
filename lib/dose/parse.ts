/**
 * Directions parser for the Dose Explainer (Feature 7 input schema).
 *
 * Two paths:
 *  1. A deterministic regex/heuristic parser (always runs).
 *  2. When an xAI key is configured, Grok parses the same text into the schema; the two
 *     are merged with the regex winning every numeric disagreement, and any number the
 *     LLM produced that does not literally appear in the text is dropped.
 *
 * No "server-only" import at the top level: `lib/llm.ts` is imported lazily so scripts
 * can run the heuristic path offline.
 */
import { z } from "zod";
import { isXaiConfigured } from "@/lib/env";
import type { DoseInput, Med } from "@/lib/types";
import { extractNumbers } from "@/lib/dose/guardrails";

export const DoseInputSchema = z.object({
  drugName: z.string().default(""),
  rxcui: z.string().default(""),
  strengthMg: z.number().nullable().default(null),
  unitsPerDose: z.number().nullable().default(null),
  unitLabel: z.enum(["tablet", "capsule", "mL", "puff", "drop", "patch", "unit"]).default("tablet"),
  timesPerDay: z.number().nullable().default(null),
  howOftenText: z.string().default(""),
  route: z.enum(["oral", "topical", "inhaled", "other"]).default("oral"),
  withFood: z.boolean().nullable().default(null),
  asNeeded: z.boolean().default(false),
  userText: z.string().default(""),
});

export type MedHint = Pick<Med, "name" | "rxcui"> & { ingredientName?: string };

/* ------------------------------------------------------------------------------------ */
/* Heuristic parser                                                                      */
/* ------------------------------------------------------------------------------------ */

const WORD_NUM: Record<string, number> = {
  a: 1,
  an: 1,
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
  twelve: 12,
  half: 0.5,
  "1/2": 0.5,
  "½": 0.5,
};
const NUM_TOKEN = String.raw`(\d+(?:\.\d+)?|½|1/2|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|half)`;

function toNum(tok: string): number | null {
  const t = tok.toLowerCase();
  if (t in WORD_NUM) return WORD_NUM[t];
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const UNIT_MAP: { re: RegExp; label: DoseInput["unitLabel"]; route: DoseInput["route"] }[] = [
  { re: /\b(tablets?|tabs?|pills?|caplets?)\b/i, label: "tablet", route: "oral" },
  { re: /\b(capsules?|caps?)\b/i, label: "capsule", route: "oral" },
  { re: /\b(m(?:illi)?l(?:iters?|itres?)?|mls|cc|teaspoons?|tsp|tablespoons?|tbsp)\b/i, label: "mL", route: "oral" },
  { re: /\b(puffs?|inhalations?|sprays?)\b/i, label: "puff", route: "inhaled" },
  { re: /\b(drops?|gtts?)\b/i, label: "drop", route: "other" },
  { re: /\b(patch(?:es)?)\b/i, label: "patch", route: "topical" },
  { re: /\b(units?|iu|applications?)\b/i, label: "unit", route: "other" },
];

const UNIT_WORDS =
  String.raw`(tablets?|tabs?|pills?|caplets?|capsules?|caps?|m(?:illi)?l(?:iters?|itres?)?|mls|cc|teaspoons?|tsp|tablespoons?|tbsp|puffs?|inhalations?|sprays?|drops?|gtts?|patch(?:es)?|units?|iu|applications?)`;

function parseStrength(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:mg|milligrams?)\b/i);
  return m ? Number(m[1]) : null;
}

function parseUnits(text: string): { units: number | null; label: DoseInput["unitLabel"] | null; route: DoseInput["route"] | null } {
  // "<n> tablet(s)", "1 tab", "a capsule", "2 puffs"
  const m = text.match(new RegExp(String.raw`\b${NUM_TOKEN}\s*${UNIT_WORDS}\b`, "i"));
  if (m) {
    const units = toNum(m[1]);
    const unitWord = m[2];
    for (const u of UNIT_MAP) if (u.re.test(unitWord)) return { units, label: u.label, route: u.route };
  }
  // unit word present with no count → label only
  for (const u of UNIT_MAP) if (u.re.test(text)) return { units: null, label: u.label, route: u.route };
  return { units: null, label: null, route: null };
}

const RANGE_SEP = String.raw`(?:to|-|–|—)`;

/** True when the label gives a range ("6 to 8 times", "every 6-8 hours") rather than one count. */
export function hasFrequencyRange(text: string): boolean {
  const t = text.toLowerCase();
  return (
    new RegExp(String.raw`\bevery\s+${NUM_TOKEN}\s*${RANGE_SEP}\s*${NUM_TOKEN}\s*(?:hours?|hrs?|h)\b`).test(t) ||
    new RegExp(String.raw`\bq\s*${NUM_TOKEN}\s*${RANGE_SEP}\s*${NUM_TOKEN}\s*(?:h|hrs?|hours?)\b`).test(t) ||
    new RegExp(String.raw`\b${NUM_TOKEN}\s*${RANGE_SEP}\s*${NUM_TOKEN}\s*(?:x|times?)\s*(?:a|per|each|every|/)?\s*(?:day|daily|d)\b`).test(t)
  );
}

/** Copy the frequency phrase from the bottle so we never invent "4 times a day" for a range. */
export function parseHowOftenText(text: string): string {
  const patterns = [
    new RegExp(String.raw`\bevery\s+${NUM_TOKEN}\s*${RANGE_SEP}\s*${NUM_TOKEN}\s*(?:hours?|hrs?|h)\b`, "i"),
    new RegExp(String.raw`\bq\s*${NUM_TOKEN}\s*${RANGE_SEP}\s*${NUM_TOKEN}\s*(?:h|hrs?|hours?)\b`, "i"),
    new RegExp(String.raw`\b${NUM_TOKEN}\s*${RANGE_SEP}\s*${NUM_TOKEN}\s*(?:x|times?)\s*(?:a|per|each|every|/)?\s*(?:day|daily|d)\b`, "i"),
    new RegExp(String.raw`\bevery\s+${NUM_TOKEN}\s*(?:hours?|hrs?|h)\b`, "i"),
    /\bq\s*\d+\s*(?:h|hrs?|hours?)\b/i,
    new RegExp(String.raw`\b${NUM_TOKEN}\s*(?:x|times?)\s*(?:a|per|each|every|/)?\s*(?:day|daily|d)\b`, "i"),
    /\b(?:once|twice|three times|four times)\s+(?:a|per|each|every)\s+(?:day|daily)\b/i,
    /\b(?:once|twice|three times|four times)\s+daily\b/i,
    /\b(?:once a day|twice a day|once daily|twice daily|at bedtime|every morning|every night|nightly)\b/i,
    /\b(?:bid|tid|qid|qd|qhs|q\.i\.d\.?|t\.i\.d\.?|b\.i\.d\.?|q\.?d\.?|q\.?h\.?s\.?)\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[0].replace(/\s+/g, " ").trim();
  }
  return "";
}

function parseTimesPerDay(text: string): number | null {
  const t = text.toLowerCase();

  // Patterns we deliberately cannot express as a single "times per day" number.
  if (/\bevery other day\b|\bevery (?:2|two) days\b|\bonce a week\b|\bweekly\b|\bevery week\b|\bmonthly\b/.test(t)) return null;
  if (hasFrequencyRange(t)) return null;

  // every N hours / qNh / q N h  (single interval only — ranges stay as the printed phrase)
  let m = t.match(new RegExp(String.raw`\bevery\s+${NUM_TOKEN}\s*(?:hours?|hrs?|h)\b`));
  if (!m) m = t.match(/\bq\s*(\d+)\s*(?:h|hrs?|hours?)\b/);
  if (m) {
    const n = toNum(m[1]);
    if (n && n > 0 && n <= 24) return Math.max(1, Math.floor(24 / n));
  }

  // N times a/per/each day, N times daily, Nx a day, Nx/day
  m = t.match(new RegExp(String.raw`\b${NUM_TOKEN}\s*(?:x|times?)\s*(?:a|per|each|every|/)?\s*(?:day|daily|d)\b`));
  if (m) {
    const n = toNum(m[1]);
    if (n && n > 0) return n;
  }

  if (/\b(?:once|one time|1 time)\s+(?:a|per|each|every)\s+day\b|\bonce daily\b|\bonce a day\b|\bqd\b|\bq\.?d\.?\b|\bdaily\b|\bevery day\b|\beach day\b|\bevery morning\b|\bevery night\b|\bnightly\b|\bat bedtime\b|\bbedtime\b|\bqhs\b|\bq\.?h\.?s\.?\b|\bin the morning\b/.test(t)) {
    // "twice daily" contains "daily" — check the stronger words first.
    if (/\btwice\b|\bbid\b|\bb\.i\.d\.?\b|\b2 times\b|\btwo times\b/.test(t)) return 2;
    if (/\bthree times\b|\btid\b|\bt\.i\.d\.?\b|\b3 times\b/.test(t)) return 3;
    if (/\bfour times\b|\bqid\b|\bq\.i\.d\.?\b|\b4 times\b/.test(t)) return 4;
    // "in the morning and at night" → 2
    if (/\b(?:morning|breakfast)\b/.test(t) && /\b(?:evening|night|bedtime|dinner|supper)\b/.test(t)) return 2;
    return 1;
  }
  if (/\btwice\b|\bbid\b|\bb\.i\.d\.?\b/.test(t)) return 2;
  if (/\bthree times\b|\btid\b|\bt\.i\.d\.?\b/.test(t)) return 3;
  if (/\bfour times\b|\bqid\b|\bq\.i\.d\.?\b/.test(t)) return 4;
  if (/\b(?:morning|breakfast)\b/.test(t) && /\b(?:evening|night|bedtime|dinner|supper)\b/.test(t)) return 2;
  return null;
}

function parseWithFood(text: string): boolean | null {
  const t = text.toLowerCase();
  if (/\b(?:on an empty stomach|empty stomach|without food|before (?:meals|eating|food|breakfast))\b/.test(t)) return false;
  if (/\bwith (?:food|meals?|a meal|breakfast|dinner|supper|lunch|snack)\b|\bafter (?:meals?|eating|food|breakfast|dinner)\b|\bwhile eating\b/.test(t)) return true;
  return null;
}

function parseAsNeeded(text: string): boolean {
  return /\bas needed\b|\bprn\b|\bp\.r\.n\.?\b|\bwhen needed\b|\bif needed\b|\bas required\b|\bwhen necessary\b|\bas necessary\b/i.test(text);
}

function parseRoute(text: string, fromUnit: DoseInput["route"] | null): DoseInput["route"] {
  const t = text.toLowerCase();
  if (/\b(?:by mouth|orally|po|p\.o\.|swallow)\b/.test(t)) return "oral";
  if (/\b(?:inhale|inhaled|inhaler|breathe in)\b/.test(t)) return "inhaled";
  if (/\b(?:apply|topically|to the skin|on the skin|rub)\b/.test(t)) return "topical";
  if (/\b(?:inject|injection|under the skin|subcutaneous|eye|ear|nose|nasal|rectal|vaginal)\b/.test(t)) return "other";
  return fromUnit ?? "oral";
}

const STOP_LEAD = new Set(["take", "taking", "takes", "use", "using", "give", "apply", "my", "the", "a", "an", "of", "for", "rx", "med", "medicine", "medication", "please", "i", "and", "then"]);

/** Leading alphabetic tokens before the first number or unit word, e.g. "metformin 500 mg …" → "metformin". */
function parseDrugName(text: string): string {
  const cleaned = text.replace(/[,;:()]/g, " ").replace(/\s+/g, " ").trim();
  const unitRe = new RegExp(String.raw`^${UNIT_WORDS}$`, "i");
  const tokens = cleaned.split(" ");
  const name: string[] = [];
  for (const tok of tokens) {
    const low = tok.toLowerCase();
    if (/\d/.test(tok) || unitRe.test(tok) || /^(?:mg|mcg|ml|by|with|every|once|twice|daily|at|as|q\d*h?|prn|bid|tid|qid|qd|qhs)$/i.test(tok)) break;
    if (name.length === 0 && STOP_LEAD.has(low)) continue;
    if (!/^[a-z][a-z'\-]*$/i.test(tok)) break;
    name.push(tok);
    if (name.length >= 3) break;
  }
  // Drop trailing salt/form words that are not part of a search name.
  while (name.length && /^(?:hydrochloride|hcl|sodium|phosphate|ph|besylate|mesylate|tablet|tablets|capsule|capsules|er|xr|sr)$/i.test(name[name.length - 1])) name.pop();
  return name.join(" ").toLowerCase();
}

/** Deterministic parse. Never throws. */
export function parseDirectionsHeuristic(text: string, medHint?: MedHint): DoseInput {
  const userText = text.trim();
  const strengthMg = parseStrength(userText);
  const u = parseUnits(userText);
  const timesPerDay = parseTimesPerDay(userText);
  const howOftenText = parseHowOftenText(userText);
  const withFood = parseWithFood(userText);
  const asNeeded = parseAsNeeded(userText);
  const route = parseRoute(userText, u.route);
  const drugName = medHint?.name?.trim() || parseDrugName(userText);
  return {
    drugName,
    rxcui: medHint?.rxcui ?? "",
    strengthMg,
    unitsPerDose: u.units,
    unitLabel: u.label ?? "tablet",
    timesPerDay,
    howOftenText,
    route,
    withFood,
    asNeeded,
    userText,
  };
}

/* ------------------------------------------------------------------------------------ */
/* LLM parse + merge                                                                     */
/* ------------------------------------------------------------------------------------ */

const PARSE_SYSTEM = `You extract the directions printed on a person's own medicine bottle into a fixed JSON schema.
You never guess a dose. If a field is not stated in the text, use null (or false for asNeeded).
Numbers must be copied exactly from the text. Never convert a printed range into a single count.
Output only JSON with keys:
drugName (string), rxcui (""), strengthMg (number|null, milligrams only), unitsPerDose (number|null),
unitLabel ("tablet"|"capsule"|"mL"|"puff"|"drop"|"patch"|"unit"),
howOftenText (string; copy the frequency phrase exactly as printed, e.g. "6 to 8 times a day" or "every 6 to 8 hours"),
timesPerDay (number|null; only when ONE count is stated. "twice daily" = 2, "every 8 hours" = 3, "at bedtime" = 1.
If the label gives a range such as "6 to 8 times a day" or "every 6 to 8 hours", set timesPerDay to null and put the exact phrase in howOftenText),
route ("oral"|"topical"|"inhaled"|"other"), withFood (boolean|null),
asNeeded (boolean), userText (the input text verbatim).`;

export interface ParseMerge {
  input: DoseInput;
  notes: string[];
  source: "regex" | "regex+llm";
}

/** True when `n` appears literally (digits or number word) in the text. */
function numberInText(n: number, text: string): boolean {
  return extractNumbers(text).some((x) => Math.abs(x - n) < 1e-9);
}

export function mergeParses(regex: DoseInput, llm: DoseInput, text: string): ParseMerge {
  const notes: string[] = [];
  const out: DoseInput = { ...regex };

  for (const key of ["strengthMg", "unitsPerDose", "timesPerDay"] as const) {
    const r = regex[key];
    const l = llm[key];
    if (r != null) {
      if (l != null && Math.abs(r - l) > 1e-9) notes.push(`${key}: LLM said ${l}, regex said ${r}; kept regex`);
      continue;
    }
    if (l != null) {
      // Only accept an LLM number the person actually wrote (or a single every-N-hours form).
      // Never accept a derived timesPerDay when the bottle printed a range — that is how
      // "every 6 to 8 hours" / "6 to 8 times a day" used to get rounded to 4.
      const derivedOk =
        key === "timesPerDay" &&
        !hasFrequencyRange(text) &&
        Number.isInteger(24 / l) &&
        numberInText(24 / l, text);
      const literal = numberInText(l, text) || derivedOk;
      if (literal) {
        out[key] = l;
        notes.push(`${key}: regex found nothing, accepted LLM value ${l} (present in text)`);
      } else {
        notes.push(`${key}: dropped LLM value ${l} (not in text)`);
      }
    }
  }

  if (!out.howOftenText && llm.howOftenText) {
    const phrase = llm.howOftenText.replace(/\s+/g, " ").trim();
    if (phrase && text.toLowerCase().includes(phrase.toLowerCase())) out.howOftenText = phrase;
  }
  if (hasFrequencyRange(text)) {
    if (out.timesPerDay != null) notes.push(`timesPerDay: cleared ${out.timesPerDay} because the bottle printed a range`);
    out.timesPerDay = null;
  }

  if (regex.withFood == null && llm.withFood != null) out.withFood = llm.withFood;
  if (!regex.asNeeded && llm.asNeeded) out.asNeeded = true;
  if (!regex.drugName && llm.drugName) out.drugName = llm.drugName.trim().toLowerCase();
  // unitLabel/route: regex derives them from unit words; take the LLM's only when the text had no unit word.
  const regexHadUnit = parseUnits(text).label != null;
  if (!regexHadUnit) {
    out.unitLabel = llm.unitLabel;
    out.route = llm.route;
  }

  return { input: out, notes, source: "regex+llm" };
}

/**
 * Parse free-text directions into the Feature 7 input schema.
 * `rxcui` is left as "" unless `medHint` provides it; the route resolves it.
 */
export async function parseDirections(text: string, medHint?: MedHint): Promise<DoseInput> {
  const { input } = await parseDirectionsDetailed(text, medHint);
  return input;
}

export async function parseDirectionsDetailed(text: string, medHint?: MedHint): Promise<ParseMerge> {
  const regex = parseDirectionsHeuristic(text, medHint);
  if (!isXaiConfigured()) return { input: regex, notes: [], source: "regex" };

  try {
    const { chatJson } = await import("@/lib/llm");
    const llmRaw = await chatJson(PARSE_SYSTEM, JSON.stringify({ text: text.trim() }), DoseInputSchema, {
      temperature: 0,
      retries: 1,
      maxTokens: 400,
    });
    const llm: DoseInput = { ...llmRaw, userText: text.trim(), rxcui: regex.rxcui };
    const merged = mergeParses(regex, llm, text);
    if (medHint?.name) merged.input.drugName = medHint.name.trim();
    if (merged.notes.length) console.info("[dose] parse merge", merged.notes);
    return merged;
  } catch (e) {
    console.warn("[dose] LLM parse failed, using regex only:", (e as Error).message);
    return { input: regex, notes: [`llm parse failed: ${(e as Error).message}`], source: "regex" };
  }
}
