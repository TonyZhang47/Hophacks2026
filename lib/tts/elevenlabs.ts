import "server-only";
import { env } from "@/lib/env";

/**
 * ElevenLabs text-to-speech (SECONDARY provider — translation coverage + automatic fallback only).
 *
 * Request shape (from the public ElevenLabs REST reference; not re-fetched during this build):
 *
 *   POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128
 *   xi-api-key: $ELEVENLABS_API_KEY
 *   Content-Type: application/json
 *   { "text": "...", "model_id": "eleven_v3" }
 *   → 200 raw audio bytes, Content-Type: audio/mpeg
 *
 * `eleven_v3` auto-detects the language of the text (70+ languages). If the account cannot use
 * v3 (4xx mentioning the model), we retry once with `eleven_flash_v2_5` (32 languages, ~75 ms).
 *
 * Voice: `ELEVENLABS_VOICE_ID` if set, else "EXAVITQu4vr4xnSDxMaL" — that is the stock
 * multilingual voice "Sarah" from the default ElevenLabs voice library. No voice picker UI.
 */

const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";
const PRIMARY_MODEL = "eleven_v3";
const FALLBACK_MODEL = "eleven_flash_v2_5";
const TIMEOUT_MS = 20_000;

/**
 * Languages eleven_v3 speaks (ISO 639-1 base codes). v3 auto-detects, so `elevenSupports()`
 * treats codes not in this set as allowed; the set exists for logging / 422 decisions on
 * obviously bogus input.
 */
export const ELEVEN_LANGS: Set<string> = new Set([
  "af", "am", "ar", "as", "az", "be", "bg", "bn", "bs", "ca", "ceb", "cs", "cy", "da", "de", "el",
  "en", "es", "et", "eu", "fa", "fi", "fil", "fr", "ga", "gl", "gu", "ha", "he", "hi", "hr", "hu",
  "hy", "id", "is", "it", "ja", "jv", "ka", "kk", "km", "kn", "ko", "ky", "la", "lb", "ln", "lo",
  "lt", "lv", "mk", "ml", "mn", "mr", "ms", "mt", "my", "ne", "nl", "no", "ny", "or", "pa", "pl",
  "ps", "pt", "ro", "ru", "sd", "si", "sk", "sl", "sn", "so", "sq", "sr", "su", "sv", "sw", "ta",
  "te", "tg", "th", "tr", "uk", "ur", "uz", "vi", "xh", "yo", "zh", "zu",
]);

/** Base ISO 639-1 code from a BCP-47 tag ("es-MX" → "es"). */
export function baseLang(lang: string | undefined | null): string {
  return (lang ?? "en").trim().toLowerCase().split(/[-_]/)[0] || "en";
}

/** True unless the tag is malformed. v3 auto-detects, so unknown-but-plausible codes are allowed. */
export function elevenSupports(lang: string | undefined | null): boolean {
  const b = baseLang(lang);
  if (!/^[a-z]{2,3}$/.test(b)) return false;
  return true;
}

export class ElevenTtsError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "ElevenTtsError";
  }
}

async function callEleven(text: string, modelId: string, signal: AbortSignal): Promise<Response> {
  const voiceId = env.elevenVoiceId || DEFAULT_VOICE_ID;
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`;
  return fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": env.elevenKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({ text, model_id: modelId }),
    signal,
    cache: "no-store",
  });
}

/**
 * Call ElevenLabs TTS. Resolves with the raw fetch Response (body = audio/mpeg bytes) on 2xx;
 * throws `ElevenTtsError` on failure or 20 s timeout. `lang` is only used for logging —
 * eleven_v3 detects the language from the text itself. Never logs `text`.
 */
export async function elevenTts(text: string, lang: string): Promise<Response> {
  if (!env.elevenKey) throw new ElevenTtsError("elevenlabs tts: ELEVENLABS_API_KEY not set", 503);
  if (!elevenSupports(lang)) throw new ElevenTtsError(`elevenlabs tts: bad language tag: ${lang}`, 422);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    let res = await callEleven(text, PRIMARY_MODEL, ctrl.signal);
    if (!res.ok && res.status >= 400 && res.status < 500) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      // Model not enabled for this account / plan → try the flash model once.
      if (/model/i.test(detail) || res.status === 400 || res.status === 403) {
        console.info(`[tts] elevenlabs ${res.status} on ${PRIMARY_MODEL}; retrying with ${FALLBACK_MODEL}`);
        res = await callEleven(text, FALLBACK_MODEL, ctrl.signal);
      } else {
        throw new ElevenTtsError(`elevenlabs tts ${res.status}: ${detail}`, res.status);
      }
    }
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 160);
      throw new ElevenTtsError(`elevenlabs tts ${res.status}: ${detail}`, res.status);
    }
    if (!res.body) throw new ElevenTtsError("elevenlabs tts: empty body");
    return res;
  } catch (e) {
    if (e instanceof ElevenTtsError) throw e;
    const name = (e as Error)?.name;
    throw new ElevenTtsError(
      name === "AbortError" ? "elevenlabs tts: timeout after 20s" : `elevenlabs tts: ${(e as Error)?.message ?? "fetch failed"}`,
    );
  } finally {
    clearTimeout(timer);
  }
}
