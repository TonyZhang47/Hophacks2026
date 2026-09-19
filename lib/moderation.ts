import "server-only";
import { z } from "zod";
import { chatJson, isXaiConfigured, LlmError } from "@/lib/llm";

/**
 * Community moderation, run BEFORE a post is stored.
 * Layer 1: deterministic regex (always runs, always wins when it rejects).
 * Layer 2: Grok classifier when a key is present; on any LLM error we keep the regex verdict.
 * Reasons are plain sentences shown to the person in the form.
 */
export type ModerationVerdict = { ok: true } | { ok: false; reason: string };

export const REASON_DOSE = "Please don't tell others to change a dose — that's for their pharmacist.";
export const REASON_CONTACT = "Please don't share phone numbers or emails.";
export const REASON_LINK = "Please don't share links.";
export const REASON_PERSONAL = "Please don't share personal details about yourself or other people.";
export const REASON_HARASS = "Please keep it kind — no insults or harassment.";

// Telling someone else to change how much they take. Word boundaries keep "double-check" and "skipping breakfast"
// from tripping the filter while "just double it" / "skip a dose" do.
const DOSE_PATTERNS: RegExp[] = [
  /\b(just\s+)?(double|triple|halve|half)\s+(it|the\s+dose|your\s+dose|the\s+pill|your\s+pill|them|the\s+tablets?|your\s+tablets?)\b/i,
  /\bdouble\s+up\b/i,
  /\btake\s+(more|less|extra|two|three|four|another|a\s+second)\b/i,
  /\b(skip|skipping)\s+(a|the|your|one|some|tonight'?s|today'?s)?\s*(dose|pill|tablet|med|medicine|meds)s?\b/i,
  /\bstop\s+taking\b/i,
  /\b(increase|decrease|raise|lower|up|bump\s+up|cut)\s+(the|your|that)?\s*(dose|dosage|amount|mg|milligrams)\b/i,
  /\binstead\s+of\s+(the|your|what)\s+(dose|label|pharmacist|doctor|prescription)\b/i,
  /\byou\s+should\s+take\b/i,
  /\bjust\s+take\s+\d+\b/i,
  /\b\d+\s*(mg|milligrams?|tablets?|pills?)\s+(is|should\s+be)\s+(fine|safe|ok|okay|enough)\b/i,
];
const PHONE_RE = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/;
const PHONE_PAREN_RE = /\(\d{3}\)\s*\d{3}[-.\s]?\d{4}/;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const URL_RE = /\b(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|net|org|io|gov|edu|co|us|me)\b(\/\S*)?/i;
// Addresses and full self-identification are a weak signal; only the obvious forms are caught here.
const ADDRESS_RE = /\b\d{1,5}\s+[A-Za-z0-9.'\s]{2,30}\b(street|st|avenue|ave|road|rd|lane|ln|drive|dr|court|ct|blvd|boulevard|highway|hwy)\b\.?/i;
const SELF_ID_RE = /\bmy\s+(full\s+)?name\s+is\s+[A-Z][a-z]+\s+[A-Z][a-z]+/;
const SLURS_OR_HARASS_RE = /\b(kill\s+yourself|kys|you'?re\s+(an?\s+)?(idiot|moron|stupid|retard\w*))\b/i;

/** Deterministic layer. Exported so it can be unit-checked without a network. */
export function regexModerate(body: string): ModerationVerdict {
  const text = body.normalize("NFKC");
  if (PHONE_RE.test(text) || PHONE_PAREN_RE.test(text) || EMAIL_RE.test(text)) return { ok: false, reason: REASON_CONTACT };
  if (URL_RE.test(text)) return { ok: false, reason: REASON_LINK };
  for (const re of DOSE_PATTERNS) if (re.test(text)) return { ok: false, reason: REASON_DOSE };
  if (ADDRESS_RE.test(text) || SELF_ID_RE.test(text)) return { ok: false, reason: REASON_PERSONAL };
  if (SLURS_OR_HARASS_RE.test(text)) return { ok: false, reason: REASON_HARASS };
  return { ok: true };
}

const ClassifierSchema = z.object({
  allowed: z.boolean(),
  reason: z.string().max(300).default(""),
});

const SYSTEM = `You moderate short anonymous posts on a public board where people share their own experience with a medicine's side effects. This is NOT medical advice and posts must not become advice.

Reply with JSON only: {"allowed": boolean, "reason": string}.

Set allowed=false when the post:
1. tells another person to change, skip, double, stop, or start a dose or medicine, or states a specific amount someone else should take;
2. contains contact information (phone number, email, street address, social handle, link);
3. names or identifies a real private person (full name, workplace plus role, etc.) — the writer or anyone else;
4. harasses, insults, or threatens anyone, or contains slurs;
5. is spam, advertising, or a request to buy or sell medicines.

Otherwise set allowed=true. Describing one's own experience ("nausea for two weeks", "I bruise easily", "I take it with food and it helps") is allowed even when it mentions a dose the writer takes themselves.

When rejecting, "reason" is ONE short, kind, plain-English sentence addressed to the writer explaining what to remove. Never quote the post back.`;

/** Full pipeline: regex first, then the Grok classifier if configured. */
export async function moderatePost(body: string): Promise<ModerationVerdict> {
  const regexVerdict = regexModerate(body);
  if (!regexVerdict.ok) return regexVerdict;
  if (!isXaiConfigured()) return regexVerdict;
  try {
    const out = await chatJson(SYSTEM, `Post:\n"""${body.slice(0, 600)}"""`, ClassifierSchema, {
      temperature: 0,
      maxTokens: 200,
      retries: 1,
    });
    if (out.allowed) return { ok: true };
    return { ok: false, reason: out.reason.trim() || "Please keep posts to your own experience, with no personal details." };
  } catch (e) {
    if (e instanceof LlmError) return regexVerdict;
    // Any other failure (network, abort) also falls through to the deterministic verdict.
    return regexVerdict;
  }
}
