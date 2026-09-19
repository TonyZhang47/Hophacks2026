import "server-only";
import { env, isXaiConfigured } from "@/lib/env";
import { LlmError } from "@/lib/llm";

/**
 * Grok image understanding (OpenAI-compatible chat/completions with image_url content).
 * Used to read the directions off a bottle photo. Returns TEXT ONLY — the dose pipeline's
 * confirmation step + guardrails still run on whatever comes back.
 */
export const VISION_MODEL = process.env.XAI_VISION_MODEL ?? "grok-4.20-0309-non-reasoning";

export async function readImageText(dataUrl: string, prompt: string): Promise<string> {
  if (!isXaiConfigured()) throw new LlmError("XAI_API_KEY not set");
  if (!/^data:image\/(png|jpe?g|webp);base64,/.test(dataUrl)) throw new LlmError("unsupported image");
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.xaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: VISION_MODEL,
      temperature: 0,
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new LlmError(`xAI vision ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return (data.choices?.[0]?.message?.content ?? "").trim();
}
