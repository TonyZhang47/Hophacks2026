"use client";

import { useId, useMemo, useState } from "react";
import { Info, ShieldAlert } from "lucide-react";
import { useLang } from "@/components/LanguageContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ListenButton } from "@/components/ui/ListenButton";
import { TextField } from "@/components/ui/TextField";
import type { DoseInput, DoseResult, Med } from "@/lib/types";

export interface DoseExplainerProps {
  /** Meds already added on the Meds page; used to prefill the picker. */
  meds: Med[];
  /** Called whenever a dose result is produced (for the share sheet). */
  onResult?: (r: { input: DoseInput; result: DoseResult }) => void;
}

type Phase = "idle" | "parsing" | "confirm" | "checking" | "done";

const EXAMPLES = ["metformin 500 mg, 1 tablet twice a day with meals", "ibuprofen 200 mg, 5 tablets 4 times a day"];
const OTHER = "__other__";

const T = {
  en: {
    heading: "How much and when",
    intro:
      "Type the directions from your bottle. We'll read them back in plain language and check them against the official label. We never suggest a dose.",
    medLabel: "Which medicine?",
    other: "Another medicine",
    otherName: "Medicine name",
    directions: "Directions on the bottle",
    placeholder: "e.g. metformin 500 mg, 1 tablet twice a day with meals",
    tryOne: "Try one:",
    readBack: "Read it back",
    reading: "Reading…",
    isThisRight: "Is this right?",
    medicine: "Medicine",
    strength: "Strength",
    eachDose: "Each dose",
    howOften: "How often",
    withFood: "With food",
    asNeeded: "Only as needed",
    yes: "yes",
    no: "no",
    notSaid: "not said",
    notNamed: "not named",
    edit: "Edit",
    checkIt: "Yes, check it",
    checking: "Checking against the label…",
    timesADay: (n: number) => `${n} time${n === 1 ? "" : "s"} a day`,
    unit: (n: number, u: string) => `${n} ${u}${n === 1 || u === "mL" ? "" : "s"}`,
    checkWithPharmacist: "Check with your pharmacist",
    speakIntro: "Please check these directions with your pharmacist. ",
    whenToTake: "When to take it",
    askTitle: "Ask your pharmacist",
    whereFrom: "Where this came from",
    meta: (ceiling: boolean) => `Checked against the label · ceiling check: ${ceiling ? "yes" : "not available"}`,
    evidence: "From the official label",
    disclaimer: "Educational only. Talk with a pharmacist or doctor before changing how you take any medicine.",
    networkError: "Something went wrong. Please try again.",
    startOver: "Start over",
  },
  es: {
    heading: "Cuánto y cuándo",
    intro:
      "Escriba las indicaciones de su frasco. Se las leeremos en lenguaje sencillo y las compararemos con la etiqueta oficial. Nunca sugerimos una dosis.",
    medLabel: "¿Qué medicamento?",
    other: "Otro medicamento",
    otherName: "Nombre del medicamento",
    directions: "Indicaciones del frasco",
    placeholder: "ej. metformin 500 mg, 1 tablet twice a day with meals",
    tryOne: "Pruebe una:",
    readBack: "Léamelo",
    reading: "Leyendo…",
    isThisRight: "¿Es correcto?",
    medicine: "Medicamento",
    strength: "Concentración",
    eachDose: "Cada dosis",
    howOften: "Con qué frecuencia",
    withFood: "Con comida",
    asNeeded: "Solo si lo necesita",
    yes: "sí",
    no: "no",
    notSaid: "no se indica",
    notNamed: "sin nombre",
    edit: "Editar",
    checkIt: "Sí, verifíquelo",
    checking: "Comparando con la etiqueta…",
    timesADay: (n: number) => `${n} ${n === 1 ? "vez" : "veces"} al día`,
    unit: (n: number, u: string) => `${n} ${u}${n === 1 || u === "mL" ? "" : "s"}`,
    checkWithPharmacist: "Consulte con su farmacéutico",
    speakIntro: "Por favor consulte estas indicaciones con su farmacéutico. ",
    whenToTake: "Cuándo tomarlo",
    askTitle: "Pregunte a su farmacéutico",
    whereFrom: "De dónde viene esto",
    meta: (ceiling: boolean) => `Comparado con la etiqueta · verificación de máximo: ${ceiling ? "sí" : "no disponible"}`,
    evidence: "De la etiqueta oficial",
    disclaimer: "Solo con fines educativos. Hable con un farmacéutico o médico antes de cambiar cómo toma cualquier medicamento.",
    networkError: "Algo salió mal. Inténtelo de nuevo.",
    startOver: "Empezar de nuevo",
  },
} as const;

const UNIT_ES: Record<DoseInput["unitLabel"], string> = {
  tablet: "tableta",
  capsule: "cápsula",
  mL: "mL",
  puff: "inhalación",
  drop: "gota",
  patch: "parche",
  unit: "unidad",
};

