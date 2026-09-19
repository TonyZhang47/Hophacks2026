"use client";
import { useEffect, useRef, useState } from "react";
import { Volume2, Square, Loader2 } from "lucide-react";
import { useLang } from "@/components/LanguageContext";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { plainifyForSpeech } from "@/lib/glossary";
import { speechChunks } from "@/lib/speechChunks";
let stopCurrent: (() => void) | null = null;
export interface ListenButtonProps {
  text: string;
  getText?: () => string;
  label?: string;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  className?: string;
  iconOnly?: boolean;
  plain?: boolean;
}
export function ListenButton({
  text,
  getText,
  label = "Listen",
  variant = "filled",
  size = "md",
  className = "",
  iconOnly,
  plain = true,
}: ListenButtonProps) {
  const { lang } = useLang();
  const es = lang === "es";
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const [error, setError] = useState("");
  const ownStop = useRef<(() => void) | null>(null);
  useEffect(() => () => ownStop.current?.(), [lang]);
  async function play() {
    if (state !== "idle") {
      ownStop.current?.();
      return;
    }
    const raw = (getText ? getText() : text) || "";
    const spoken = plain && lang === "en" ? plainifyForSpeech(raw) : raw;
    if (!spoken.trim()) return;
    stopCurrent?.();
    setError("");
    setState("loading");
    const ctrl = new AbortController();
    let audio: HTMLAudioElement | null = null;
    let url = "";
    let finish: (() => void) | null = null;
    const stop = () => {
      ctrl.abort();
      audio?.pause();
      finish?.();
      if (url) URL.revokeObjectURL(url);
      setState("idle");
      if (stopCurrent === stop) stopCurrent = null;
    };
    ownStop.current = stop;
    stopCurrent = stop;
    try {
      for (const chunk of speechChunks(spoken)) {
        if (ctrl.signal.aborted) break;
        setState("loading");
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: chunk, lang }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        if (ctrl.signal.aborted) break;
        url = URL.createObjectURL(blob);
        audio = new Audio(url);
        await new Promise<void>((resolve, reject) => {
          finish = resolve;
          audio!.onended = () => resolve();
          audio!.onerror = () => reject(new Error("audio"));
          audio!
            .play()
            .then(() => {
              if (!ctrl.signal.aborted) setState("playing");
            })
            .catch(reject);
        });
        URL.revokeObjectURL(url);
        url = "";
      }
    } catch (e) {
      if (!ctrl.signal.aborted)
        setError(
          es
            ? "La voz en español no está disponible ahora. Vuelva a intentarlo más tarde."
            : "English audio is unavailable right now. Please try again later.",
        );
    } finally {
      if (!ctrl.signal.aborted) stop();
    }
  }
  const Icon =
    state === "loading" ? Loader2 : state === "playing" ? Square : Volume2;
  return (
    <span
      className={`inline-flex flex-col items-start max-w-full ${className}`}
    >
      <Button
        variant={variant}
        size={size}
        onClick={play}
        aria-label={
          state !== "idle"
            ? `Stop reading: ${label}`
            : `${label}: read this aloud`
        }
        aria-pressed={state !== "idle"}
        className={iconOnly ? "!px-0 w-9" : ""}
      >
        <Icon
          className={`h-4 w-4 ${state === "loading" ? "animate-spin" : ""}`}
          aria-hidden="true"
        />
        {!iconOnly && (
          <span>
            {state === "idle"
              ? label
              : state === "loading"
                ? es
                  ? "Cancelar…"
                  : "Cancel loading…"
                : es
                  ? "Detener"
                  : "Stop"}
          </span>
        )}
      </Button>
      {error && (
        <span role="alert" className="text-meta text-md-error max-w-64 mt-2">
          {error}
        </span>
      )}
    </span>
  );
}
