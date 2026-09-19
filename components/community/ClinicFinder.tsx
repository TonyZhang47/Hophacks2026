"use client";

import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { LocateFixed, MapPin, Phone, Search } from "lucide-react";
import { useLang, type Lang } from "@/components/LanguageContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ListenButton } from "@/components/ui/ListenButton";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/SeverityChip";
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

export function ClinicFinder({ className = "" }: { className?: string }) {
  const { lang } = useLang();
  const [zip, setZip] = useState("");
  const [zipError, setZipError] = useState<string | undefined>();
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [filters, setFilters] = useState<Filters>({ medicaid: false, medicare: false, slidingFee: false, rural: false });
  const [status, setStatus] = useState<"idle" | "locating" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const [data, setData] = useState<NearResponse | null>(null);
  const ids = useId();

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
    <Panel className={className} aria-label="Find a clinic">
      <PanelHeader
        icon={MapPin}
        title="Find a clinic"
        subtitle="Community health centers and rural health clinics near a ZIP. We only use the ZIP, never your exact spot."
      />

      <form onSubmit={onSubmit} className="space-y-3" aria-describedby={`${ids}-help`}>
        <p id={`${ids}-help`} className="sr-only">
          Enter a ZIP code or use your location, then choose filters and press Find clinics.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-end gap-2">
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
            className="sm:w-40"
          />
          <Button
            type="button"
            variant="outlined"
            onClick={useMyLocation}
            disabled={status === "locating"}
            className={`h-11 ${zipError ? "sm:mb-7" : ""}`}
          >
            <LocateFixed className="h-4 w-4" aria-hidden="true" />
            {status === "locating" ? "Finding you…" : "Use my location"}
          </Button>
        </div>
        <fieldset>
          <legend className="sr-only">Only show clinics that…</legend>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Chip key={f.key} selected={filters[f.key]} onClick={() => setFilters((s) => ({ ...s, [f.key]: !s[f.key] }))}>
                {f.label}
              </Chip>
            ))}
          </div>
        </fieldset>
        <Button type="submit" disabled={status === "loading"}>
          <Search className="h-4 w-4" aria-hidden="true" />
          {status === "loading" ? "Searching…" : "Find clinics"}
        </Button>
      </form>

      <div aria-live="polite" aria-busy={status === "loading"} className="mt-4 space-y-3">
        {status === "error" && (
          <p role="alert" className="text-meta text-md-error">
            {message}
          </p>
        )}
        {status === "done" && data && (
          <>
            <p className="text-meta text-md-on-surface-variant">
              {results.length === 0
                ? "No clinics within 100 miles."
                : `${results.length} ${results.length === 1 ? "clinic" : "clinics"} within ${data.radiusUsed} miles, closest first.`}
              {data.widened && results.length > 0 && <> Widened to {data.radiusUsed} miles.</>}
            </p>
            {results.length === 0 ? (
              <Card dense>
                <p className="text-body">
                  We couldn&rsquo;t find a listed clinic within 100 miles of that ZIP. Try fewer filters, or search the national directory at{" "}
                  <a href={HRSA_FINDER} target="_blank" rel="noreferrer" className="text-md-tertiary underline underline-offset-4">
                    findahealthcenter.hrsa.gov
                  </a>
                  .
                </p>
              </Card>
            ) : (
              <ul className="space-y-3 list-none p-0 m-0 max-h-[65vh] overflow-y-auto pr-1">
                {results.map((c) => (
                  <ClinicRow key={c.clinic_id} clinic={c} lang={lang} onConfirmed={refresh} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

function ClinicRow({ clinic: c, lang, onConfirmed }: { clinic: ClinicResult; lang: Lang; onConfirmed: () => void }) {
  const [open, setOpen] = useState(false);
  const ids = useId();
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
    <Card as="li" dense className="space-y-2.5">
      <div className="min-w-0">
        <h3 className="text-title break-words leading-snug">{c.name}</h3>
        <p className="text-meta text-md-on-surface-variant">{SITE_WORDS[c.site_type]}</p>
      </div>

      <p className="text-meta">
        <span className="font-medium text-md-on-background">{distance}</span>
        <span className="text-md-on-surface-variant"> · {address}</span>
      </p>

      <div className="flex flex-wrap gap-2" aria-label="Coverage">
        {coverageWords && <StatusPill tone="info">{coverageWords} · by program rule</StatusPill>}
        {c.sliding_fee && <StatusPill tone="success">Sliding fee · by program rule</StatusPill>}
        {c.communityConfirmed.map((s) => (
          <StatusPill key={s.insurer} tone="neutral">
            {s.insurer} · {s.yes} yes{s.no ? `, ${s.no} no` : ""}
          </StatusPill>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {c.phone && (
          <a
            href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-full bg-md-secondary-container text-md-on-secondary-container border border-md-outline text-meta font-medium transition-all duration-200 ease-md hover:bg-md-outline/60 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            <span>Call {c.phone}</span>
          </a>
        )}
        <ListenButton text={describeForAudio(c, lang)} label={`Listen: ${c.name}`} iconOnly size="sm" variant="outlined" />
        <Button
          type="button"
          variant="text"
          size="sm"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={`${ids}-confirm`}
          className="ml-auto"
        >
          {open ? "Hide" : "Add what you learned"}
        </Button>
      </div>

      <p className="text-meta text-md-on-surface-variant">
        <span className="font-medium text-md-on-background">Call to confirm.</span> Program rules say what a clinic must accept; only the clinic can tell
        you about your plan.
      </p>

      <div id={`${ids}-confirm`} hidden={!open}>
        {open && <ConfirmForm clinicId={c.clinic_id} onDone={onConfirmed} />}
      </div>
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
    <div className="rounded-xl bg-md-surface-container-low p-3 space-y-2">
      <p id={`${id}-label`} className="text-meta font-medium text-md-on-surface-variant">
        I called — they take… <span className="font-normal">(community reported, anonymous)</span>
      </p>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <TextField
          label="Insurer"
          hideLabel
          placeholder="Insurer, e.g. Blue Cross"
          value={insurer}
          maxLength={40}
          onChange={(e) => setInsurer(e.target.value)}
          aria-describedby={`${id}-label`}
          className="sm:flex-1"
        />
        <div className="flex gap-2">
          <Button type="button" variant="tonal" className="h-11" onClick={() => send(true)} disabled={state === "sending"}>
            Yes
          </Button>
          <Button type="button" variant="outlined" className="h-11" onClick={() => send(false)} disabled={state === "sending"}>
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
