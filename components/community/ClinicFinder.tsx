"use client";

import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { LocateFixed, Phone, Search } from "lucide-react";
import { useLang, type Lang } from "@/components/LanguageContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ListenButton } from "@/components/ui/ListenButton";
import { TextField } from "@/components/ui/TextField";
import type { ClinicResult, SiteType } from "@/lib/types";

const ZIP_KEY = "rxplain.community.zip";
const HRSA_FINDER = "https://findahealthcenter.hrsa.gov/";

type Filters = { medicaid: boolean; medicare: boolean; slidingFee: boolean; rural: boolean };
const FILTERS: { key: keyof Filters; label: string }[] = [
  { key: "medicaid", label: "Takes Medicaid" },
  { key: "medicare", label: "Takes Medicare" },
  { key: "slidingFee", label: "Sliding fee" },
  { key: "rural", label: "Rural health clinic" },
];

const SITE_WORDS: Record<SiteType, string> = {
  FQHC: "Community health center",
  LOOKALIKE: "Look-alike health center",
  RHC: "Rural health clinic",
};

interface NearResponse {
  results: ClinicResult[];
  radiusUsed: number;
  widened: boolean;
}

/** Same wording as lib/clinics.ts describeClinicForAudio so text and audio agree. */
function spellPhone(phone: string) {
  return phone
    .replace(/\D/g, "")
    .split("")
    .join(" ")
    .replace(/^(\d \d \d) (\d \d \d) /, "$1, $2, ");
}
function describeForAudio(c: ClinicResult, lang: Lang) {
  const miles =
    c.distanceMiles < 1 ? (lang === "es" ? "menos de una milla" : "less than a mile") : `${c.distanceMiles} ${lang === "es" ? "millas" : "miles"}`;
  const phone = c.phone ? spellPhone(c.phone) : "";
  const coverage: string[] = [];
  if (c.accepts_medicaid && c.accepts_medicare) coverage.push(lang === "es" ? "Acepta Medicaid y Medicare" : "Takes Medicaid and Medicare");
  else if (c.accepts_medicaid) coverage.push(lang === "es" ? "Acepta Medicaid" : "Takes Medicaid");
  else if (c.accepts_medicare) coverage.push(lang === "es" ? "Acepta Medicare" : "Takes Medicare");
  if (c.sliding_fee) coverage.push(lang === "es" ? "tarifa según ingresos" : "sliding fee");
  if (lang === "es") {
    const cov = coverage.length ? ` ${coverage.join(", ")}, por regla del programa.` : "";
    return `${c.name}, a ${miles}.${phone ? ` Teléfono ${phone}.` : ""}${cov} Llame para confirmar.`;
  }
  const cov = coverage.length ? ` ${coverage.join(", ")} by program rule.` : "";
  return `${c.name}, ${miles} away.${phone ? ` Phone ${phone}.` : ""}${cov} Call to confirm.`;
}

