"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, Image as ImageIcon, Loader2 } from "lucide-react";
import { useLang } from "@/components/LanguageContext";
import { Button } from "@/components/ui/Button";

export interface ScanBottleProps {
  /** Called with the transcribed label lines (newline-separated) and a drug-name hint when one was read. */
  onText: (text: string, hint?: { drugName?: string }) => void;
  disabled?: boolean;
}

type State = "idle" | "reading" | "done" | "error";

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

const T = {
  en: {
    scan: "Scan my bottle",
    choose: "Choose a photo",
    help: "Point the camera at the directions on the label. We only read the text; the photo is not saved.",
    reading: "Reading the label…",
    done: "Label read. Check the directions below.",
    noProvider: "Scanning needs the Grok key. Type the directions instead.",
    unreadable: "We couldn't read that. Try again with more light, or type the directions.",
    failed: "Scanning didn't work just now. Type the directions instead.",
    preview: "Photo of your label",
  },
  es: {
    scan: "Escanear mi frasco",
    choose: "Elegir una foto",
    help: "Apunte la cámara a las indicaciones de la etiqueta. Solo leemos el texto; la foto no se guarda.",
    reading: "Leyendo la etiqueta…",
    done: "Etiqueta leída. Revise las indicaciones abajo.",
    noProvider: "Para escanear se necesita la clave de Grok. Escriba las indicaciones en su lugar.",
    unreadable: "No pudimos leerla. Inténtelo con más luz o escriba las indicaciones.",
    failed: "El escaneo no funcionó ahora. Escriba las indicaciones en su lugar.",
    preview: "Foto de su etiqueta",
  },
} as const;

/** Downscale to MAX_EDGE on the long side and re-encode as JPEG so uploads stay small on phones. */
async function downscale(file: File): Promise<string> {
  let source: ImageBitmap | HTMLImageElement;
  let width: number;
  let height: number;
  if (typeof createImageBitmap === "function") {
    // `imageOrientation: "from-image"` applies the EXIF rotation phones write.
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions).catch(() =>
      createImageBitmap(file),
    );
    source = bmp;
    width = bmp.width;
    height = bmp.height;
  } else {
    const url = URL.createObjectURL(file);
    try {
      source = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("decode"));
        img.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
    width = source.naturalWidth;
    height = source.naturalHeight;
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(source, 0, 0, w, h);
  if ("close" in source) source.close();
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

/**
 * "Scan my bottle": camera (or file) → client-side downscale → POST /api/ocr/prescription →
 * `onText(lines, { drugName })`. Text only; the parent still shows the confirmation step.
 */
export function ScanBottle({ onText, disabled }: ScanBottleProps) {
  const { lang } = useLang();
  const t = T[lang];
  const id = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState("reading");
    setMessage(t.reading);
    setPreview(null);
    try {
      const dataUrl = await downscale(file);
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
      const data = (await res.json()) as { text: string; drugName?: string };
      setState("done");
      setMessage(t.done);
      onText(data.text, { drugName: data.drugName });
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
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="md"
          onClick={() => cameraRef.current?.click()}
          disabled={disabled || busy}
          aria-describedby={`${id}-help`}
          aria-busy={busy}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Camera className="h-4 w-4" aria-hidden="true" />}
          {busy ? t.reading : t.scan}
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

      <div aria-live="polite" aria-atomic="true" className="flex items-center gap-3 min-h-6">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={t.preview}
            className="h-14 w-14 shrink-0 rounded-lg object-cover border border-md-outline"
          />
        )}
        {message && (
          <p className={`text-meta ${state === "error" ? "text-md-error" : "text-md-on-surface-variant"}`}>{message}</p>
        )}
      </div>
    </div>
  );
}
