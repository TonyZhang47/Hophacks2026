import "server-only";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { TtlCache } from "@/lib/http";
import { moderatePost } from "@/lib/moderation";
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

const officialCache = new TtlCache<string | null>(6 * 60 * 60 * 1000);

/** First adverse_reactions chunk from openFDA (seeded or live), trimmed to 500 chars. Null when unavailable. */
export async function officialAdverseReactions(rxcui: string, ingredient: string): Promise<string | null> {
  const key = `official:${rxcui}`;
  const hit = officialCache.get(key);
  if (hit !== undefined) return hit;
  let out: string | null = null;
  try {
    const chunks = await getSections(rxcui, ingredient, ["adverse_reactions"]);
    const first = chunks.find((c) => c.text.trim().length > 0);
    if (first) {
      const text = first.text.replace(/^\s*\d+\s+ADVERSE REACTIONS\s*/i, "").replace(/\s+/g, " ").trim();
      out = text.length > 500 ? `${text.slice(0, 497).replace(/\s+\S*$/, "")}…` : text;
    }
  } catch {
    out = null;
  }
  officialCache.set(key, out);
  return out;
}