export function ClinicFinder() {
  const { lang } = useLang();
  const [zip, setZip] = useState("");
  const [zipError, setZipError] = useState<string | undefined>();
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [filters, setFilters] = useState<Filters>({ medicaid: false, medicare: false, slidingFee: false, rural: false });
  const [status, setStatus] = useState<"idle" | "locating" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const [data, setData] = useState<NearResponse | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(ZIP_KEY);
      if (saved && /^\d{5}$/.test(saved)) setZip(saved);
    } catch {}
  }, []);

  const search = useCallback(
    async (where: { zip?: string; lat?: number; lon?: number }) => {
      setStatus("loading");
      setMessage("");
      const params = new URLSearchParams();
      if (where.zip) params.set("zip", where.zip);
      if (where.lat !== undefined && where.lon !== undefined) {
        params.set("lat", where.lat.toFixed(2));
        params.set("lon", where.lon.toFixed(2));
      }
      for (const f of FILTERS) if (filters[f.key]) params.set(f.key, "1");
      try {
        const res = await fetch(`/api/clinics/near?${params.toString()}`);
        const body = (await res.json()) as NearResponse & { error?: string };
        if (!res.ok) {
          setStatus("error");
          setMessage(body.error ?? "Something went wrong. Please try again.");
          setData(null);
          return;
        }
        setData(body);
        setStatus("done");
      } catch {
        setStatus("error");
        setMessage("We couldn't reach the clinic list. Check your connection and try again.");
      }
    },
    [filters],
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const z = zip.replace(/\D/g, "").slice(0, 5);
    if (z.length !== 5) {
      setZipError("Enter the 5-digit ZIP code.");
      return;
    }
    setZipError(undefined);
    setCoords(null);
    try {
      window.localStorage.setItem(ZIP_KEY, z);
    } catch {}
    void search({ zip: z });
  };

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setMessage("Your browser can't share a location. Enter a ZIP code instead.");
      return;
    }
    setStatus("locating");
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Rounded to ~1 km before it ever leaves the device; the server snaps it to a ZIP centroid.
        const c = { lat: Math.round(pos.coords.latitude * 100) / 100, lon: Math.round(pos.coords.longitude * 100) / 100 };
        setCoords(c);
        setZipError(undefined);
        void search(c);
      },
      () => {
        setStatus("error");
        setMessage("We couldn't get your location. Enter a ZIP code instead.");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  };

  const refresh = () => {
    if (coords) void search(coords);
    else if (/^\d{5}$/.test(zip)) void search({ zip });
  };

  const results = data?.results ?? [];

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-4" aria-describedby="clinic-form-help">
        <p id="clinic-form-help" className="text-body text-md-on-surface-variant">
          Community health centers and rural health clinics near a ZIP code. We only ever use the ZIP, never your exact spot.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <TextField
            label="ZIP code"
            inputMode="numeric"
            autoComplete="postal-code"
            pattern="[0-9]{5}"
            maxLength={5}
            placeholder="21550"
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
            error={zipError}
            className="sm:w-48"
          />
          <Button type="button" variant="outlined" onClick={useMyLocation} disabled={status === "locating"} className="h-14 sm:mb-0">
            <LocateFixed className="h-5 w-5" aria-hidden="true" />
            {status === "locating" ? "Finding you…" : "Use my location"}
          </Button>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-label text-md-on-surface-variant mb-2">Only show clinics that…</legend>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Chip key={f.key} selected={filters[f.key]} onClick={() => setFilters((s) => ({ ...s, [f.key]: !s[f.key] }))}>
                {f.label}
              </Chip>
            ))}
          </div>
        </fieldset>
        <Button type="submit" size="lg" disabled={status === "loading"}>
          <Search className="h-5 w-5" aria-hidden="true" />
          {status === "loading" ? "Searching…" : "Find clinics"}
        </Button>
      </form>

      <div aria-live="polite" aria-busy={status === "loading"} className="space-y-4">
        {status === "error" && (
          <p role="alert" className="text-body text-md-error">
            {message}
          </p>
        )}
        {status === "done" && data && (
          <>
            <p className="text-body text-md-on-surface-variant">
              {results.length === 0
                ? "No clinics within 100 miles."
                : `${results.length} ${results.length === 1 ? "clinic" : "clinics"} within ${data.radiusUsed} miles, closest first.`}
              {data.widened && results.length > 0 && <> We widened the search to {data.radiusUsed} miles.</>}
            </p>
            {results.length === 0 ? (
              <Card>
                <p className="text-body">
                  We couldn&rsquo;t find a listed clinic within 100 miles of that ZIP. Try fewer filters, or search the national directory at{" "}
                  <a href={HRSA_FINDER} target="_blank" rel="noreferrer" className="text-md-primary underline underline-offset-4">
                    findahealthcenter.hrsa.gov
                  </a>
                  .
                </p>
              </Card>
            ) : (
              <ul className="space-y-4 list-none p-0 m-0">
                {results.map((c) => (
                  <ClinicCard key={c.clinic_id} clinic={c} lang={lang} onConfirmed={refresh} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ClinicCard({ clinic: c, lang, onConfirmed }: { clinic: ClinicResult; lang: Lang; onConfirmed: () => void }) {
  const address = [c.address, [c.city, c.state].filter(Boolean).join(", "), c.zip].filter(Boolean).join(" · ");
  const coverageWords =
    c.accepts_medicaid && c.accepts_medicare
      ? "Takes Medicaid & Medicare"
      : c.accepts_medicaid
        ? "Takes Medicaid"
        : c.accepts_medicare
          ? "Takes Medicare"
          : null;
  const distance = c.distanceMiles < 1 ? "Less than a mile away" : `${c.distanceMiles} miles away`;

  return (
    <Card as="li" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h3 className="text-title break-words">{c.name}</h3>
          <p className="text-label text-md-on-surface-variant">{SITE_WORDS[c.site_type]}</p>
        </div>
        <ListenButton text={describeForAudio(c, lang)} size="sm" variant="tonal" className="shrink-0" />
      </div>

      <p className="text-body">
        <span className="font-medium">{distance}</span>
        <span className="text-md-on-surface-variant"> · {address}</span>
      </p>

      {c.phone && (
        <a
          href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-md-secondary-container text-md-on-secondary-container text-label transition-all duration-200 ease-md hover:bg-md-secondary-container/80 active:scale-95 focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2"
        >
          <Phone className="h-5 w-5" aria-hidden="true" />
          <span>Call {c.phone}</span>
        </a>
      )}

      <div className="flex flex-wrap gap-2" aria-label="Coverage">
        {coverageWords && <Chip asSpan>{coverageWords} · by program rule</Chip>}
        {c.sliding_fee && <Chip asSpan>Sliding fee · by program rule</Chip>}
        {c.communityConfirmed.map((s) => (
          <Chip key={s.insurer} asSpan className="bg-md-surface-container-low text-md-on-background">
            People here confirmed: {s.insurer} ({s.yes} yes{s.no ? `, ${s.no} no` : ""})
          </Chip>
        ))}
      </div>

      <p className="text-body text-md-on-surface-variant">
        <span className="font-medium text-md-on-background">Call to confirm.</span> Program rules say what a clinic must accept; only the clinic can
        tell you about your plan.
      </p>

      <ConfirmForm clinicId={c.clinic_id} onDone={onConfirmed} />
    </Card>
  );
}

function ConfirmForm({ clinicId, onDone }: { clinicId: string; onDone: () => void }) {
  const [insurer, setInsurer] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState<string>("");
  const id = useId();

  const send = async (confirmed: boolean) => {
    const label = insurer.trim();
    if (label.length < 2) {
      setErr("Type the insurer's name first (for example, Blue Cross).");
      return;
    }
    setErr("");
    setState("sending");
    try {
      const res = await fetch("/api/clinics/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId, insurer: label, confirmed }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setErr(body.error ?? "We couldn't save that. Please try again.");
        setState("error");
        return;
      }
      setState("sent");
      setInsurer("");
      onDone();
    } catch {
      setErr("We couldn't save that. Please try again.");
      setState("error");
    }
  };

  return (
    <div className="rounded-3xl bg-md-surface-container-low p-4 space-y-3">
      <p id={`${id}-label`} className="text-label text-md-on-surface-variant">
        I called — they take… <span className="font-normal">(community reported, anonymous)</span>
      </p>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <TextField
          label="Insurer"
          placeholder="Blue Cross"
          value={insurer}
          maxLength={40}
          onChange={(e) => setInsurer(e.target.value)}
          aria-describedby={`${id}-label`}
          className="sm:flex-1"
        />
        <div className="flex gap-2">
          <Button type="button" variant="tonal" onClick={() => send(true)} disabled={state === "sending"}>
            Yes
          </Button>
          <Button type="button" variant="outlined" onClick={() => send(false)} disabled={state === "sending"}>
            No
          </Button>
        </div>
      </div>
      <p role="status" className={`text-meta ${err ? "text-md-error" : "text-md-on-surface-variant"}`}>
        {err ? err : state === "sent" ? "Thanks — added to what people here reported." : state === "sending" ? "Saving…" : ""}
      </p>
    </div>
  );
}
