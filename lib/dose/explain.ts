/**
 * Dose Explainer pipeline (Feature 7): retrieve → ceiling → rewrite → guardrails → fail closed.
 *
 * RxPlain never computes, recommends, or adjusts a dose. This module restates the
 * person's own directions, checks them against official label text, and refuses to
 * show any number it cannot verify.
 *
 * Server modules that import "server-only" (`@/lib/db`, `@/lib/openfda`, `@/lib/llm`)
 * are imported lazily so the pipeline can run offline with an injected `Db`.
 */
import type { Db } from "@/lib/db/types";
import { isXaiConfigured } from "@/lib/env";
import { plainifyForSpeech } from "@/lib/glossary";
import type { DoseInput, DoseResult, DoseStatus, LabelChunk, LabelSectionName } from "@/lib/types";
import {
  FAIL_CLOSED_REASON,
  LlmDoseOutputSchema,
  applyFailClosed,
  extractNumbers,
  g1Schema,
  g2NoAdvice,
  g3NumericGrounding,
  stripDigits,
  type LlmDoseOutput,
} from "@/lib/dose/guardrails";

export type Lang = "en" | "es";

export interface ExplainDeps {
  /** Inject a Db (e.g. MemoryDb in scripts). When omitted, `getDb()` + openFDA fetch are used. */
  db?: Db;
}

const RAG_SECTIONS: LabelSectionName[] = ["dosage_and_administration", "overdosage", "boxed_warning"];

const REWRITE_SYSTEM =
  "You are a reading aid. You may only restate the user's own directions and quote the provided label text. Never suggest a different dose. If the label text and the user's directions disagree, say so plainly and tell them to ask a pharmacist. " +
  "Write for someone who cannot see well and has no medical training: use the plain phrase, not the medical term (say 'low blood sugar', not 'hypoglycemia'; 'by mouth', not 'PO'; 'twice a day', not 'BID'; 'blood thinner', not 'anticoagulant'). Never change a number while doing so. " +
  "labelQuotes must stay verbatim. Output the JSON schema exactly.";

const COPY = {
  en: {
    noLabel: "We could not find official label text for this medicine.",
    missingFields: "We could not tell how much or how often to take from these directions.",
    guardrail: "We could not verify every part of these directions against the official label.",
    labelSays: "The label says:",
    ask: (drug: string) =>
      `Is this the right amount of ${drug || "this medicine"} for me, and is there anything I should know about taking it with my other medicines?`,
    askNoDigits: (drug: string) =>
      `Can you go over how much ${drug || "this medicine"} I should take and when, and check it against what my label says?`,
  },
  es: {
    noLabel: "No encontramos el texto oficial de la etiqueta de este medicamento.",
    missingFields: "No pudimos saber cuánto ni con qué frecuencia tomar según estas indicaciones.",
    guardrail: "No pudimos verificar cada parte de estas indicaciones con la etiqueta oficial.",
    labelSays: "La etiqueta dice:",
    ask: (drug: string) =>
      `¿Esta cantidad de ${drug || "este medicamento"} es la correcta para mí, y hay algo que deba saber sobre tomarla con mis otros medicamentos?`,
    askNoDigits: (drug: string) =>
      `¿Puede repasar conmigo cuánto ${drug || "de este medicamento"} debo tomar y cuándo, y compararlo con lo que dice mi etiqueta?`,
  },
} as const;

/* ------------------------------------------------------------------------------------ */
/* Template writer (deterministic; used when no key or the LLM errors)                   */
/* ------------------------------------------------------------------------------------ */

const UNIT_WORDS: Record<DoseInput["unitLabel"], { en: [string, string]; es: [string, string] }> = {
  tablet: { en: ["tablet", "tablets"], es: ["tableta", "tabletas"] },
  capsule: { en: ["capsule", "capsules"], es: ["cápsula", "cápsulas"] },
  mL: { en: ["mL", "mL"], es: ["mL", "mL"] },
  puff: { en: ["puff", "puffs"], es: ["inhalación", "inhalaciones"] },
  drop: { en: ["drop", "drops"], es: ["gota", "gotas"] },
  patch: { en: ["patch", "patches"], es: ["parche", "parches"] },
  unit: { en: ["unit", "units"], es: ["unidad", "unidades"] },
};

