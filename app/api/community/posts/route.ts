import type { NextRequest } from "next/server";
import { z } from "zod";
import { error, json } from "@/lib/http";
import { createPost, HANDLE_RE, listPosts, POST_MAX_CHARS, PostRejectedError } from "@/lib/community";
import { SIDE_EFFECT_TAGS } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  rxcui: z.string().trim().regex(/^\d{1,12}$/).optional(),
  term: z.string().trim().min(1).max(40).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).max(10_000).optional(),
});

/** GET /api/community/posts?rxcui=&term=&limit=&offset= → { posts: CommunityPost[] } (approved only, newest first) */
export async function GET(req: NextRequest) {
  const raw: Record<string, string> = {};
  for (const [k, v] of new URL(req.url).searchParams) if (v !== "") raw[k] = v;
  const parsed = Query.safeParse(raw);
  if (!parsed.success) return error("Bad request", 400);
  const posts = await listPosts(parsed.data);
  return json({ posts });
}

const Body = z.object({
  rxcui: z.string().trim().regex(/^\d{1,12}$/).optional(),
  drugName: z.string().trim().min(1, "Pick a medicine.").max(80),
  body: z.string().trim().min(10, "Say a little more — at least 10 characters.").max(POST_MAX_CHARS, `Keep it under ${POST_MAX_CHARS} characters.`),
  tags: z.array(z.enum(SIDE_EFFECT_TAGS)).max(SIDE_EFFECT_TAGS.length).default([]),
  anonHandle: z.string().trim().regex(HANDLE_RE, "Handle must look like quiet-otter.").max(40),
});

/**
 * POST /api/community/posts { rxcui?, drugName, body, tags, anonHandle }
 * → 201 { post } when approved; 422 { error } with a plain reason when moderation rejects it.
 */
export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return error("Send JSON.", 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? "Bad request", 400);
  try {
    const post = await createPost(parsed.data);
    return json({ post }, { status: 201 });
  } catch (e) {
    if (e instanceof PostRejectedError) return error(e.reason, 422);
    console.error("[community/posts] create failed", e);
    return error("We couldn't save that right now. Please try again.", 500);
  }
}
