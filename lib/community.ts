import "server-only";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { TtlCache } from "@/lib/http";
import { chatText, isXaiConfigured } from "@/lib/llm";
import { moderatePost } from "@/lib/moderation";
import { cleanOfficialLabel, joinAdverseChunks, toOfficialLabel, type OfficialLabel } from "@/lib/communityLabel";
import { getSections } from "@/lib/openfda";
import { SIDE_EFFECT_TAGS, type CommunityPost, type SideEffectTag, type TopTerm } from "@/lib/types";

/**
 * Medication talk (Feature 9). Posts are experiences, never evidence: nothing here feeds
 * severity or dose output. Every insert goes through moderatePost first; rejected posts are
 * stored with moderation_status "rejected" so the board never shows them but we keep a record.
 */
export const POST_MAX_CHARS = 500;
export const HANDLE_RE = /^[a-z]+-[a-z]+$/;

export class PostRejectedError extends Error {
  readonly status = 422;
  constructor(public readonly reason: string) {
    super(reason);
    this.name = "PostRejectedError";
  }
}

export interface ListPostsInput {
  name?: string;
  rxcui?: string;
  term?: string;
  limit?: number;
  offset?: number;
}

export async function listPosts(input: ListPostsInput = {}): Promise<CommunityPost[]> {
  const db = await getDb();
  return db.listPosts({
    name: input.name?.trim().toLowerCase() || undefined,
    rxcui: input.rxcui?.trim() || undefined,
    term: input.term?.trim().toLowerCase().slice(0, 40) || undefined,
    limit: Math.min(Math.max(input.limit ?? 20, 1), 50),
    offset: Math.max(input.offset ?? 0, 0),
  });
}

export interface CreatePostInput {
  rxcui?: string;
  drugName: string;
  body: string;
  tags: string[];
  anonHandle: string;
}

export async function createPost(input: CreatePostInput): Promise<CommunityPost> {
  const body = input.body.replace(/\s+/g, " ").trim().slice(0, POST_MAX_CHARS);
  const tags = [...new Set(input.tags)].filter((t): t is SideEffectTag => (SIDE_EFFECT_TAGS as readonly string[]).includes(t));
  const anon = HANDLE_RE.test(input.anonHandle) ? input.anonHandle : "quiet-visitor";
  const verdict = await moderatePost(body);
  const post: CommunityPost = {
    post_id: randomUUID(),
    rxcui: input.rxcui?.trim() || undefined,
    drug_name: input.drugName.trim().toLowerCase().slice(0, 80),
    body,
    side_effect_tags: tags,
    moderation_status: verdict.ok ? "approved" : "rejected",
    created_at: new Date().toISOString(),
    anon_handle: anon,
  };
  const db = await getDb();
  await db.createPost(post);
  if (!verdict.ok) throw new PostRejectedError(verdict.reason);
  termsGeneration++; // new approved post → top terms recount on the next request
  return post;
}

// ---- top terms (60 s cache) ---------------------------------------------------------------------

const termsCache = new TtlCache<TopTerm[]>(60_000);
let termsGeneration = 0;
const cacheKey = (rxcui?: string) => `terms:${termsGeneration}:${rxcui ?? "*"}`;

export async function topTerms(rxcui?: string, limit = 15, name?: string): Promise<TopTerm[]> {
  const key = cacheKey(rxcui) + ":" + (name?.trim().toLowerCase() || "");
  const hit = termsCache.get(key);
  if (hit) return hit.slice(0, limit);
  const db = await getDb();
  const terms = await db.topTerms(rxcui?.trim() || undefined, Math.max(limit, 15), name);
  termsCache.set(key, terms);
  return terms.slice(0, limit);
}

// ---- official adverse reactions ("From the label") ----------------------------------------------

const officialCache = new TtlCache<OfficialLabel | null>(6 * 60 * 60 * 1000);

export type { OfficialLabel };