const ROUTE_PHRASE: Record<DoseInput["route"], { en: string; es: string }> = {
  oral: { en: "by mouth", es: "por la boca" },
  inhaled: { en: "by breathing it in", es: "inhalándolo" },
  topical: { en: "on the skin", es: "sobre la piel" },
  other: { en: "", es: "" },
};

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z“"(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const MAX_PER_DAY_RE =
  /(?:do not (?:take|exceed|use)\b|maximum recommended daily|maximum daily|not more than|no more than|should not exceed|are not recommended|in (?:a day|24 hours))/i;

/** The first label sentence that states a per-day ceiling and contains a number. Verbatim. */
export function findMaxPerDaySentence(chunks: LabelChunk[]): string | null {
  for (const c of chunks) {
    if (c.section !== "dosage_and_administration" && c.section !== "overdosage") continue;
    for (const s of splitSentences(c.text)) {
      if (/\d/.test(s) && MAX_PER_DAY_RE.test(s)) return s;
    }
  }
  return null;
}

/** Every label sentence that talks about a missed dose. Verbatim. */
export function findMissedDoseSentences(chunks: LabelChunk[]): string[] {
  const out: string[] = [];
  for (const c of chunks) {
    for (const s of splitSentences(c.text)) {
      if (/\bmissed dose\b|\bmiss(?:es|ed)? a dose\b|\bdose is missed\b/i.test(s)) out.push(s);
    }
  }
  return out;
}

function timingLines(input: DoseInput, lang: Lang): string[] {
  const t = input.timesPerDay;
  if (t == null) return [];
  if (input.asNeeded) {
    const gap = Number.isInteger(24 / t) ? 24 / t : null;
    if (gap == null) return lang === "es" ? ["solo cuando lo necesite"] : ["only when you need it"];
    return lang === "es"
      ? [`solo cuando lo necesite, con al menos ${gap} horas entre dosis`]
      : [`only when you need it, at least ${gap} hours apart`];
  }
  const en: Record<number, string[]> = {
    1: ["once a day, same time each day"],
    2: ["morning", "evening"],
    3: ["morning", "midday", "evening"],
    4: ["morning", "midday", "afternoon", "bedtime"],
  };
  const es: Record<number, string[]> = {
    1: ["una vez al día, a la misma hora cada día"],
    2: ["mañana", "noche"],
    3: ["mañana", "mediodía", "noche"],
    4: ["mañana", "mediodía", "tarde", "al acostarse"],
  };
  const table = lang === "es" ? es : en;
  if (table[t]) return table[t];
  return lang === "es" ? [`${t} veces al día, repartidas de forma pareja`] : [`${t} times a day, spaced evenly`];
}

