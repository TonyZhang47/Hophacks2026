import { env, isElevenConfigured, isXaiConfigured } from "@/lib/env";
import { error, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/stt  multipart/form-data { file: <audio>, lang?: string }
 *   200 { text, provider: "grok" | "elevenlabs", language? }
 *   503 { error: "no-voice-provider" }
 *
 * Primary — xAI Grok STT. Shape VERIFIED against
 * https://docs.x.ai/developers/model-capabilities/audio/speech-to-text (fetched 2026-09-19):
 *   POST https://api.x.ai/v1/stt   (multipart/form-data)
 *   Authorization: Bearer $XAI_API_KEY
 *   -F model=grok-voice-transcribe-2.0  -F format=true  -F language=en  -F file=@audio.mp3   (file LAST)
 *   → { "text": "...", "language": "en", "duration": 3.45, "words": [...] }
 *
 * Fallback — ElevenLabs Scribe (public REST reference; not re-fetched during this build):
 *   POST https://api.elevenlabs.io/v1/speech-to-text   (multipart/form-data)
 *   xi-api-key: $ELEVENLABS_API_KEY
 *   -F model_id=scribe_v2  -F file=@audio.mp3
 *   → { "text": "...", "language_code": "en", ... }
 */
const MAX_BYTES = 25 * 1024 * 1024;
const TIMEOUT_MS = 60_000;

async function grokStt(file: File, lang: string | undefined, signal: AbortSignal) {
  const fd = new FormData();
  fd.append("model", "grok-voice-transcribe-2.0");
  fd.append("format", "true");
  if (lang) fd.append("language", lang.split(/[-_]/)[0]);
  fd.append("file", file, file.name || "audio.webm"); // must be the last field
  const res = await fetch("https://api.x.ai/v1/stt", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.xaiKey}` },
    body: fd,
    signal,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`grok stt ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`);
  const data = (await res.json()) as { text?: string; language?: string };
  return { text: (data.text ?? "").trim(), language: data.language };
}

async function elevenStt(file: File, lang: string | undefined, signal: AbortSignal) {
  const fd = new FormData();
  fd.append("model_id", "scribe_v2");
  if (lang) fd.append("language_code", lang.split(/[-_]/)[0]);
  fd.append("file", file, file.name || "audio.webm");
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": env.elevenKey },
    body: fd,
    signal,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`elevenlabs stt ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`);
  const data = (await res.json()) as { text?: string; language_code?: string };
  return { text: (data.text ?? "").trim(), language: data.language_code };
}

export async function POST(req: Request) {
  if (!isXaiConfigured() && !isElevenConfigured()) {
    return error("no-voice-provider", 503, { hint: "Set XAI_API_KEY (primary) or ELEVENLABS_API_KEY (secondary)" });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return error("invalid-body", 400, { hint: "Send multipart/form-data with a `file` field" });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return error("missing-file", 400);
  if (file.size > MAX_BYTES) return error("file-too-large", 413, { maxBytes: MAX_BYTES });
  const langRaw = form.get("lang");
  const lang = typeof langRaw === "string" && langRaw.trim() ? langRaw.trim() : undefined;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    if (isXaiConfigured()) {
      try {
        const r = await grokStt(file, lang, ctrl.signal);
        console.info(`[stt] provider=grok bytes=${file.size}`);
        return json({ text: r.text, provider: "grok", language: r.language });
      } catch (e) {
        console.warn(`[stt] grok failed (${(e as Error).message}); ${isElevenConfigured() ? "falling back to elevenlabs" : "no fallback"}`);
        if (!isElevenConfigured()) throw e;
      }
    }
    const r = await elevenStt(file, lang, ctrl.signal);
    console.info(`[stt] provider=elevenlabs bytes=${file.size}`);
    return json({ text: r.text, provider: "elevenlabs", language: r.language });
  } catch (e) {
    console.error(`[stt] failed: ${(e as Error).message}`);
    return error("stt-failed", 502);
  } finally {
    clearTimeout(timer);
  }
}
