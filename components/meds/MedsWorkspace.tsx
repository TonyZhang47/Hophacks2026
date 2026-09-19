"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Pill, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ListenButton } from "@/components/ui/ListenButton";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/Panel";
import { PlainText } from "@/components/ui/PlainText";
import { StatusPill } from "@/components/ui/SeverityChip";
import { Select } from "@/components/ui/TextField";
import { useLang } from "@/components/LanguageContext";
import { MedSearch } from "@/components/meds/MedSearch";
import { MedChips } from "@/components/meds/MedChips";
import { InteractionGraph } from "@/components/meds/InteractionGraph";
import { InteractionCardList, cardSpeechText, findResult, type SeverityFilter } from "@/components/meds/InteractionCardList";
import { StatRow, type SeverityCounts } from "@/components/meds/StatRow";
import { SharePanel } from "@/components/meds/SharePanel";
import { DoseExplainer } from "@/components/dose/DoseExplainer";
import type { DoseInput, DoseResult, InteractionCard, InteractionResult, Med, Severity } from "@/lib/types";

const STORAGE_KEY = "rxplain.meds";
const MIN_MEDS = 2;
const MAX_MEDS = 10;

/** Advil + warfarin + metformin + lisinopril: hits major, moderate, minor and unknown in the seed. */
const DEMO_SET: Med[] = [
  { name: "Advil (ibuprofen)", rxcui: "5640", ingredientName: "ibuprofen" },
  { name: "Warfarin", rxcui: "11289", ingredientName: "warfarin" },
  { name: "Metformin", rxcui: "6809", ingredientName: "metformin" },
  { name: "Lisinopril", rxcui: "29046", ingredientName: "lisinopril" },
];

const SEVERITIES: Severity[] = ["major", "moderate", "minor", "unknown"];

interface CheckResponse {
  results: InteractionResult[];
  cards: InteractionCard[];
  summary: string;
}

type Dose = { input: DoseInput; result: DoseResult };

const STRINGS = {
  en: {
    h1: "Your medicines",
    sub: "Add what you take, check the pairs, then read or hear what it means in plain words.",
    check: "Check my medicines",
    checking: "Checking…",
    demo: "Try a demo set",
    clear: "Clear list",
    demoPill: "Demo mode",
    demoTitle: "Seed data and template wording. Live databases and Grok are not connected.",
    needMore: (n: number) => (n === 0 ? `Add at least ${MIN_MEDS} medicines to check them.` : `Add ${MIN_MEDS - n} more to check.`),
    ready: (n: number) => `${n} medicines ready to check.`,
    myMeds: "My medicines",
    map: "Map of your medicines",
    mapEmpty: "Add two or more medicines to draw the map.",
    interactions: "Possible interactions",
    interactionsEmpty: "Results for each pair will appear here after you check your medicines.",
    readSummary: "Read summary",
    readAll: "Read all cards",
    filterLabel: "Show",
    filterAll: "All severities",
    sev: { major: "Major", moderate: "Moderate", minor: "Minor", unknown: "Unknown" } as Record<Severity, string>,
    error: "We could not check these medicines right now. Please try again in a moment.",
  },
  es: {
    h1: "Sus medicamentos",
    sub: "Agregue lo que toma, revise los pares y lea o escuche lo que significa en palabras sencillas.",
    check: "Revisar mis medicamentos",
    checking: "Revisando…",
    demo: "Probar un ejemplo",
    clear: "Borrar lista",
    demoPill: "Modo demostración",
    demoTitle: "Datos de ejemplo y textos de plantilla. Las bases de datos en vivo y Grok no están conectados.",
    needMore: (n: number) => (n === 0 ? `Agregue al menos ${MIN_MEDS} medicamentos para revisarlos.` : `Agregue ${MIN_MEDS - n} más para revisar.`),
    ready: (n: number) => `${n} medicamentos listos para revisar.`,
    myMeds: "Mis medicamentos",
    map: "Mapa de sus medicamentos",
    mapEmpty: "Agregue dos o más medicamentos para dibujar el mapa.",
    interactions: "Posibles interacciones",
    interactionsEmpty: "Los resultados de cada par aparecerán aquí después de revisar sus medicamentos.",
    readSummary: "Leer resumen",
    readAll: "Leer todas las tarjetas",
    filterLabel: "Mostrar",
    filterAll: "Todas las gravedades",
    sev: { major: "Mayor", moderate: "Moderada", minor: "Menor", unknown: "Desconocida" } as Record<Severity, string>,
    error: "No pudimos revisar estos medicamentos ahora. Intente de nuevo en un momento.",
  },
};