/** Fail-closed text must never carry a digit. Strip defensively and flag it if it ever happens. */
function noDigits(s: string, field: string): string {
  if (/\d/.test(s)) {
    console.error(`[dose] fail-closed ${field} contained a digit; stripped before render`);
    return s.replace(/\d[\d,.]*/g, "").replace(/\s{2,}/g, " ").trim();
  }
  return s;
}

export function DoseExplainer({ meds, onResult }: DoseExplainerProps) {
  const { lang } = useLang();
  const t = T[lang];
  const selectId = useId();

  const [medChoice, setMedChoice] = useState<string>(meds[0]?.rxcui ?? OTHER);
  const [otherName, setOtherName] = useState("");
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [input, setInput] = useState<DoseInput | null>(null);
  const [result, setResult] = useState<DoseResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const selectedMed = useMemo(() => meds.find((m) => m.rxcui === medChoice) ?? null, [meds, medChoice]);
  const hasPicker = meds.length > 0;

  async function readBack() {
    if (!text.trim()) return;
    setErrorMsg("");
    setResult(null);
    setPhase("parsing");
    try {
      const med = selectedMed ?? (otherName.trim() ? { name: otherName.trim(), rxcui: "" } : undefined);
      const res = await fetch("/api/dose/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), med }),
      });
      if (!res.ok) throw new Error(`parse ${res.status}`);
      const data = (await res.json()) as { input: DoseInput };
      setInput(data.input);
      setPhase("confirm");
    } catch {
      setErrorMsg(t.networkError);
      setPhase("idle");
    }
  }

  async function checkIt() {
    if (!input) return;
    setErrorMsg("");
    setPhase("checking");
    try {
      const res = await fetch("/api/dose/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, lang }),
      });
      if (!res.ok) throw new Error(`explain ${res.status}`);
      const data = (await res.json()) as { result: DoseResult };
      setResult(data.result);
      setPhase("done");
      onResult?.({ input, result: data.result });
    } catch {
      setErrorMsg(t.networkError);
      setPhase("confirm");
    }
  }

  function reset() {
    setPhase("idle");
    setInput(null);
    setResult(null);
    setErrorMsg("");
  }

  const busy = phase === "parsing" || phase === "checking";

  return (
    <section aria-labelledby={`${selectId}-heading`} className="py-6 space-y-6">
      <div className="space-y-2">
        <h2 id={`${selectId}-heading`} className="text-headline">
          {t.heading}
        </h2>
        <p className="text-body text-md-on-surface-variant">{t.intro}</p>
      </div>

      {/* Input */}
      {(phase === "idle" || phase === "parsing") && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void readBack();
          }}
        >
          {hasPicker && (
            <div>
              <label htmlFor={selectId} className="block text-label text-md-on-surface-variant mb-1">
                {t.medLabel}
              </label>
              <select
                id={selectId}
                value={medChoice}
                onChange={(e) => setMedChoice(e.target.value)}
                className="w-full h-14 rounded-t-lg rounded-b-none bg-md-surface-container-low px-4 text-body text-md-on-background border-b-2 border-md-outline focus:border-md-primary transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2"
              >
                {meds.map((m) => (
                  <option key={m.rxcui} value={m.rxcui}>
                    {m.name}
                  </option>
                ))}
                <option value={OTHER}>{t.other}</option>
              </select>
            </div>
          )}
          {(!hasPicker || medChoice === OTHER) && (
            <TextField
              label={t.otherName}
              value={otherName}
              onChange={(e) => setOtherName(e.target.value)}
              autoComplete="off"
              placeholder="metformin"
            />
          )}
          <TextField
            label={t.directions}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.placeholder}
            autoComplete="off"
            maxLength={500}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-label text-md-on-surface-variant">{t.tryOne}</span>
            {EXAMPLES.map((ex) => (
              <Chip
                key={ex}
                selected={text === ex}
                onClick={() => {
                  setText(ex);
                  if (hasPicker) setMedChoice(OTHER);
                  setOtherName("");
                }}
              >
                {ex}
              </Chip>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" size="lg" disabled={busy || !text.trim()}>
              {phase === "parsing" ? t.reading : t.readBack}
            </Button>
          </div>
        </form>
      )}

      {/* Confirmation */}
      {(phase === "confirm" || phase === "checking") && input && (
        <Card as="section" aria-labelledby={`${selectId}-confirm`} className="space-y-4">
          <h3 id={`${selectId}-confirm`} className="text-title">
            {t.isThisRight}
          </h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-body">
            <Row label={t.medicine} value={input.drugName || t.notNamed} />
            <Row label={t.strength} value={input.strengthMg != null ? `${input.strengthMg} mg` : t.notSaid} />
            <Row
              label={t.eachDose}
              value={
                input.unitsPerDose != null
                  ? t.unit(input.unitsPerDose, lang === "es" ? UNIT_ES[input.unitLabel] : input.unitLabel)
                  : t.notSaid
              }
            />
            <Row label={t.howOften} value={input.timesPerDay != null ? t.timesADay(input.timesPerDay) : t.notSaid} />
            <Row label={t.withFood} value={input.withFood == null ? t.notSaid : input.withFood ? t.yes : t.no} />
            <Row label={t.asNeeded} value={input.asNeeded ? t.yes : t.no} />
          </dl>
          <p className="text-meta text-md-on-surface-variant">“{input.userText}”</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={() => void checkIt()} disabled={busy}>
              {phase === "checking" ? t.checking : t.checkIt}
            </Button>
            <Button variant="text" onClick={() => setPhase("idle")} disabled={busy}>
              {t.edit}
            </Button>
          </div>
        </Card>
      )}

      {errorMsg && (
        <p role="alert" className="text-body text-md-error">
          {errorMsg}
        </p>
      )}

      {/* Result */}
      <div aria-live="polite" aria-atomic="true">
        {phase === "done" && result && (
          <>
            {result.status === "consistent" ? <ConsistentCard result={result} lang={lang} /> : <FailClosedCard result={result} lang={lang} />}
            <div className="mt-4">
              <Button variant="text" onClick={reset}>
                {t.startOver}
              </Button>
            </div>
          </>
        )}
      </div>

      <p className="text-meta text-md-on-surface-variant flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
        <span>{t.disclaimer}</span>
      </p>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-label text-md-on-surface-variant">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function ConsistentCard({ result, lang }: { result: DoseResult; lang: "en" | "es" }) {
  const t = T[lang];
  // Only validated strings reach the speaker.
  const audioText = [result.plainDose, result.maxPerDayLine, result.timing.join(", "), result.missedDoseLine]
    .filter(Boolean)
    .join(" ");
  return (
    <Card as="article" accentClass="border-l-sev-minor" className="rounded-3xl p-8 shadow-lg space-y-5" aria-label={t.heading}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <p className="text-title font-medium">{result.plainDose}</p>
        <ListenButton text={audioText} size="lg" className="shrink-0" />
      </div>
      {result.maxPerDayLine && <p className="text-body">{result.maxPerDayLine}</p>}
      {result.timing.length > 0 && (
        <div>
          <p className="text-label text-md-on-surface-variant mb-2">{t.whenToTake}</p>
          <ul className="flex flex-wrap gap-2" aria-label={t.whenToTake}>
            {result.timing.map((line) => (
              <li key={line}>
                <Chip asSpan>{line}</Chip>
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.missedDoseLine && <p className="text-body">{result.missedDoseLine}</p>}
      {result.askYourPharmacist && (
        <div className="rounded-3xl bg-md-secondary-container text-md-on-secondary-container px-5 py-4">
          <p className="text-label mb-1">{t.askTitle}</p>
          <p className="text-body">{result.askYourPharmacist}</p>
        </div>
      )}
      <Evidence quotes={result.labelQuotes} title={t.whereFrom} />
      <p className="text-meta text-md-on-surface-variant">{t.meta(result.ceilingChecked)}</p>
    </Card>
  );
}

/**
 * Fail-closed card. Deliberately renders nothing from the input and no dose line:
 * only the reason, a question, and the label text as evidence.
 */
function FailClosedCard({ result, lang }: { result: DoseResult; lang: "en" | "es" }) {
  const t = T[lang];
  const reason = noDigits(result.reason ?? "", "reason");
  const ask = noDigits(result.askYourPharmacist ?? "", "askYourPharmacist");
  return (
    <Card as="article" className="bg-md-secondary-container text-md-on-secondary-container rounded-3xl p-8 shadow-lg space-y-5" aria-label={t.checkWithPharmacist}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <span className="inline-flex items-center gap-2 rounded-full h-10 px-4 text-label border border-sev-major text-sev-major bg-transparent">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          {t.checkWithPharmacist}
        </span>
        <ListenButton text={t.speakIntro + reason} size="lg" className="shrink-0" />
      </div>
      {reason && <p className="text-title font-medium">{reason}</p>}
      {ask && (
        <div>
          <p className="text-label text-md-on-surface-variant mb-1">{t.askTitle}</p>
          <p className="text-body">{ask}</p>
        </div>
      )}
      <Evidence quotes={result.labelQuotes} title={t.evidence} open />
    </Card>
  );
}

function Evidence({ quotes, title, open }: { quotes: DoseResult["labelQuotes"]; title: string; open?: boolean }) {
  if (!quotes.length) return null;
  return (
    <details className="rounded-3xl bg-md-surface-container-low px-5 py-3 group" open={open}>
      <summary className="cursor-pointer text-label text-md-primary rounded-full focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2 py-1">
        {title}
      </summary>
      <ul className="mt-3 space-y-3">
        {quotes.map((q) => (
          <li key={q.chunkId} className="text-body text-md-on-surface-variant">
            <blockquote className="border-l-4 border-md-outline/40 pl-4">“{q.text}”</blockquote>
            <p className="text-meta mt-1">{q.chunkId}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}
