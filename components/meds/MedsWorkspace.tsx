"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Leaf, Pill } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ListenButton } from "@/components/ui/ListenButton";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { SeverityChip, SEVERITY_LABELS } from "@/components/ui/SeverityChip";
import { Select } from "@/components/ui/TextField";
import { useLang } from "@/components/LanguageContext";
import { MedSearch } from "@/components/meds/MedSearch";
import { MedChips } from "@/components/meds/MedChips";
import { FoodMap } from "@/components/food/FoodMap";
import { StatRow } from "@/components/meds/StatRow";
import { DoseExplainer } from "@/components/dose/DoseExplainer";
import { MedicationCalendar } from "@/components/meds/MedicationCalendar";
import { checkFoods, type FoodResult } from "@/lib/food";
import type { DoseInput, DoseResult, Med } from "@/lib/types";
const DEMO: Med[] = [
  { name: "Warfarin", rxcui: "11289", ingredientName: "warfarin" },
  { name: "Simvastatin", rxcui: "36567", ingredientName: "simvastatin" },
  { name: "Ibuprofen", rxcui: "5640", ingredientName: "ibuprofen" },
];
export function MedsWorkspace() {
  const { lang } = useLang();
  const es = lang === "es";
  const [meds, setMeds] = useState<Med[]>([]);
  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState(false);
  const [filter, setFilter] = useState("all");
  const [doses, setDoses] = useState<
    { input: DoseInput; result: DoseResult }[]
  >([]);
  const [storageError, setStorageError] = useState("");
  const resultsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("rxplain.meds") || "[]");
      if (Array.isArray(raw))
        setMeds(
          raw
            .filter(
              (m) =>
                m && typeof m.name === "string" && typeof m.rxcui === "string",
            )
            .slice(0, 10),
        );
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem("rxplain.meds", JSON.stringify(meds));
      } catch {
        setStorageError(
          "Your medicine list could not be saved to this device.",
        );
      }
  }, [meds, ready]);
  const add = useCallback((m: Med) => {
    setMeds((old) =>
      old.some((x) => x.rxcui === m.rxcui) || old.length >= 10
        ? old
        : [...old, m],
    );
    setChecked(false);
  }, []);
  const results: FoodResult[] = checked ? checkFoods(meds, lang) : [];
  const counts = checked
    ? { major: 0, moderate: 0, minor: 0, unknown: 0 }
    : null;
  if (counts) results.forEach((r) => counts[r.severity]++);
  return (
    <div className="space-y-8 pt-6 lg:pt-8 pb-8">
      <div className="grid lg:grid-cols-[0.85fr_1.5fr] gap-6 items-start">
        <Panel id="my-medicines" className="scroll-mt-24">
          <PanelHeader
            icon={Pill}
            title={es ? "01 / Mis medicamentos" : "01 / My medicines"}
            subtitle={
              es
                ? "Busque un nombre o escríbalo manualmente."
                : "Search a name, or enter it yourself."
            }
          />
          <div className="space-y-4">
            <MedSearch meds={meds} onAdd={add} />
            <MedChips
              meds={meds}
              onRemove={(id) => {
                setMeds(meds.filter((m) => m.rxcui !== id));
                setDoses(doses.filter((d) => d.input.rxcui !== id));
                setChecked(false);
              }}
            />
            <Button
              className="w-full"
              disabled={!meds.length}
              onClick={() => {
                setChecked(true);
                setFilter("all");
                requestAnimationFrame(() => resultsRef.current?.focus());
              }}
            >
              <Leaf size={17} />
              {es ? "Revisar alimentos" : "Check food interactions"}
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="text"
                onClick={() => {
                  setMeds(DEMO);
                  setChecked(true);
                  setDoses([]);
                }}
              >
                {es ? "Probar un ejemplo" : "Try an example"}
              </Button>
              <Button
                size="sm"
                variant="text"
                disabled={!meds.length}
                onClick={() => {
                  setMeds([]);
                  setChecked(false);
                  setDoses([]);
                }}
              >
                {es ? "Borrar lista" : "Clear list"}
              </Button>
            </div>
            <p className="text-meta text-md-on-surface-variant">
              {es
                ? "Guía limitada con fuentes. No todas las combinaciones están incluidas."
                : "A limited, sourced guide. Coverage is not exhaustive; missing information is always marked unknown."}
            </p>
            {storageError && <p role="alert">{storageError}</p>}
          </div>
        </Panel>
        <Panel>
          <PanelHeader
            icon={Leaf}
            title={
              es
                ? "02 / La conexión con sus alimentos"
                : "02 / The food connection"
            }
            subtitle={
              es
                ? "Una mirada más clara a lo que va junto."
                : "A clearer picture of what goes together."
            }
          />
          <FoodMap results={results} onSelect={() => setFilter("all")} />
          <div className="mt-5 pt-5 border-t border-md-outline">
            <p className="eyebrow mb-3">{es ? "Clave de niveles" : "Key to the levels"}</p>
            <StatRow counts={counts} medCount={meds.length} maxMeds={10} compact />
          </div>
        </Panel>
      </div>
      {checked && (
      <Panel
        ref={resultsRef}
        tabIndex={-1}
        className="scroll-mt-24"
        aria-label="Food interaction results"
      >
        <PanelHeader
          title={es ? "Qué significa para usted" : "What it means for you"}
          actions={
            <Select
              label="Filter food results"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">
                {es ? "Todos los niveles" : "All levels"}
              </option>
              {(["major", "moderate", "minor", "unknown"] as const).map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_LABELS[lang][s]}
                </option>
              ))}
            </Select>
          }
        />
        <div aria-live="polite" className="grid md:grid-cols-2 gap-4">
          {results
            .filter((r) => filter === "all" || r.severity === filter)
            .map((r) => (
              <article
                key={r.id}
                id={`food-${r.id}`}
                tabIndex={-1}
                className="food-result rounded-xl border border-md-outline p-5 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="eyebrow">{r.medicine.name}</p>
                  <SeverityChip severity={r.severity} />
                </div>
                <h3 className="text-title">{r.food}</h3>
                <p>{r.explanation}</p>
                <p className="text-md-on-surface-variant">{r.guidance}</p>
                <div className="flex justify-between items-center gap-3 pt-2">
                  {r.source ? (
                    <a
                      href={r.source}
                      target="_blank"
                      rel="noreferrer"
                      className="text-meta underline underline-offset-4"
                    >
                      {r.source.includes("fda.gov") ? "FDA" : "MedlinePlus"} ↗
                    </a>
                  ) : (
                    <span className="text-meta">
                      {es ? "Sin entrada verificada" : "No verified entry"}
                    </span>
                  )}
                  <ListenButton
                    text={`${r.medicine.name}. ${r.food}. ${r.severity}. ${r.explanation} ${r.guidance}`}
                    label={es ? "Escuchar" : "Listen"}
                    variant="outlined"
                    size="sm"
                  />
                </div>
              </article>
            ))}
        </div>
        {!results.some((r) => filter === "all" || r.severity === filter) && (
          <p>
            {es
              ? "No hay resultados en este nivel."
              : "No results at this level."}
          </p>
        )}
        <p className="text-meta text-md-on-surface-variant mt-5">
          {es
            ? "Los niveles son ayudas de lectura de esta guía, no clasificaciones clínicas de MedlinePlus. Consulte antes de cambiar su dieta o medicamentos."
            : "Levels are this guide’s reading aids, not clinical ratings assigned by MedlinePlus. Check with a pharmacist before changing your diet or medicines."}
        </p>
      </Panel>
      )}
      <DoseExplainer
        meds={meds}
        onResult={(r) =>
          setDoses((old) => [
            ...old.filter((d) => d.input.rxcui !== r.input.rxcui),
            r,
          ])
        }
      />
      <MedicationCalendar meds={meds} />
    </div>
  );
}