export function templateRewrite(input: DoseInput, chunks: LabelChunk[], lang: Lang): LlmDoseOutput {
  const c = COPY[lang];
  const units = input.unitsPerDose;
  const times = input.timesPerDay;
  const unitWord = UNIT_WORDS[input.unitLabel][lang][units === 1 ? 0 : 1];
  const route = ROUTE_PHRASE[input.route][lang];

  let plainDose = "";
  if (lang === "es") {
    const verb = input.route === "topical" ? "Aplique" : input.route === "inhaled" ? "Inhale" : "Tome";
    const what = units != null ? `${units} ${unitWord}` : "su dosis";
    const how = route ? ` ${route}` : "";
    const when = times != null ? (input.asNeeded ? `, solo cuando lo necesite, hasta ${times} ${times === 1 ? "vez" : "veces"} al día` : `, ${times} ${times === 1 ? "vez" : "veces"} al día`) : input.asNeeded ? ", solo cuando lo necesite" : "";
    const food = input.withFood === true ? ", con comida" : input.withFood === false ? ", con el estómago vacío" : "";
    plainDose = `${verb} ${what}${how}${when}${food}.`;
  } else {
    const verb = input.route === "topical" ? "Apply" : input.route === "inhaled" ? "Inhale" : "Take";
    const what = units != null ? `${units} ${unitWord}` : "your dose";
    const how = route ? ` ${route}` : "";
    const when = times != null ? (input.asNeeded ? `, only when you need it, up to ${times} time${times === 1 ? "" : "s"} a day` : `, ${times} time${times === 1 ? "" : "s"} a day`) : input.asNeeded ? ", only when you need it" : "";
    const food = input.withFood === true ? ", with food" : input.withFood === false ? ", on an empty stomach" : "";
    plainDose = `${verb} ${what}${how}${when}${food}.`;
  }

  const maxSentence = findMaxPerDaySentence(chunks);
  const maxPerDayLine = maxSentence ? `${c.labelSays} “${maxSentence}”` : "";

  const missed = findMissedDoseSentences(chunks);
  const missedDoseLine = missed.length ? `${c.labelSays} “${missed.join(" ")}”` : "";

  const timing = timingLines(input, lang);
  const labelQuotes = chunks.slice(0, 2).map((ch) => ({ chunkId: ch.chunk_id, text: ch.text }));

  const numbersUsed = [
    ...extractNumbers(plainDose),
    ...extractNumbers(maxPerDayLine),
    ...timing.flatMap((t) => extractNumbers(t)),
    ...extractNumbers(missedDoseLine),
  ].filter((n, i, arr) => arr.indexOf(n) === i);

  return {
    status: "consistent",
    plainDose,
    maxPerDayLine,
    timing,
    missedDoseLine,
    labelQuotes,
    numbersUsed,
    askYourPharmacist: c.ask(input.drugName),
  };
}

/* ------------------------------------------------------------------------------------ */
/* LLM rewrite                                                                           */
/* ------------------------------------------------------------------------------------ */

async function llmRewrite(input: DoseInput, chunks: LabelChunk[], lang: Lang): Promise<LlmDoseOutput> {
  const { chatJson } = await import("@/lib/llm");
  const user = JSON.stringify(
    {
      language: lang === "es" ? "Spanish (numbers, units and drug names unchanged)" : "English",
      directions: input,
      labelChunks: chunks.map((c) => ({ chunkId: c.chunk_id, section: c.section, text: c.text })),
      instructions: [
        "Fill every key of the schema: status, plainDose, maxPerDayLine, timing, missedDoseLine, labelQuotes, numbersUsed, askYourPharmacist.",
        "plainDose restates ONLY the person's directions above (their strength, units per dose, times per day, with food, as needed). Do not change any number.",
        "maxPerDayLine may only quote a per-day maximum sentence that appears verbatim in labelChunks; otherwise use \"\".",
        "missedDoseLine may only quote a missed-dose sentence that appears verbatim in labelChunks; otherwise use \"\".",
        "labelQuotes: each text must be a verbatim substring of the labelChunks entry with that chunkId.",
        "numbersUsed: every number you wrote anywhere in plainDose, maxPerDayLine, timing, missedDoseLine.",
        "status: \"consistent\" if the directions fit the label text, \"inconsistent\" if the label text clearly disagrees, \"unverified\" if you cannot tell.",
        "askYourPharmacist: one question, no digits, no dose suggestion.",
      ],
    },
    null,
    1,
  );
  return chatJson(REWRITE_SYSTEM, user, LlmDoseOutputSchema, { temperature: 0, retries: 1, maxTokens: 900 });
}

/** Keep the LLM's quotes only when they are verbatim substrings of the chunk they cite. */
function verifyQuotes(quotes: LlmDoseOutput["labelQuotes"], chunks: LabelChunk[]): { quotes: LlmDoseOutput["labelQuotes"]; dropped: number } {
  const byId = new Map(chunks.map((c) => [c.chunk_id, c]));
  const kept: LlmDoseOutput["labelQuotes"] = [];
  let dropped = 0;
  for (const q of quotes) {
    const chunk = byId.get(q.chunkId);
    const text = q.text.trim();
    if (chunk && text && chunk.text.includes(text)) kept.push({ chunkId: q.chunkId, text });
    else dropped++;
  }
  return { quotes: kept, dropped };
}

