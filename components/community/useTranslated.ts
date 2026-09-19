"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Client hook: batch-translates dynamic English text (post bodies, label excerpts, AI
 * summaries) to Spanish through POST /api/translate, with a module-level cache mirrored to
 * sessionStorage so navigating back is instant.
 *
 *   const { get, pending } = useTranslated([post.body, official], lang === "es");
 *   get(post.body)  // → Spanish string, or undefined when not (yet) translated
 *
 * Items the API could not translate (perItem "none", e.g. no Grok key) stay untranslated so
 * callers fall back to the original. Never throws; network errors just leave gaps.
 */

const STORAGE_KEY = "rxplain.tr.es";
const MAX_BATCH = 40;
/** /api/translate rejects items over 4000 chars; longer text (e.g. a full label) stays English. */
const MAX_LEN = 4000;
/** Keep the sessionStorage mirror well under browser quotas. */
const STORAGE_LIMIT = 400_000;

type ApiResponse = {
  translated?: unknown;
  perItem?: unknown;
  provider?: unknown;
};

const cache = new Map<string, string>();
/** Strings with a request in flight anywhere on the page, so parallel hooks don't double-post. */
const inflight = new Set<string>();
let hydrated = false;

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw) as unknown;
    if (!obj || typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (
        typeof k === "string" &&
        typeof v === "string" &&
        k &&
        v &&
        !cache.has(k)
      ) {
        cache.set(k, v);
      }
    }
  } catch {
    /* private mode / quota / bad JSON: in-memory cache still works */
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    const obj: Record<string, string> = {};
    for (const [k, v] of cache) obj[k] = v;
    let json = JSON.stringify(obj);
    if (json.length > STORAGE_LIMIT) {
      // Drop the oldest entries (Map preserves insertion order) until it fits.
      const entries = [...cache];
      while (json.length > STORAGE_LIMIT && entries.length) {
        entries.shift();
        json = JSON.stringify(Object.fromEntries(entries));
      }
    }
    window.sessionStorage.setItem(STORAGE_KEY, json);
  } catch {
    /* ignore */
  }
}

async function fetchBatch(
  batch: string[],
  signal: AbortSignal,
): Promise<boolean> {
  let changed = false;
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strings: batch, target: "es", protect: true }),
      signal,
    });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => ({}))) as ApiResponse;
    const translated = Array.isArray(data.translated) ? data.translated : [];
    const perItem = Array.isArray(data.perItem) ? data.perItem : [];
    batch.forEach((src, i) => {
      const out = translated[i];
      if (perItem[i] !== "grok") return;
      if (typeof out !== "string" || !out.trim()) return;
      cache.set(src, out);
      changed = true;
    });
    if (changed) persist();
  } catch {
    /* aborted or network error: leave entries untranslated */
  } finally {
    for (const s of batch) inflight.delete(s);
  }
  return changed;
}

export function useTranslated(
  strings: string[],
  enabled: boolean,
): { get: (s: string) => string | undefined; pending: boolean } {
  // Bumped whenever the cache gains entries this hook cares about, to re-render callers.
  const [version, setVersion] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const controllers = useRef(new Set<AbortController>());
  const mounted = useRef(true);
  const key = enabled ? strings.join("\u0001") : "";

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const c of controllers.current) c.abort();
      controllers.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const wasHydrated = hydrated;
    hydrate();
    if (!wasHydrated && cache.size) setVersion((v) => v + 1);

    const missing = [
      ...new Set(
        strings.filter(
          (s) =>
            typeof s === "string" &&
            s.trim() &&
            s.length <= MAX_LEN &&
            !cache.has(s) &&
            !inflight.has(s),
        ),
      ),
    ];
    if (!missing.length) return;
    for (const s of missing) inflight.add(s);

    const controller = new AbortController();
    controllers.current.add(controller);
    setPendingCount((n) => n + 1);

    const batches: string[][] = [];
    for (let i = 0; i < missing.length; i += MAX_BATCH)
      batches.push(missing.slice(i, i + MAX_BATCH));

    void Promise.all(batches.map((b) => fetchBatch(b, controller.signal)))
      .then((results) => {
        if (!mounted.current) return;
        if (results.some(Boolean)) setVersion((v) => v + 1);
      })
      .finally(() => {
        controllers.current.delete(controller);
        if (mounted.current) setPendingCount((n) => Math.max(0, n - 1));
      });
    // `key` stands in for `strings` (a fresh array each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  const get = useCallback(
    (s: string): string | undefined => {
      if (!enabled || !s) return undefined;
      return cache.get(s);
    },
    // `version` is intentionally a dependency so callers re-read the cache after a fetch lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, version],
  );

  return { get, pending: pendingCount > 0 };
}
