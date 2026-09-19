import "server-only";
import { env } from "@/lib/env";

/**
 * xAI Grok Voice text-to-speech (PRIMARY provider).
 *
 * Request shape VERIFIED against https://docs.x.ai/developers/model-capabilities/audio/text-to-speech
 * (fetched 2026-09-19):
 *
 *   POST https://api.x.ai/v1/tts
 *   Authorization: Bearer $XAI_API_KEY
 *   Content-Type: application/json
 *   {
 *     "text": "...",                       // required, max 60,000 chars
 *     "language": "en" | "es-MX" | "auto", // required, BCP-47 from the list below or "auto"
 *     "voice_id": "eve",                   // optional, default "eve" (NOT "voice")
 *     "output_format": { "codec": "mp3", "sample_rate": 24000, "bit_rate": 128000 },
 *     "speed": 1.0,                        // 0.7–1.5
 *     "optimize_streaming_latency": 0      // 0 | 1 | 2
 *   }
 *   → 200 raw audio bytes, Content-Type: audio/mpeg (unless with_timestamps=true → JSON envelope)
 *
 * Supported `language` values (20 + auto): en, ar-EG, ar-SA, ar-AE, bn, zh, fr, de, hi, id,
 * it, ja, ko, pt-BR, pt-PT, ru, es-MX, es-ES, tr, vi.
 */

const GROK_TTS_URL = "https://api.x.ai/v1/tts";
const TIMEOUT_MS = 45_000;

/** Languages Grok Voice TTS can speak, as BCP-47 tags the API accepts. */
export const GROK_TTS_LANGS: Set<string> = new Set([
  "en",
  "fr",
  "de",
  "it",
  "es-MX",
  "es-ES",
  "pt-BR",
  "pt-PT",
  "ar-EG",
  "ar-SA",
  "ar-AE",
  "bn",
  "zh",
  "hi",
  "id",
  "ja",
  "ko",
  "ru",
  "tr",
  "vi",
]);

/** Map the app's short language codes (LanguageContext uses "en" | "es") onto Grok's tags. */
const GROK_LANG_ALIASES: Record<string, string> = {
  en: "en",
  "en-us": "en",
  "en-gb": "en",
  es: "es-MX",
  "es-us": "es-MX",
  "es-419": "es-MX",
  pt: "pt-BR",
  ar: "ar-EG",
  "zh-cn": "zh",
  "zh-hans": "zh",
};

/**
 * Normalise an incoming language code to the exact tag Grok expects.
 * Returns `null` when Grok cannot speak that language.
 */
export function toGrokLang(lang: string | undefined | null): string | null {
  const raw = (lang ?? "en").trim();
  if (!raw) return "en";
  const alias = GROK_LANG_ALIASES[raw.toLowerCase()];
  if (alias) return alias;
  // Exact match against the set, case-insensitively (e.g. "es-mx" → "es-MX").
  for (const tag of GROK_TTS_LANGS) if (tag.toLowerCase() === raw.toLowerCase()) return tag;
  return null;
}

export class GrokTtsError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "GrokTtsError";
  }
}

/**
 * Call Grok Voice TTS. Resolves with the raw fetch Response (body = audio/mpeg bytes)
 * on 2xx; throws `GrokTtsError` on non-2xx, network failure, or 20 s timeout.
 * Never logs `text`.
 */
export async function grokTts(text: string, lang: string): Promise<Response> {
  const language = toGrokLang(lang);
  if (!language) throw new GrokTtsError(`grok tts: language not supported: ${lang}`, 422);
  if (!env.xaiKey) throw new GrokTtsError("grok tts: XAI_API_KEY not set", 503);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GROK_TTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.xaiKey}`,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        language,
        voice_id: "eve",
        output_format: { codec: "mp3", sample_rate: 24000, bit_rate: 128000 },
        speed: 0.95,
        optimize_streaming_latency: 1,
      }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      // Drain a short slice of the body for the log; it contains no user text.
      const detail = (await res.text().catch(() => "")).slice(0, 160);
      throw new GrokTtsError(`grok tts ${res.status}: ${detail}`, res.status);
    }
    if (!res.body) throw new GrokTtsError("grok tts: empty body");
    return res;
  } catch (e) {
    if (e instanceof GrokTtsError) throw e;
    const name = (e as Error)?.name;
    throw new GrokTtsError(name === "AbortError" ? "grok tts: timeout after 45s" : `grok tts: ${(e as Error)?.message ?? "fetch failed"}`);
  } finally {
    // The timer must outlive the header phase only; the body stream is consumed by the caller.
    clearTimeout(timer);
  }
}