/* ------------------------------------------------------------------------------------ */
/* Plain language                                                                        */
/* ------------------------------------------------------------------------------------ */

/**
 * Swap medical terms for plain phrases in the lines that reach the screen and the speaker
 * ("hypoglycemia" → "low blood sugar"). Runs on the template writer's output BEFORE G3, so
 * every number in the plain text is still checked against the person's directions and the
 * label. The glossary never introduces a number, so G3 keeps passing; the smoke test asserts
 * it. `labelQuotes` stay verbatim (the UI renders them through <PlainText>).
 */
export function plainifyDraft(draft: LlmDoseOutput): LlmDoseOutput {
  return {
    ...draft,
    plainDose: plainifyForSpeech(draft.plainDose),
    maxPerDayLine: plainifyForSpeech(draft.maxPerDayLine),
    missedDoseLine: plainifyForSpeech(draft.missedDoseLine),
    askYourPharmacist: plainifyForSpeech(draft.askYourPharmacist),
  };
}

/* ------------------------------------------------------------------------------------ */
/* Pipeline                                                                              */
/* ------------------------------------------------------------------------------------ */

function baseResult(status: DoseStatus, ceilingChecked: boolean, log: string[], lang: Lang, input: DoseInput, quotes: DoseResult["labelQuotes"], reason?: string): DoseResult {
  return {
    status,
    plainDose: "",
    maxPerDayLine: "",
    timing: [],
    missedDoseLine: "",
    labelQuotes: quotes,
    numbersUsed: [],
    askYourPharmacist: COPY[lang].askNoDigits(stripDigits(input.drugName)),
    reason,
    ceilingChecked,
    guardrailLog: log,
  };
}