/** Full adverse_reactions section from openFDA, copy-edited then cached by rxcui. */
export async function officialAdverseReactions(rxcui: string, ingredient: string): Promise<OfficialLabel | null> {
  const key = `official:${rxcui}`;
  const hit = officialCache.get(key);
  if (hit !== undefined) return hit;
  let out: OfficialLabel | null = null;
  try {
    const chunks = await getSections(rxcui, ingredient, ["adverse_reactions"]);
    const joined = joinAdverseChunks(chunks.map((c) => c.text));
    if (joined) {
      out = toOfficialLabel(await cleanOfficialLabel(joined));
    }
  } catch {
    out = null;
  }
  officialCache.set(key, out);
  return out;
}

const summaryCache = new TtlCache<string>(6 * 60 * 60 * 1000);

const SUMMARIZE_SYSTEM = `You summarize FDA adverse-reactions label text for a reader with no medical training.
Write in the requested language using clear, everyday words and a respectful, formal tone. Be easy to understand without sounding casual, childish, or overly technical.
Write 4 to 8 short sentences, with one main idea per sentence. Keep each sentence to at most 25 words and list no more than 4 effects in a sentence. Split longer lists across sentences. Use fewer sentences only if there is too little information to summarize without repetition; do not add filler.
Use plain descriptions instead of medical jargon, abbreviations, or clinical phrasing. For example, say "side effects" instead of "adverse reactions" and "sleepiness" instead of "somnolence". If a medical term is essential, explain it immediately in everyday words.
For English, aim for a sixth-grade reading level while keeping a professional tone. Avoid slang, idioms, and long or complicated sentences. Prefer standard words such as "stomach" and "intestines" over casual words such as "belly" and "gut" when referring to those body parts.
For Spanish, use natural, neutral Latin American Spanish with the same simple, formal style. Say "efectos secundarios" instead of "reacciones adversas", "sueño" instead of "somnolencia", and "acumulación de líquido" instead of "retención de líquidos". Avoid literal translations of English phrasing, regional slang, and unexplained medical terms. If addressing the reader directly, use "usted", not "tú".
Only use facts that appear in the label text. Do not invent side effects, frequencies, or advice.
Do not infer causes, timing (such as "after eating"), additional symptoms, or severity details that the source does not state.
Preserve the meaning of any numbers, how often effects occur, how serious they are, and any uncertainty. Do not make serious effects sound mild or imply that a reported effect is a proven result of the medicine.
The wording examples above are style guidance only; include an effect only if it appears in the supplied label.
Do not tell the reader to change their dose or stop a medicine.
Only mention other parts of the label when the supplied text explicitly refers to them. If the text is mostly cross-references, describe the listed effects in everyday words and say the full details are in other parts of the label. Do not guess the missing details.
Output only the summary as a short paragraph. No preamble, bullets, or markdown headings.`;

export class SummarizeError extends Error {
  constructor(
    message: string,
    public readonly code: "unavailable" | "nolabel" | "failed",
  ) {
    super(message);
    this.name = "SummarizeError";
  }
}

/** Opt-in Grok summary of the cleaned official label. Cached by rxcui + language. */
export async function summarizeOfficialLabel(
  rxcui: string,
  ingredient: string,
  lang: "en" | "es",
): Promise<string> {
  const key = `summary:${lang}:${rxcui}`;
  const hit = summaryCache.get(key);
  if (hit) return hit;
  if (!isXaiConfigured()) throw new SummarizeError("AI summarizer is not configured.", "unavailable");
  const label = await officialAdverseReactions(rxcui, ingredient);
  const source = label?.full?.trim();
  if (!source) throw new SummarizeError("No label text on file for this medicine yet.", "nolabel");
  try {
    const summary = (
      await chatText(
        SUMMARIZE_SYSTEM,
        `Language: ${lang === "es" ? "Spanish" : "English"}\n\nLabel:\n${source.slice(0, 8000)}`,
        { temperature: 0, maxTokens: 800 },
      )
    )
      .replace(/\s+/g, " ")
      .trim();
    if (!summary) throw new SummarizeError("The summarizer returned nothing.", "failed");
    summaryCache.set(key, summary);
    return summary;
  } catch (e) {
    if (e instanceof SummarizeError) throw e;
    throw new SummarizeError("We couldn't summarize that right now.", "failed");
  }
}
