"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
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

const SITE_WORDS: Record<SiteType, { en: string; es: string }> = {
  FQHC: { en: "Community health center", es: "Centro de salud comunitario" },
  LOOKALIKE: { en: "Look-alike health center", es: "Centro de salud tipo FQHC" },
  RHC: { en: "Rural health clinic", es: "Clínica de salud rural" },
};

const ZIP_KEY = "rxplain.community.zip";
const HRSA_FINDER = "https://findahealthcenter.hrsa.gov/";

type Filters = { medicaid: boolean; medicare: boolean; slidingFee: boolean; rural: boolean };

const T = {
  en: {
    title: "Clinics",
    subtitle: "Community health centers and rural health clinics near a ZIP code or your current location.",
    help: "Enter a ZIP code or use your location, then choose filters and press Find clinics.",
    zip: "ZIP code",
    locating: "Finding you…",
    useLocation: "Use my location",
    filtersLegend: "Only show clinics that…",
    radius: "Travel radius",
    milesLabel: (n: number) => `${n} miles`,
    medicaid: "Takes Medicaid",
    medicare: "Takes Medicare",
    slidingFee: "Sliding fee",
    rural: "Rural health clinic",
    searching: "Searching…",
    find: "Find clinics",
    network: "Something went wrong. Please try again.",
    unreachable: "We couldn't reach the clinic list. Check your connection and try again.",
    zipError: "Enter the 5-digit ZIP code.",
    noGeo: "Your browser can't share a location. Enter a ZIP code instead.",
    geoFail: "We couldn't get your location. Enter a ZIP code instead.",
    none: "No clinics within 100 miles.",
    clinicsWithin: (n: number, miles: number) =>
      `${n} ${n === 1 ? "clinic" : "clinics"} within ${miles} miles, closest first.`,
    farthestShown: (miles: number) => ` Farthest shown: ${miles} miles.`,
    showingClosest: "Listed sites from HRSA health-center and CMS rural health clinic directories.",
    widened: (miles: number) => ` Widened to ${miles} miles.`,
    empty:
      "We couldn't find a listed clinic within 100 miles of that ZIP. Try fewer filters, or search the national directory at",
    medicaidMedicare: "Takes Medicaid & Medicare",
    takesMedicaid: "Takes Medicaid",
    takesMedicare: "Takes Medicare",
    byProgram: "by program rule",
    sliding: "Sliding fee",
    lessMile: "Less than a mile away",
    milesAway: (n: number) => `${n} miles away`,
    coverage: "Coverage",
    call: "Call",
    listen: (name: string) => `Listen: ${name}`,
    callConfirm: "Call to confirm.",
    callConfirmRest: "Program rules say what a clinic must accept; only the clinic can tell you about your plan.",
    yes: (n: number) => `${n} yes`,
    no: (n: number) => `${n} no`,
  },
  es: {
    title: "Clínicas",
    subtitle: "Centros de salud comunitarios y clínicas rurales cerca de un código postal o de su ubicación actual.",
    help: "Escriba un código postal o use su ubicación, elija filtros y pulse Buscar clínicas.",
    zip: "Código postal",
    locating: "Buscándole…",
    useLocation: "Usar mi ubicación",
    filtersLegend: "Mostrar solo clínicas que…",
    radius: "Radio de viaje",
    milesLabel: (n: number) => `${n} millas`,
    medicaid: "Acepta Medicaid",
    medicare: "Acepta Medicare",
    slidingFee: "Tarifa según ingresos",
    rural: "Clínica de salud rural",
    searching: "Buscando…",
    find: "Buscar clínicas",
    network: "Algo salió mal. Inténtelo de nuevo.",
    unreachable: "No pudimos abrir la lista de clínicas. Revise su conexión e inténtelo de nuevo.",
    zipError: "Escriba el código postal de 5 dígitos.",
    noGeo: "Su navegador no puede compartir la ubicación. Escriba un código postal.",
    geoFail: "No pudimos obtener su ubicación. Escriba un código postal.",
    none: "No hay clínicas a menos de 100 millas.",
    clinicsWithin: (n: number, miles: number) =>
      `${n} ${n === 1 ? "clínica" : "clínicas"} a ${miles} millas, la más cercana primero.`,
    farthestShown: (miles: number) => ` La más lejana mostrada: ${miles} millas.`,
    showingClosest: "Sitios listados en los directorios de centros de salud de HRSA y clínicas rurales de CMS.",
    widened: (miles: number) => ` Se amplió a ${miles} millas.`,
    empty:
      "No encontramos una clínica listada a menos de 100 millas de ese código postal. Pruebe con menos filtros o busque en el directorio nacional en",
    medicaidMedicare: "Acepta Medicaid y Medicare",
    takesMedicaid: "Acepta Medicaid",
    takesMedicare: "Acepta Medicare",
    byProgram: "por regla del programa",
    sliding: "Tarifa según ingresos",
    lessMile: "A menos de una milla",
    milesAway: (n: number) => `A ${n} millas`,
    coverage: "Cobertura",
    call: "Llamar",
    listen: (name: string) => `Escuchar: ${name}`,
    callConfirm: "Llame para confirmar.",
    callConfirmRest: "Las reglas del programa dicen lo que una clínica debe aceptar; solo la clínica puede hablarle de su plan.",
    yes: (n: number) => `${n} sí`,
    no: (n: number) => `${n} no`,
  },
} as const;