export async function explainDose(input: DoseInput, lang: Lang = "en", deps: ExplainDeps = {}): Promise<DoseResult> {
  const log: string[] = [];
  const copy = COPY[lang];
  const finish = (r: DoseResult) => {
    const out = applyFailClosed(r, lang);
    console.info("[dose] guardrails", { status: out.status, log: out.guardrailLog });
    return out;
  };

  const db: Db = deps.db ?? (await (await import("@/lib/db")).getDb());
  const drug = (input.drugName || "").trim();
  let ingredient = drug.toLowerCase();

  // 1. Retrieve official label text.
  let chunks: LabelChunk[] = [];
  if (input.rxcui) {
    if (!deps.db) {
      try {
        const { ensureLabel } = await import("@/lib/openfda");
        await ensureLabel(input.rxcui, ingredient || input.rxcui);
      } catch (e) {
        log.push(`retrieve: openFDA fetch skipped (${(e as Error).message})`);
      }
    }
    chunks = await db.searchLabel(input.rxcui, RAG_SECTIONS, input.userText || drug, 5);
  }
  if (chunks.length === 0) {
    log.push("retrieve: 0 chunks → unverified");
    return finish(baseResult("unverified", false, log, lang, input, [], copy.noLabel));
  }
  log.push(`retrieve: ${chunks.length} chunks (${chunks.map((c) => c.chunk_id).join(", ")})`);
  ingredient = chunks[0].ingredient_name || ingredient;
  const evidence = chunks.slice(0, 2).map((c) => ({ chunkId: c.chunk_id, text: c.text }));

  // 2. Ceiling check (secondary, independent).
  let ceilingChecked = false;
  const { strengthMg, unitsPerDose, timesPerDay } = input;
  const dailyMg = strengthMg != null && unitsPerDose != null && timesPerDay != null ? strengthMg * unitsPerDose * timesPerDay : null;
  const limit = await db.getDoseLimit(ingredient);
  if (dailyMg != null && limit && limit.max_daily_mg != null) {
    ceilingChecked = true;
    if (dailyMg > limit.max_daily_mg) {
      log.push(`ceiling: ${dailyMg} mg/day > ${limit.max_daily_mg} mg/day (${limit.source}) → above_label_max`);
      return finish(baseResult("above_label_max", true, log, lang, input, evidence, FAIL_CLOSED_REASON.above_label_max[lang]));
    }
    log.push(`ceiling ok: ${dailyMg} mg/day ≤ ${limit.max_daily_mg} mg/day (${limit.source})`);
  } else {
    log.push(dailyMg == null ? "ceiling: not checked (directions incomplete)" : "ceiling: not checked (no limit on file — not a pass)");
  }

  if (unitsPerDose == null && timesPerDay == null) {
    log.push("input: no units per dose and no times per day → unverified");
    return finish(baseResult("unverified", ceilingChecked, log, lang, input, evidence, copy.missingFields));
  }

  // 3. Rewrite (LLM when configured, otherwise deterministic template).
  let draft: LlmDoseOutput;
  let writer: "llm" | "template" = "template";
  if (isXaiConfigured()) {
    try {
      draft = await llmRewrite(input, chunks, lang);
      writer = "llm";
      log.push("rewrite: llm");
    } catch (e) {
      log.push(`rewrite: llm failed (${(e as Error).message.slice(0, 80)}) → template`);
      draft = templateRewrite(input, chunks, lang);
    }
  } else {
    draft = templateRewrite(input, chunks, lang);
    log.push("rewrite: template");
  }

  // 4. Guardrails: G1 → G2 → G3.
  const g1 = g1Schema(draft);
  if (!g1.ok || !g1.data) {
    log.push(`G1 FAIL: ${g1.reason}`);
    return finish(baseResult("unverified", ceilingChecked, log, lang, input, evidence, copy.guardrail));
  }
  log.push("G1 ok");
  const out = g1.data;

  if (writer === "llm") {
    const v = verifyQuotes(out.labelQuotes, chunks);
    if (v.dropped) log.push(`quotes: dropped ${v.dropped} non-verbatim quote(s)`);
    out.labelQuotes = v.quotes.length ? v.quotes : evidence;
  } else {
    out.labelQuotes = evidence;
  }

  const g2Text = [out.plainDose, out.maxPerDayLine, ...out.timing, out.missedDoseLine, out.askYourPharmacist].join("\n");
  const g2 = g2NoAdvice(g2Text);
  if (!g2.ok) {
    log.push(`G2 FAIL: ${g2.reason}`);
    return finish(baseResult("unverified", ceilingChecked, log, lang, input, out.labelQuotes, copy.guardrail));
  }
  log.push("G2 ok");

  // Plain language (template path). The LLM is asked for plain phrases in its prompt.
  if (writer === "template") {
    const plain = plainifyDraft(out);
    if (plain.plainDose !== out.plainDose || plain.maxPerDayLine !== out.maxPerDayLine || plain.missedDoseLine !== out.missedDoseLine || plain.askYourPharmacist !== out.askYourPharmacist) {
      log.push("plain: replaced medical terms with plain phrases");
    }
    Object.assign(out, plain);
  }

  // Allowed numbers come from the person's confirmed input and the retrieved official chunks.
  const g3 = g3NumericGrounding(out, input, chunks);
  if (!g3.ok) {
    log.push(`G3 FAIL: ${g3.reason}`);
    return finish(baseResult("unverified", ceilingChecked, log, lang, input, out.labelQuotes, copy.guardrail));
  }
  log.push(`G3 ok: ${g3.reason}`);

  // The writer may itself have judged the directions inconsistent with the label. Keep that.
  if (out.status !== "consistent") {
    log.push(`writer status: ${out.status}`);
    const reason = FAIL_CLOSED_REASON[out.status][lang];
    return finish(baseResult(out.status, ceilingChecked, log, lang, input, out.labelQuotes, reason));
  }

  // 5. Consistent result. Every number here passed G3.
  log.push("G5 ok: consistent");
  return finish({
    status: "consistent",
    plainDose: out.plainDose,
    maxPerDayLine: out.maxPerDayLine,
    timing: out.timing,
    missedDoseLine: out.missedDoseLine,
    labelQuotes: out.labelQuotes,
    numbersUsed: g3.grounded,
    askYourPharmacist: out.askYourPharmacist || copy.ask(input.drugName),
    ceilingChecked,
    guardrailLog: log,
  });
}
