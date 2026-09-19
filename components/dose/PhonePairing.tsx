"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import { QrCode, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useLang } from "@/components/LanguageContext";
type Session = {
  readToken: string;
  writeToken: string;
  expires: number;
  origins: string[];
};
export function PhonePairing({
  onImage,
  disabled,
}: {
  onImage: (image: string) => void;
  disabled?: boolean;
}) {
  const { lang } = useLang();
  const es = lang === "es";
  const [session, setSession] = useState<Session | null>(null);
  const [origin, setOrigin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const receive = useRef(onImage);
  receive.current = onImage;
  const link = session ? `${origin}/capture#${session.writeToken}` : "";
  const qr = useMemo(() => {
    if (!link) return "";
    const code = qrcode(0, "M");
    code.addData(link);
    code.make();
    return `data:image/svg+xml,${encodeURIComponent(code.createSvgTag({ cellSize: 5, margin: 20, scalable: true }))}`;
  }, [link]);
  useEffect(() => {
    if (!session) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const ctrl = new AbortController();
    async function poll() {
      if (!session || stopped) return;
      if (Date.now() > session.expires) {
        setError(
          es
            ? "El enlace expiró. Genere otro código."
            : "Link expired. Generate a new QR code.",
        );
        setSession(null);
        return;
      }
      try {
        const res = await fetch("/api/capture", {
          headers: { Authorization: `Bearer ${session.readToken}` },
          signal: ctrl.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error);
          setSession(null);
          return;
        }
        if (data.image) {
          receive.current(data.image);
          setMessage(
            es
              ? "Foto recibida del teléfono."
              : "Photo received from your phone.",
          );
          setSession(null);
          return;
        }
      } catch {
        if (!stopped)
          setError(es ? "Reconectando…" : "Reconnecting to the phone link…");
      }
      if (!stopped) timer = setTimeout(poll, 1800);
    }
    void poll();
    return () => {
      stopped = true;
      ctrl.abort();
      clearTimeout(timer);
      void fetch("/api/capture", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.readToken}` },
        keepalive: true,
      }).catch(() => {});
    };
  }, [session, es]);
  async function create() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/capture", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrigin(data.origins[0]);
      setSession(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <Button
        variant="outlined"
        size="sm"
        disabled={disabled || busy}
        onClick={create}
      >
        <QrCode size={17} />
        {busy
          ? es
            ? "Conectando…"
            : "Connecting…"
          : es
            ? "Usar mi teléfono · código QR"
            : "Use my phone · QR code"}
      </Button>
      {session && (
        <div className="rounded-xl border border-md-outline bg-white p-4 space-y-3">
          <div className="flex justify-between">
            <h4 className="font-medium">
              {es ? "Escanee con su teléfono" : "Scan with your phone"}
            </h4>
            <button
              aria-label="Close phone pairing"
              onClick={() => setSession(null)}
              className="p-1"
            >
              <X size={18} />
            </button>
          </div>
          <img
            src={qr}
            alt="QR code to connect your phone camera"
            className="w-44 h-44 mx-auto"
          />
          <p className="text-meta">
            {es
              ? "Use la misma red Wi-Fi. Abra la cámara del teléfono, escanee y envíe una foto. El enlace dura 10 minutos."
              : "Use the same Wi-Fi. Open your phone’s camera, scan this code, and send a photo. The link lasts 10 minutes."}
          </p>
          {session.origins.length > 1 && (
            <label className="block text-meta">
              {es ? "Dirección de la computadora" : "Computer network address"}
              <select
                className="w-full border rounded-lg p-2 mt-1"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
              >
                {session.origins.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
          )}
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="text-meta underline break-all"
          >
            {es ? "Abrir enlace de captura" : "Open capture link"}
          </a>
          <p className="text-meta text-md-on-surface-variant">
            {es
              ? "Si el teléfono no conecta, confirme la red Wi-Fi y la dirección. No comparta el código."
              : "If your phone cannot connect, check Wi-Fi and the network address. Keep this code private."}
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-meta text-md-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-meta">
          {message}
        </p>
      )}
    </div>
  );
}
