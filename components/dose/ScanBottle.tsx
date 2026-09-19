"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CameraCapture } from "@/components/dose/CameraCapture";
import { PhonePairing } from "@/components/dose/PhonePairing";
import { downscale } from "@/lib/imageUpload";
import { Camera, Image as ImageIcon, Loader2 } from "lucide-react";
import { useLang } from "@/components/LanguageContext";
import { Button } from "@/components/ui/Button";
import type { Med } from "@/lib/types";

export interface ScanHint {
  drugName?: string;
  match?: Med | null;
  candidates?: Med[];
}

export interface ScanBottleProps {
  /** Called with the transcribed label lines and a catalog match the parent must confirm. */
  onText: (text: string, hint?: ScanHint) => void;
  disabled?: boolean;
}

type State = "idle" | "reading" | "done" | "error";

const T = {
  en: {
    scan: "Scan my bottle",
    choose: "Choose a photo",
    help: "Point the camera at the directions on the label. Photos are sent to Grok to read the label. Cover your name and other personal details first.",
    reading: "Reading the label…",
    done: "Label read. Confirm the medicine name below.",
    noProvider:
      "Bottle reading is unavailable right now. Type the directions instead.",
    unreadable:
      "We couldn't read that. Try again with more light, or type the directions.",
    failed: "Scanning didn't work just now. Type the directions instead.",
    preview: "Photo of your label",
  },
  es: {
    scan: "Escanear mi frasco",
    choose: "Elegir una foto",
    help: "Apunte la cámara a las indicaciones de la etiqueta. La foto se envía a Grok para leer la etiqueta. Cubra primero su nombre y otros datos personales.",
    reading: "Leyendo la etiqueta…",
    done: "Etiqueta leída. Confirme el nombre del medicamento abajo.",
    noProvider:
      "La lectura de etiquetas no está disponible ahora. Escriba las indicaciones en su lugar.",
    unreadable:
      "No pudimos leerla. Inténtelo con más luz o escriba las indicaciones.",
    failed:
      "El escaneo no funcionó ahora. Escriba las indicaciones en su lugar.",
    preview: "Foto de su etiqueta",
  },
} as const;

/**
 * "Scan my bottle": camera (or file) → client-side downscale → POST /api/ocr/prescription →
 * `onText(lines, { drugName, match, candidates })`. The parent confirms the catalog match
 * before any dose parse.
 */
export function ScanBottle({ onText, disabled }: ScanBottleProps) {
  const { lang } = useLang();
  const t = T[lang];
  const id = useId();
  const [cameraOpen, setCameraOpen] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function handleFile(file: File | undefined, received?: string) {
    if (!file && !received) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState("reading");
    setMessage(t.reading);
    setPreview(null);
    try {
      const dataUrl = received ?? (await downscale(file!));
      setPreview(dataUrl);
      const res = await fetch("/api/ocr/prescription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
        signal: ctrl.signal,
      });
      if (res.status === 503) {
        setState("error");
        setMessage(t.noProvider);
        return;
      }
      if (res.status === 422) {
        setState("error");
        setMessage(t.unreadable);
        return;
      }
      if (!res.ok) throw new Error(`ocr ${res.status}`);
      const data = (await res.json()) as {
        text: string;
        drugName?: string;
        match?: Med | null;
        candidates?: Med[];
      };
      setState("done");
      setMessage(t.done);
      onText(data.text, {
        drugName: data.drugName,
        match: data.match ?? null,
        candidates: data.candidates ?? [],
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setState("error");
      setMessage(t.failed);
    }
  }

  const busy = state === "reading";
  const onChange = (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = ""; // allow picking the same photo again
    void handleFile(file);
  };

  return (
    <div className="rounded-xl bg-md-surface-container-low p-4 flex flex-col gap-3 h-full">
      <h3 className="text-title">{t.scan}</h3>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="md"
          onClick={() => setCameraOpen(true)}
          disabled={disabled || busy}
          aria-describedby={`${id}-help`}
          aria-busy={busy}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Camera className="h-4 w-4" aria-hidden="true" />
          )}
          {busy ? t.reading : lang === "es" ? "Capturar aquí" : "Capture here"}
        </Button>
        <Button
          type="button"
          variant="outlined"
          size="md"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || busy}
          aria-describedby={`${id}-help`}
        >
          <ImageIcon className="h-4 w-4" aria-hidden="true" />
          {t.choose}
        </Button>
      </div>
      {cameraOpen && (
        <CameraCapture
          onCapture={(file) => void handleFile(file)}
          onClose={() => setCameraOpen(false)}
        />
      )}
      <PhonePairing
        disabled={disabled || busy}
        onImage={(image) => void handleFile(undefined, image)}
      />
      <p id={`${id}-help`} className="text-meta text-md-on-surface-variant">
        {t.help}
      </p>

      {/* Hidden pickers: one opens the rear camera on phones, one the file chooser. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => onChange(e.currentTarget)}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => onChange(e.currentTarget)}
      />

      <div
        aria-live="polite"
        aria-atomic="true"
        className="flex items-center gap-3 min-h-6"
      >
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={t.preview}
            className="h-14 w-14 shrink-0 rounded-lg object-cover border border-md-outline"
          />
        )}
        {message && (
          <p
            className={`text-meta ${state === "error" ? "text-md-error" : "text-md-on-surface-variant"}`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
