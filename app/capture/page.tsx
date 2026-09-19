"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Check, Upload } from "lucide-react";
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
  const file = useRef<HTMLInputElement>(null);
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
  return (
    <div className="max-w-lg mx-auto py-12 space-y-6">
      <p className="eyebrow">
        RxPlain · {es ? "Captura con el teléfono" : "Phone capture"}
      </p>
      <h1 className="font-serif text-4xl">
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
                <Button
                  variant="outlined"
                  disabled={state === "sending"}
                  onClick={() => setCamera(true)}
                >
                  <Camera size={18} />
                  {es ? "Vista de cámara" : "Live camera"}
                </Button>
                <Button
                  disabled={state === "sending"}
                  onClick={() => file.current?.click()}
                >
                  <Upload size={18} />
                  {es ? "Tomar o elegir foto" : "Take or choose photo"}
                </Button>
                <input
                  ref={file}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => {
                    void choose(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>
              <p className="text-meta text-md-on-surface-variant">
                {es
                  ? "Si la cámara en vivo no abre, use Tomar o elegir foto."
                  : "If live camera is unavailable on this connection, use Take or choose photo."}
              </p>
              {photo && (
                <div className="space-y-4">
                  <img
                    alt="Bottle photo ready to send"
                    src={photo}
                    className="w-full max-h-96 object-contain rounded-xl border"
                  />
                  <Button
                    className="w-full"
                    disabled={state === "sending"}
                    onClick={send}
                  >
                    {state === "sending"
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
