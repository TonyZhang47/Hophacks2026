"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Check, Image as ImageIcon } from "lucide-react";
import { CameraCapture } from "@/components/dose/CameraCapture";
import { downscale } from "@/lib/imageUpload";
import { Button } from "@/components/ui/Button";
import { useLang } from "@/components/LanguageContext";

export default function CapturePage() {
  const { lang } = useLang();
  const es = lang === "es";
  const [token, setToken] = useState("");
  const [state, setState] = useState("checking");
  const [error, setError] = useState("");
  const [camera, setCamera] = useState(false);
  const [photo, setPhoto] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const key = location.hash.slice(1);
    if (!/^[a-f0-9]{48}$/.test(key)) {
      setError("Open the QR link from your computer to connect this phone.");
      setState("invalid");
      return;
    }
    setToken(key);
    fetch("/api/capture", { headers: { Authorization: `Bearer ${key}` } })
      .then(async (res) => {
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        setState(d.status === "sent" ? "sent" : "ready");
      })
      .catch((e) => {
        setError(e.message);
        setState("invalid");
      });
  }, []);

  async function choose(f?: File) {
    if (!f) return;
    setError("");
    try {
      setPhoto(await downscale(f));
    } catch {
      setError(
        es
          ? "No se pudo abrir la foto. Pruebe con JPEG o PNG."
          : "Could not open this photo. Try JPEG or PNG.",
      );
    }
  }

  function onPick(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = "";
    void choose(file);
  }

  async function send() {
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/capture", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ image: photo }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setState("sent");
      setPhoto("");
    } catch (e) {
      setError((e as Error).message);
      setState("ready");
    }
  }

  const busy = state === "sending";

  return (
    <div className="max-w-lg mx-auto py-12 space-y-6">
      <p className="eyebrow">
        RxPlain · {es ? "Captura con el teléfono" : "Phone capture"}
      </p>
      <h1 className="font-serif text-page">
        {state === "sent"
          ? es
            ? "Ya está en camino."
            : "You’re all set."
          : es
            ? "Una foto. Más claridad."
            : "One photo. A little clarity."}
      </h1>
      {state === "sent" ? (
        <div className="panel p-6 space-y-4">
          <Check size={32} />
          <p>
            {es
              ? "Foto enviada. Vuelva a su computadora para revisar el texto leído."
              : "Photo sent. Return to your computer to review the label text."}
          </p>
        </div>
      ) : (
        <>
          <p>
            {es
              ? "Encuadre el nombre y las indicaciones. Cubra sus datos personales. La foto se transfiere temporalmente a su computadora para leerla con Grok."
              : "Frame the medicine name and directions. Cover personal details. Your photo is temporarily transferred to your computer’s session to be read with Grok."}
          </p>
          {(state === "ready" || state === "sending") && (
            <>
              {camera && (
                <CameraCapture
                  onCapture={(f) => void choose(f)}
                  onClose={() => setCamera(false)}
                />
              )}
              <div className="flex gap-3 flex-wrap">
                <Button variant="outlined" disabled={busy} onClick={() => setCamera(true)}>
                  <Camera size={18} />
                  {es ? "Cámara en vivo" : "Live camera"}
                </Button>
                <Button variant="outlined" disabled={busy} onClick={() => cameraRef.current?.click()}>
                  <Camera size={18} />
                  {es ? "Tomar foto" : "Take photo"}
                </Button>
                <Button disabled={busy} onClick={() => fileRef.current?.click()}>
                  <ImageIcon size={18} />
                  {es ? "Elegir una foto" : "Choose a photo"}
                </Button>
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => onPick(e.currentTarget)}
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/*"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => onPick(e.currentTarget)}
                />
              </div>
              <p className="text-meta text-md-on-surface-variant">
                {es
                  ? "Si la cámara en vivo no abre, tome una foto o elija una de la galería."
                  : "If live camera is unavailable on this connection, take a photo or choose one from your library."}
              </p>
              {photo && (
                <div className="space-y-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="Bottle photo ready to send"
                    src={photo}
                    className="w-full max-h-96 object-contain rounded-xl border"
                  />
                  <Button className="w-full" disabled={busy} onClick={send}>
                    {busy
                      ? es
                        ? "Enviando…"
                        : "Sending…"
                      : es
                        ? "Enviar a mi computadora"
                        : "Send to my computer"}
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-md-error">
          {error}
        </p>
      )}
      {state === "checking" && (
        <p role="status">{es ? "Conectando…" : "Connecting…"}</p>
      )}
    </div>
  );
}
