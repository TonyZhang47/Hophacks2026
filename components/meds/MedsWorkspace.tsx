"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { BlurBackdrop } from "@/components/ui/BlurBackdrop";
import { Button } from "@/components/ui/Button";
import { ListenButton } from "@/components/ui/ListenButton";
import { useLang } from "@/components/LanguageContext";
import { MedSearch } from "@/components/meds/MedSearch";
import { MedChips } from "@/components/meds/MedChips";
import { InteractionGraph } from "@/components/meds/InteractionGraph";
import { InteractionCardList, cardSpeechText } from "@/components/meds/InteractionCardList";
import { DoseExplainer } from "@/components/dose/DoseExplainer";
import { ShareSheetButton } from "@/components/share/ShareSheetButton";
import type { DoseInput, DoseResult, InteractionCard, InteractionResult, Med } from "@/lib/types";

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

interface CheckResponse {
  results: InteractionResult[];
  cards: InteractionCard[];
  summary: string;
}

type Dose = { input: DoseInput; result: DoseResult };

const STRINGS = {
  en: {
    h1: "Understand your medicines in plain language",
    sub: "For anyone who has ever left the pharmacy with a bag of boxes and no idea how they fit together. Add what you take, then read or hear what it means.",
    check: "Check my medicines",
    checking: "Checking…",
    demo: "Try a demo set",
    clear: "Clear list",
    needMore: (n: number) => (n === 0 ? `Add at least ${MIN_MEDS} medicines to check them.` : `Add ${MIN_MEDS - n} more to check.`),
    ready: (n: number) => `${n} medicines ready to check.`,
    resultsTitle: "What we found",
    readAll: "Read all",
    error: "We could not check these medicines right now. Please try again in a moment.",
    demoNote: "Demo mode: seed data and template wording. Live databases and Grok are not connected.",
    counts: (n: number) => `${n} of ${MAX_MEDS} medicines`,
  },
  es: {
    h1: "Entienda sus medicamentos en palabras sencillas",
    sub: "Para cualquiera que haya salido de la farmacia con una bolsa de cajas sin saber cómo se combinan. Agregue lo que toma y lea o escuche lo que significa.",
    check: "Revisar mis medicamentos",
    checking: "Revisando…",
    demo: "Probar un ejemplo",
    clear: "Borrar lista",
    needMore: (n: number) => (n === 0 ? `Agregue al menos ${MIN_MEDS} medicamentos para revisarlos.` : `Agregue ${MIN_MEDS - n} más para revisar.`),
    ready: (n: number) => `${n} medicamentos listos para revisar.`,
    resultsTitle: "Lo que encontramos",
    readAll: "Leer todo",
    error: "No pudimos revisar estos medicamentos ahora. Intente de nuevo en un momento.",
    demoNote: "Modo demostración: datos de ejemplo y textos de plantilla. Las bases de datos en vivo y Grok no están conectados.",
    counts: (n: number) => `${n} de ${MAX_MEDS} medicamentos`,
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

  // One-time health check for the demo-mode note.
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

  const runCheck = useCallback(
    async (list: Med[], language: "en" | "es") => {
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
        checkedLang.current = language;
        requestAnimationFrame(() => resultsRef.current?.focus());
      } catch {
        setError(STRINGS[language].error);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // If the person switches language after checking, refresh the cards in that language.
  useEffect(() => {
    if (data && checkedLang.current !== lang && !loading) void runCheck(meds, lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const loadDemo = () => {
    setMeds(DEMO_SET);
    setData(null);
    setDoses([]);
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

  const readAllText = useMemo(() => {
    if (!data) return "";
    return [data.summary, ...data.cards.map((c) => cardSpeechText(c, lang))].join(" ");
  }, [data, lang]);

  return (
    <div className="space-y-10 py-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl sm:rounded-[48px] bg-md-surface-container px-6 py-10 sm:px-12 sm:py-14 shadow-sm">
        <BlurBackdrop variant="hero" />
        <div className="relative max-w-3xl space-y-4">
          <h1 className="text-headline sm:text-display">{t.h1}</h1>
          <p className="text-body text-md-on-surface-variant">{t.sub}</p>
          {demoMode && (
            <p className="inline-flex items-center gap-2 rounded-full bg-md-secondary-container/70 px-4 py-2 text-meta text-md-on-secondary-container">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {t.demoNote}
            </p>
          )}
        </div>
      </section>

      {/* Search + chips + check */}
      <section aria-labelledby="add-title" className="space-y-5">
        <h2 id="add-title" className="sr-only">
          {lang === "es" ? "Agregar medicamentos" : "Add medicines"}
        </h2>
        <MedSearch meds={meds} onAdd={addMed} max={MAX_MEDS} />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-meta text-md-on-surface-variant" aria-live="polite">
            {t.counts(meds.length)} · {meds.length < MIN_MEDS ? t.needMore(meds.length) : t.ready(meds.length)}
          </p>
          <div className="flex gap-2">
            <Button variant="text" size="sm" onClick={loadDemo}>
              {t.demo}
            </Button>
            {meds.length > 0 && (
              <Button variant="text" size="sm" onClick={clearAll}>
                {t.clear}
              </Button>
            )}
          </div>
        </div>

        <MedChips meds={meds} onRemove={removeMed} />

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="filled" size="lg" disabled={!canCheck} onClick={() => runCheck(meds, lang)} aria-busy={loading}>
            {loading ? t.checking : t.check}
          </Button>
        </div>

        {error && (
          <p role="alert" className="rounded-3xl bg-sev-major/10 px-5 py-3 text-body text-sev-major">
            {error}
          </p>
        )}
      </section>

      {/* Results */}
      {data && (
        <div ref={resultsRef} tabIndex={-1} className="space-y-10 scroll-mt-24 focus:outline-none">
          <section aria-labelledby="results-title" className="space-y-3">
            <h2 id="results-title" className="text-title">
              {t.resultsTitle}
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-body font-medium flex-1 min-w-[16rem]" aria-live="polite">
                {data.summary}
              </p>
              <ListenButton text={data.summary} />
            </div>
          </section>

          <InteractionGraph meds={meds} results={data.results} />

          <InteractionCardList cards={data.cards} results={data.results} />
        </div>
      )}

      {/* Dose explainer (dose module) */}
      {meds.length > 0 && <DoseExplainer meds={meds} onResult={onDoseResult} />}

      {/* Share sheet (voice/share module) */}
      {data && (
        <div className="flex flex-wrap items-center gap-3">
          <ShareSheetButton data={{ meds, cards: data.cards, doses, clinic: null }} />
        </div>
      )}

      {/* Read-all FAB */}
      {data && readAllText && (
        <div className="fixed bottom-6 right-6 z-40">
          <ListenButton variant="fab" label={t.readAll} text={readAllText} className="!w-auto !px-5 !h-14" />
        </div>
      )}
    </div>
  );
}