const FILTER_KEYS: { key: keyof Filters; label: keyof (typeof T)["en"] }[] = [
  { key: "medicaid", label: "medicaid" },
  { key: "medicare", label: "medicare" },
  { key: "slidingFee", label: "slidingFee" },
  { key: "rural", label: "rural" },
];

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

export function ClinicFinder({ className = "", showHeader = true }: { className?: string; showHeader?: boolean }) {
  const { lang } = useLang();
  const t = T[lang];
  const [zip, setZip] = useState("");
  const [zipError, setZipError] = useState<string | undefined>();
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [filters, setFilters] = useState<Filters>({ medicaid: false, medicare: false, slidingFee: false, rural: false });
  const [radius, setRadius] = useState(25);
  const [status, setStatus] = useState<"idle" | "locating" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const [data, setData] = useState<NearResponse | null>(null);
  const ids = useId();
  const lastWhere = useRef<{ zip?: string; lat?: number; lon?: number } | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(ZIP_KEY);
      if (saved && /^\d{5}$/.test(saved)) setZip(saved);
    } catch {}
  }, []);

  const search = useCallback(
    async (where: { zip?: string; lat?: number; lon?: number }) => {
      lastWhere.current = where;
      setStatus("loading");
      setMessage("");
      const params = new URLSearchParams();
      if (where.zip) params.set("zip", where.zip);
      if (where.lat !== undefined && where.lon !== undefined) {
        params.set("lat", where.lat.toFixed(2));
        params.set("lon", where.lon.toFixed(2));
      }
      for (const f of FILTER_KEYS) if (filters[f.key]) params.set(f.key, "1");
      params.set("radiusMiles", String(radius));
      try {
        const res = await fetch(`/api/clinics/near?${params.toString()}`);
        const body = (await res.json()) as NearResponse & { error?: string };
        if (!res.ok) {
          setStatus("error");
          setMessage(body.error ?? t.network);
          setData(null);
          return;
        }
        setData(body);
        setStatus("done");
      } catch {
        setStatus("error");
        setMessage(t.unreachable);
      }
    },
    [filters, radius, t],
  );

  useEffect(() => {
    if (!lastWhere.current) return;
    const timer = setTimeout(() => {
      if (lastWhere.current) void search(lastWhere.current);
    }, 400);
    return () => clearTimeout(timer);
  }, [radius, search]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const z = zip.replace(/\D/g, "").slice(0, 5);
    if (z.length !== 5) {
      setZipError(t.zipError);
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
      setMessage(t.noGeo);
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
        setMessage(t.geoFail);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  };

  const results = data?.results ?? [];

  return (
    <Panel className={className} aria-label={t.title}>
      {showHeader && <PanelHeader icon={MapPin} title={t.title} subtitle={t.subtitle} />}

      <form onSubmit={onSubmit} className="space-y-3" aria-describedby={`${ids}-help`}>
        <p id={`${ids}-help`} className="sr-only">
          {t.help}
        </p>
        <div className="flex flex-col sm:flex-row sm:items-end gap-2">
          <TextField
            label={t.zip}
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
            {status === "locating" ? t.locating : t.useLocation}
          </Button>
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor={`${ids}-radius`} className="block text-meta font-medium text-md-on-surface-variant mb-1.5">
              {t.radius}
            </label>
            <output htmlFor={`${ids}-radius`} className="text-meta font-medium text-md-on-background tabular-nums">
              {t.milesLabel(radius)}
            </output>
          </div>
          <input
            id={`${ids}-radius`}
            type="range"
            min={5}
            max={100}
            step={5}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-full accent-md-primary"
            aria-valuetext={t.milesLabel(radius)}
          />
          <div className="flex justify-between text-meta text-md-on-surface-variant">
            <span>{t.milesLabel(5)}</span>
            <span>{t.milesLabel(100)}</span>
          </div>
        </div>
        <fieldset>
          <legend className="sr-only">{t.filtersLegend}</legend>
          <div className="flex flex-wrap gap-2">
            {FILTER_KEYS.map((f) => (
              <Chip key={f.key} selected={filters[f.key]} onClick={() => setFilters((s) => ({ ...s, [f.key]: !s[f.key] }))}>
                {t[f.label] as string}
              </Chip>
            ))}
          </div>
        </fieldset>
        <Button type="submit" disabled={status === "loading"}>
          <Search className="h-4 w-4" aria-hidden="true" />
          {status === "loading" ? t.searching : t.find}
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
                ? t.none
                : `${t.clinicsWithin(results.length, data.radiusUsed)}${
                    results.length ? t.farthestShown(results[results.length - 1].distanceMiles) : ""
                  }`}
              {data.widened && results.length > 0 && t.widened(data.radiusUsed)}
            </p>
            {results.length > 0 && (
              <p className="text-meta text-md-on-surface-variant">{t.showingClosest}</p>
            )}
            {results.length === 0 ? (
              <Card dense>
                <p className="text-body">
                  {t.empty}{" "}
                  <a href={HRSA_FINDER} target="_blank" rel="noreferrer" className="text-md-tertiary underline underline-offset-4">
                    findahealthcenter.hrsa.gov
                  </a>
                  .
                </p>
              </Card>
            ) : (
              <ul className="space-y-3 list-none p-0 m-0 max-h-[65vh] overflow-y-auto pr-1">
                {results.map((c) => (
                  <ClinicRow key={c.clinic_id} clinic={c} lang={lang} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

function ClinicRow({ clinic: c, lang }: { clinic: ClinicResult; lang: Lang }) {
  const t = T[lang];
  const address = [c.address, [c.city, c.state].filter(Boolean).join(", "), c.zip].filter(Boolean).join(" · ");
  const coverageWords =
    c.accepts_medicaid && c.accepts_medicare
      ? t.medicaidMedicare
      : c.accepts_medicaid
        ? t.takesMedicaid
        : c.accepts_medicare
          ? t.takesMedicare
          : null;
  const distance = c.distanceMiles < 1 ? t.lessMile : t.milesAway(c.distanceMiles);

  return (
    <Card as="li" dense className="space-y-2.5">
      <div className="min-w-0">
        <h3 className="text-title break-words leading-snug">{c.name}</h3>
        <p className="text-meta text-md-on-surface-variant">{SITE_WORDS[c.site_type][lang]}</p>
      </div>

      <p className="text-meta">
        <span className="font-medium text-md-on-background">{distance}</span>
        <span className="text-md-on-surface-variant"> · {address}</span>
      </p>

      <div className="flex flex-wrap gap-2" aria-label={t.coverage}>
        {coverageWords && (
          <StatusPill tone="info">
            {coverageWords} · {t.byProgram}
          </StatusPill>
        )}
        {c.sliding_fee && (
          <StatusPill tone="success">
            {t.sliding} · {t.byProgram}
          </StatusPill>
        )}
        {c.communityConfirmed.map((s) => (
          <StatusPill key={s.insurer} tone="neutral">
            {s.insurer} · {t.yes(s.yes)}
            {s.no ? `, ${t.no(s.no)}` : ""}
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
            <span>
              {t.call} {c.phone}
            </span>
          </a>
        )}
        <ListenButton text={describeForAudio(c, lang)} label={t.listen(c.name)} iconOnly size="sm" variant="outlined" />
      </div>

      <p className="text-meta text-md-on-surface-variant">
        <span className="font-medium text-md-on-background">{t.callConfirm}</span> {t.callConfirmRest}
      </p>
    </Card>
  );
}
