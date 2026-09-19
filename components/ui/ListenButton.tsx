"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, Square, Loader2 } from "lucide-react";
import { useLang } from "@/components/LanguageContext";
import { Button, type ButtonVariant } from "@/components/ui/Button";

type State = "idle" | "loading" | "playing";

// One shared audio element so only one thing plays at a time.
let shared: HTMLAudioElement | null = null;
let stopCurrent: (() => void) | null = null;
function getAudio() {
  if (!shared) shared = new Audio();
  return shared;
}

async function speakViaBrowser(text: string, lang: string, onEnd: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onEnd();
    return () => {};
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === "es" ? "es-MX" : "en-US";
  u.rate = 0.95;
  u.onend = onEnd;
  u.onerror = onEnd;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  return () => {
    window.speechSynthesis.cancel();
    onEnd();
  };
}

export interface ListenButtonProps {
  /** Exact text to read aloud. Only pass validated text. */
  text: string;
  label?: string;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Click-to-listen. POSTs to /api/tts (Grok Voice → ElevenLabs router).
 * Falls back to the browser's speech engine when the server has no voice key (demo mode).
 */
export function ListenButton({ text, label = "Listen", variant = "filled", size = "md", className = "" }: ListenButtonProps) {
  const { lang } = useLang();
  const [state, setState] = useState<State>("idle");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const stop = () => {
    abortRef.current?.abort();
    stopCurrent?.();
    stopCurrent = null;
    setState("idle");
  };

  const play = async () => {
    if (state !== "idle") return stop();
    stopCurrent?.();
    setState("loading");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`tts ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = getAudio();
      audio.src = url;
      const done = () => {
        URL.revokeObjectURL(url);
        setState("idle");
        stopCurrent = null;
      };
      audio.onended = done;
      audio.onerror = done;
      stopCurrent = () => {
        audio.pause();
        audio.currentTime = 0;
        done();
      };
      await audio.play();
      setState("playing");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      // Demo fallback: browser speech synthesis.
      const cancel = await speakViaBrowser(text, lang, () => {
        setState("idle");
        stopCurrent = null;
      });
      stopCurrent = cancel;
      setState("playing");
    }
  };

  const Icon = state === "loading" ? Loader2 : state === "playing" ? Square : Volume2;
  return (
    <Button
      variant={variant}
      size={size}
      onClick={play}
      aria-label={state === "playing" ? `Stop reading: ${label}` : `${label}: read this aloud`}
      aria-pressed={state === "playing"}
      className={className}
    >
      <Icon className={`h-5 w-5 ${state === "loading" ? "animate-spin" : ""}`} aria-hidden="true" />
      <span>{state === "playing" ? "Stop" : state === "loading" ? "Loading…" : label}</span>
    </Button>
  );
}
