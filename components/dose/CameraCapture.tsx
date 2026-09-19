"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useLang } from "@/components/LanguageContext";
export function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const { lang } = useLang();
  const es = lang === "es";
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    let active = true;
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error("unavailable");
        const media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (!active) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = media;
        if (video.current) {
          video.current.srcObject = media;
          await video.current.play();
          setReady(true);
        }
      } catch {
        setError(
          es
            ? "No se pudo abrir la cámara. Permita el acceso o use una foto."
            : "Camera unavailable. Allow camera access, or close this preview and choose a photo.",
        );
      }
    }
    void start();
    return () => {
      active = false;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, [es]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  function take() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    const ratio = Math.min(1, 1600 / v.videoWidth);
    c.width = v.videoWidth * ratio;
    c.height = v.videoHeight * ratio;
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    c.toBlob(
      (blob) => {
        if (blob) {
          setPhoto(blob);
          setPreview(URL.createObjectURL(blob));
        }
      },
      "image/jpeg",
      0.85,
    );
  }
  return (
    <section
      className="camera-preview border border-md-outline p-3 rounded-xl space-y-3"
      aria-label="Camera preview"
    >
      <div className="flex justify-between items-center">
        <h3 className="text-title font-normal">
          {es ? "Capturar etiqueta" : "Capture your label"}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close camera"
          className="p-2"
        >
          <X size={18} />
        </button>
      </div>
      <video
        ref={video}
        muted
        playsInline
        className={`w-full max-h-72 rounded-lg bg-black ${preview ? "hidden" : ""}`}
      />
      {preview && (
        <img
          src={preview}
          alt="Captured label preview"
          className="w-full max-h-72 object-contain rounded-lg"
        />
      )}
      {error && (
        <p role="alert" className="text-meta">
          {error}
        </p>
      )}
      <div className="flex gap-2 flex-wrap">
        {photo ? (
          <>
            <Button
              size="sm"
              onClick={() => {
                onCapture(
                  new File([photo], "bottle.jpg", { type: "image/jpeg" }),
                );
                onClose();
              }}
            >
              {es ? "Usar foto" : "Use photo"}
            </Button>
            <Button
              variant="outlined"
              size="sm"
              onClick={() => {
                setPhoto(null);
                setPreview("");
              }}
            >
              {es ? "Repetir" : "Retake"}
            </Button>
          </>
        ) : (
          <Button size="sm" disabled={!ready} onClick={take}>
            <Camera size={16} />
            {es ? "Tomar foto" : "Take photo"}
          </Button>
        )}
      </div>
    </section>
  );
}
