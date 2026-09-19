import { z } from "zod";
import { error } from "@/lib/http";
import { LanguageNotAvailable, NoVoiceProvider, synthesize } from "@/lib/tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/tts  { text: string (1–4000 chars), lang?: string }
 *   200 audio/mpeg (streamed; Cache-Control: no-store)
 *   503 { error: "no-voice-provider" }        → client falls back to browser speech
 *   422 { error: "language-not-available" }   → neither provider speaks this language
 *   502 { error: "tts-failed" }               → provider error after fallback
 * Never logs the text.
 */
const Body = z.object({
  text: z.string().trim().min(1).max(4000),
  lang: z.string().trim().min(2).max(12).optional().default("en"),
});

export async function POST(req: Request) {
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return error("invalid-body", 400, { hint: "Send { text: string (1-4000 chars), lang?: string }" });
  }
  const { text, lang } = parsed;

  try {
    const out = await synthesize(text, lang);
    return new Response(out.body, {
      status: 200,
      headers: {
        "Content-Type": out.contentType || "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Tts-Provider": out.provider,
        "X-Tts-Cache": out.cached ? "hit" : "miss",
      },
    });
  } catch (e) {
    if (e instanceof NoVoiceProvider) {
      return error("no-voice-provider", 503, { hint: "Configure Grok for English or ElevenLabs for Spanish." });
    }
    if (e instanceof LanguageNotAvailable) {
      return error("language-not-available", 422, { hint: "This language is not available yet.", lang });
    }
    console.error(`[tts] failed: ${(e as Error).message}`);
    return error("tts-failed", 502);
  }
}