function loadMeds(): Med[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m): m is Med => !!m && typeof m === "object" && typeof (m as Med).name === "string" && typeof (m as Med).rxcui === "string")
      .slice(0, MAX_MEDS);
  } catch {
    return [];
  }
}

function saveMeds(meds: Med[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(meds));
  } catch {
    // storage may be unavailable (private mode); the page still works
  }
}

export function MedsWorkspace() {
  const { lang } = useLang();
  const t = STRINGS[lang];

  const [meds, setMeds] = useState<Med[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CheckResponse | null>(null);
  const [doses, setDoses] = useState<Dose[]>([]);
  const [demoMode, setDemoMode] = useState(false);
  const [filter, setFilter] = useState<SeverityFilter>("all");
  const resultsRef = useRef<HTMLDivElement>(null);
  const checkedLang = useRef<"en" | "es">(lang);

  // Hydrate from localStorage once.
  useEffect(() => {
    setMeds(loadMeds());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveMeds(meds);
  }, [meds, hydrated]);

  // One-time health check for the demo-mode pill.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((r) => (r.ok ? r.json() : null))
      .then((h: { mode?: { llm?: string } } | null) => {
        if (!cancelled && h?.mode?.llm === "template") setDemoMode(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const canCheck = meds.length >= MIN_MEDS && meds.length <= MAX_MEDS && !loading;

  const addMed = useCallback((m: Med) => {
    setMeds((prev) => (prev.length >= MAX_MEDS || prev.some((x) => x.rxcui === m.rxcui) ? prev : [...prev, m]));
    setData(null);
  }, []);

  const removeMed = useCallback((rxcui: string) => {
    setMeds((prev) => prev.filter((m) => m.rxcui !== rxcui));
    setData(null);
    setDoses((prev) => prev.filter((d) => d.input.rxcui !== rxcui));
  }, []);

  const runCheck = useCallback(async (list: Med[], language: "en" | "es") => {
    if (list.length < MIN_MEDS) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/interactions/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meds: list, lang: language }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as CheckResponse;
      setData(json);
      setFilter("all");
      checkedLang.current = language;
      requestAnimationFrame(() => resultsRef.current?.focus());
    } catch {
      setError(STRINGS[language].error);
    } finally {
      setLoading(false);
    }
  }, []);

  // If the person switches language after checking, refresh the cards in that language.
  useEffect(() => {
    if (data && checkedLang.current !== lang && !loading) void runCheck(meds, lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const loadDemo = () => {
    setMeds(DEMO_SET);
    setData(null);
    setDoses([]);
    setError(null);
  };

  const clearAll = () => {
    setMeds([]);
    setData(null);
    setDoses([]);
    setError(null);
  };

  const onDoseResult = useCallback((r: Dose) => {
    setDoses((prev) => {
      const rest = prev.filter((d) => d.input.rxcui !== r.input.rxcui);
      return [...rest, r];
    });
  }, []);

  const counts = useMemo<SeverityCounts | null>(() => {
    if (!data) return null;
    const c: SeverityCounts = { major: 0, moderate: 0, minor: 0, unknown: 0 };
    for (const r of data.results) c[r.severity]++;
    return c;
  }, [data]);

  const readCardsText = useCallback(() => {
    if (!data) return "";
    const visible = filter === "all" ? data.cards : data.cards.filter((c) => c.severity === filter);
    return visible.map((c) => cardSpeechText(c, lang, findResult(c, data.results))).join(" ");
  }, [data, filter, lang]);

  const shareData = useMemo(
    () => ({ meds, cards: data?.cards ?? [], doses, clinic: null }),
    [meds, data, doses],
  );

  return (
    <div className="pb-6">
      <PageHeader
        title={t.h1}
        subtitle={t.sub}
        actions={
          <>
            {demoMode && (
              <span title={t.demoTitle} className="mr-1">
                <StatusPill tone="neutral">{t.demoPill}</StatusPill>
              </span>
            )}
            <Button variant="outlined" size="sm" onClick={loadDemo}>
              {t.demo}
            </Button>
            <Button variant="text" size="sm" onClick={clearAll} disabled={meds.length === 0}>
              {t.clear}
            </Button>
          </>
        }
      />

      <StatRow counts={counts} medCount={meds.length} maxMeds={MAX_MEDS} />

      {/* Row A is its own grid so the sticky left panel is bounded by this row, not the whole page. */}
      <div className="grid grid-cols-12 gap-6 mt-6">
        {/* Row A, left: my medicines */}
        <Panel as="section" className="col-span-12 lg:col-span-4 lg:sticky lg:top-20 self-start" aria-labelledby="meds-panel-title">
          <PanelHeader icon={Pill} title={t.myMeds} />
          <span id="meds-panel-title" className="sr-only">
            {t.myMeds}
          </span>
          <div className="space-y-4">
            <MedSearch meds={meds} onAdd={addMed} max={MAX_MEDS} />
            <MedChips meds={meds} onRemove={removeMed} />
            <p className="text-meta text-md-on-surface-variant" aria-live="polite">
              {meds.length < MIN_MEDS ? t.needMore(meds.length) : t.ready(meds.length)}
            </p>
            <Button
              variant="filled"
              size="lg"
              className="w-full"
              disabled={!canCheck}
              onClick={() => runCheck(meds, lang)}
              aria-busy={loading}
            >
              {loading ? t.checking : t.check}
            </Button>
            {error && (
              <p role="alert" className="text-meta text-md-error">
                {error}
              </p>
            )}
            {data && (
              <div className="rounded-lg bg-md-surface-container-low border border-md-outline p-3 space-y-2" aria-live="polite">
                <PlainText as="p" className="text-label" text={data.summary} />
                <ListenButton size="sm" variant="outlined" label={t.readSummary} text={data.summary} />
              </div>
            )}
          </div>
        </Panel>

        {/* Row A, right: graph */}
        <Panel as="section" className="col-span-12 lg:col-span-8" aria-labelledby="map-panel-title">
          <PanelHeader icon={Share2} title={t.map} />
          <span id="map-panel-title" className="sr-only">
            {t.map}
          </span>
          {meds.length >= MIN_MEDS ? (
            <InteractionGraph meds={meds} results={data?.results ?? []} />
          ) : (
            <p className="text-body text-md-on-surface-variant">{t.mapEmpty}</p>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-12 gap-6 mt-6">
        {/* Row B: interaction cards */}
        <div ref={resultsRef} tabIndex={-1} className="col-span-12 min-w-0 scroll-mt-24 focus:outline-none">
        <Panel as="section" aria-labelledby="interactions-panel-title">
          <PanelHeader
            icon={AlertTriangle}
            title={t.interactions}
            actions={
              data ? (
                <>
                  <Select label={t.filterLabel} hideLabel value={filter} onChange={(e) => setFilter(e.target.value as SeverityFilter)}>
                    <option value="all">{t.filterAll}</option>
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>
                        {t.sev[s]}
                      </option>
                    ))}
                  </Select>
                  <ListenButton size="sm" variant="outlined" label={t.readAll} text="" getText={readCardsText} />
                </>
              ) : undefined
            }
          />
          <span id="interactions-panel-title" className="sr-only">
            {t.interactions}
          </span>
          <div className="max-h-[70vh] overflow-y-auto pr-1" aria-live="polite">
            {data ? (
              <InteractionCardList cards={data.cards} results={data.results} filter={filter} />
            ) : (
              <p className="text-body text-md-on-surface-variant">{t.interactionsEmpty}</p>
            )}
          </div>
        </Panel>
        </div>

        {/* Row C, left: dose explainer (dose module renders its own header) */}
        <div className="col-span-12 lg:col-span-7 min-w-0">
          <DoseExplainer meds={meds} onResult={onDoseResult} />
        </div>

        {/* Row C, right: share sheet */}
        <SharePanel data={shareData} className="col-span-12 lg:col-span-5 self-start" />
      </div>
    </div>
  );
}
