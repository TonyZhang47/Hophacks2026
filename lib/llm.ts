import "server-only";
import type { ZodType } from "zod";
import { env, isXaiConfigured } from "@/lib/env";

/**
 * xAI Grok chat wrapper with strict JSON output.
 * Callers MUST provide a template fallback for demo mode (no key) — see `isXaiConfigured()`.
 */
export interface ChatJsonOptions {
  temperature?: number;
  maxTokens?: number;
  /** Retries on schema failure. */
  retries?: number;
}

export class LlmError extends Error {}

export async function chatJson<T>(system: string, user: string, schema: ZodType<T>, opts: ChatJsonOptions = {}): Promise<T> {
  if (!isXaiConfigured()) throw new LlmError("XAI_API_KEY not set");
  const retries = opts.retries ?? 1;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.xaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.xaiChatModel,
        temperature: opts.temperature ?? 0,
        max_tokens: opts.maxTokens ?? 1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: attempt === 0 ? user : `${user}\n\nYour previous answer did not match the JSON schema. Output ONLY valid JSON matching the schema.` },
        ],
      }),
    });
    if (!res.ok) throw new LlmError(`xAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? "";
    try {
      const parsed = JSON.parse(stripFences(content));
      const ok = schema.safeParse(parsed);
      if (ok.success) return ok.data;
      lastErr = ok.error;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new LlmError(`LLM output failed schema after retries: ${String(lastErr).slice(0, 200)}`);
}

export async function chatText(system: string, user: string, opts: ChatJsonOptions = {}): Promise<string> {
  if (!isXaiConfigured()) throw new LlmError("XAI_API_KEY not set");
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.xaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.xaiChatModel,
      temperature: opts.temperature ?? 0,
      max_tokens: opts.maxTokens ?? 800,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new LlmError(`xAI ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

function stripFences(s: string) {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
}

export { isXaiConfigured };
