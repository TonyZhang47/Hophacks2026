"use client";

import { useId, useMemo, useState } from "react";
import { Clock, Info, ShieldAlert } from "lucide-react";
import { useLang } from "@/components/LanguageContext";
import { ScanBottle } from "@/components/dose/ScanBottle";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ListenButton } from "@/components/ui/ListenButton";
import { KeyValue, Panel, PanelHeader } from "@/components/ui/Panel";
import { PlainText } from "@/components/ui/PlainText";
import { StatusPill } from "@/components/ui/SeverityChip";
import { Select, TextField } from "@/components/ui/TextField";
import { capitalize, displayName, genericFor, shortName } from "@/lib/plainNames";
import { addPlannedDoses, suggestedTimes } from "@/lib/calendar";
import type { DoseInput, DoseResult, Med } from "@/lib/types";

export interface DoseExplainerProps {
  /** Meds already added on the Meds page; used to prefill the picker. */
  meds: Med[];
  /** Called whenever a dose result is produced (for the share sheet). */
  onResult?: (r: { input: DoseInput; result: DoseResult }) => void;
}

type Phase = "idle" | "parsing" | "confirm" | "checking" | "done";

const OTHER = "__other__";
const MAX_DIRECTIONS = 500;

const T = {
  en: {
    heading: "How much and when",
    intro:
      "Type or scan the directions on your bottle. We read them back in plain language and check them against the official label. We never suggest a dose.",
    listen: "Listen",
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
    youWrote: "You wrote",
    edit: "Edit",
    checkIt: "Yes, check it",
    checking: "Checking against the label…",
    timesADay: (n: number) => `${n} time${n === 1 ? "" : "s"} a day`,
    unit: (n: number, u: string) => `${n} ${u}${n === 1 || u === "mL" ? "" : "s"}`,
    yourDirections: "Your directions, in plain words",
    checkWithPharmacist: "Check with your pharmacist",
    speakIntro: "Please check these directions with your pharmacist. ",
    whenToTake: "When to take it",
    askTitle: "Ask your pharmacist",
    whereFrom: "Where this came from",
    meta: (ceiling: boolean) => `Checked against the label · ceiling check: ${ceiling ? "yes" : "not available"}`,
    evidence: "From the official label",
    noLabel: "We could not find official label text for this medicine.",
    noLabelHelp:
      "Official label text is the FDA-approved drug label — the same source pharmacists use. We look it up by this medicine's name. If nothing is on file, we cannot check your directions against that source. That can happen with a store-brand or combination product we cannot match, a supplement, a compounded medicine, or a name we do not recognize. Follow what your own bottle says, and ask a pharmacist to confirm.",
    disclaimer: "Educational only. Talk with a pharmacist or doctor before changing how you take any medicine.",
    networkError: "Something went wrong. Please try again.",
    startOver: "Add another medication",
    addToCalendar: "Add this to my calendar",
    calendarHint:
      "Saved only in this browser. This is a log of the times you choose — not a reminder or a recommended schedule.",
    calendarMedicine: "Calendar medicine name",
    calendarTimes: "Times",
    addTime: "Add a time",
    removeTime: "Remove time",
    slotsHint: (n: number) => `${n} time${n === 1 ? "" : "s"} a day from your directions — adjust as needed.`,
    calendarRepeat: "Repeat daily until",
    calendarRepeatHint: "Leave as today for a single day.",
    calendarNote: "Optional note",
    calendarSaved: "Added to your calendar.",
    calendarFailed: "Could not save to the calendar on this device.",
  },
  es: {
    heading: "Cuánto y cuándo",
    intro:
      "Escriba o escanee las indicaciones de su frasco. Se las leemos en lenguaje sencillo y las comparamos con la etiqueta oficial. Nunca sugerimos una dosis.",
    listen: "Escuchar",
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
    youWrote: "Usted escribió",
    edit: "Editar",
    checkIt: "Sí, verifíquelo",
    checking: "Comparando con la etiqueta…",
    timesADay: (n: number) => `${n} ${n === 1 ? "vez" : "veces"} al día`,
    unit: (n: number, u: string) => `${n} ${u}${n === 1 || u === "mL" ? "" : "s"}`,
    yourDirections: "Sus indicaciones, en palabras sencillas",
    checkWithPharmacist: "Consulte con su farmacéutico",
    speakIntro: "Por favor consulte estas indicaciones con su farmacéutico. ",
    whenToTake: "Cuándo tomarlo",
    askTitle: "Pregunte a su farmacéutico",
    whereFrom: "De dónde viene esto",
    meta: (ceiling: boolean) => `Comparado con la etiqueta · verificación de máximo: ${ceiling ? "sí" : "no disponible"}`,
    evidence: "De la etiqueta oficial",
    noLabel: "No encontramos el texto oficial de la etiqueta de este medicamento.",
    noLabelHelp:
      "El texto oficial de la etiqueta es la ficha aprobada por la FDA, la misma fuente que usan los farmacéuticos. La buscamos por el nombre de este medicamento. Si no hay nada registrado, no podemos comparar sus indicaciones con esa fuente. Puede pasar con una marca de tienda o un producto combinado que no reconocemos, un suplemento, un medicamento compuesto o un nombre que no identificamos. Siga lo que dice su propio frasco y pida a un farmacéutico que lo confirme.",
    disclaimer: "Solo con fines educativos. Hable con un farmacéutico o médico antes de cambiar cómo toma cualquier medicamento.",
    networkError: "Algo salió mal. Inténtelo de nuevo.",
    startOver: "Agregar otro medicamento",
    addToCalendar: "Agregar a mi calendario",
    calendarHint:
      "Se guarda solo en este navegador. Es un registro de los horarios que elija, no un recordatorio ni una pauta de dosis.",
    calendarMedicine: "Nombre en el calendario",
    calendarTimes: "Horarios",
    addTime: "Agregar horario",
    removeTime: "Quitar horario",
    slotsHint: (n: number) => `${n} ${n === 1 ? "vez" : "veces"} al día según sus indicaciones — ajuste si hace falta.`,
    calendarRepeat: "Repetir a diario hasta",
    calendarRepeatHint: "Deje la fecha de hoy para un solo día.",
    calendarNote: "Nota opcional",
    calendarSaved: "Agregado a su calendario.",
    calendarFailed: "No se pudo guardar en el calendario de este dispositivo.",
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

/** YYYY-MM-DD in local time. */
function localDayString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** Number of calendar days from today through `until` (inclusive), at least 1, at most a year. */
function daysThrough(until: string) {
  const end = new Date(`${until}T12:00`);
  const start = new Date(`${localDayString(new Date())}T12:00`);
  if (Number.isNaN(end.getTime())) return 1;
  return Math.min(Math.max(Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1, 1), 366);
}

/** Fail-closed text must never carry a digit. Strip defensively and flag it if it ever happens. */
function noDigits(s: string, field: string): string {
  if (/\d/.test(s)) {
    console.error(`[dose] fail-closed ${field} contained a digit; stripped before render`);
    return s.replace(/\d[\d,.]*/g, "").replace(/\s{2,}/g, " ").trim();
  }
  return s;
}

/** The generic (ingredient) name we compare on, for a med from the list or a scanned label. */
function genericKey(name: string, ingredientName?: string): string {
  const base = (ingredientName || genericFor(name) || name).toLowerCase().trim();
  return base.replace(/\s*\(.*\)$/, "");
}

/** Match a drug name read off a label to one of the person's meds (brand or generic). */
function matchMed(meds: Med[], drugName: string): Med | null {
  const key = genericKey(drugName);
  if (!key) return null;
  return (
    meds.find((m) => genericKey(m.name, m.ingredientName) === key) ??
    meds.find((m) => {
      const mk = genericKey(m.name, m.ingredientName);
      return mk.startsWith(key) || key.startsWith(mk);
    }) ??
    null
  );
}

function howOftenDisplay(input: DoseInput, t: (typeof T)["en"] | (typeof T)["es"]): string {
  if (input.howOftenText) return input.howOftenText;
  if (input.timesPerDay != null) return t.timesADay(input.timesPerDay);
  return t.notSaid;
}

/** Only validated strings reach the speaker. The header Listen button reads this for the whole box. */
function speechFor(
  result: DoseResult | null,
  input: DoseInput | null,
  t: (typeof T)["en"] | (typeof T)["es"],
): string {
  if (result) {
    if (result.status === "consistent") {
      return [result.plainDose, result.maxPerDayLine, result.timing.join(", "), result.missedDoseLine, result.askYourPharmacist]
        .filter(Boolean)
        .join(" ");
    }
    const reason = noDigits(result.reason ?? "", "reason");
    const ask = noDigits(result.askYourPharmacist ?? "", "askYourPharmacist");
    const help = reason === t.noLabel ? t.noLabelHelp : "";
    return [t.speakIntro, reason, help, ask].filter(Boolean).join(" ");
  }
  if (input) {
    return [
      t.isThisRight,
      `${t.medicine}: ${input.drugName || t.notNamed}.`,
      `${t.howOften}: ${howOftenDisplay(input, t)}.`,
      `${t.youWrote}: ${input.userText}`,
    ].join(" ");
  }
  return `${t.heading}. ${t.intro}`;
}

export function DoseExplainer({ meds, onResult }: DoseExplainerProps) {
  const { lang } = useLang();
  const t = T[lang];
  const id = useId();

  const [medChoice, setMedChoice] = useState<string>(meds[0]?.rxcui ?? OTHER);
  const [otherName, setOtherName] = useState("");
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [input, setInput] = useState<DoseInput | null>(null);
  const [result, setResult] = useState<DoseResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [addToCalendar, setAddToCalendar] = useState(false);
  const [calName, setCalName] = useState("");
  const [calTimes, setCalTimes] = useState<string[]>(["08:00"]);
  const [calUntil, setCalUntil] = useState(() => localDayString(new Date()));
  const [calNote, setCalNote] = useState("");
  const [calMsg, setCalMsg] = useState("");

  const selectedMed = useMemo(() => meds.find((m) => m.rxcui === medChoice) ?? null, [meds, medChoice]);
  const hasPicker = meds.length > 0;

  function medHintFor(choice: string, other: string): Med | undefined {
    const m = meds.find((x) => x.rxcui === choice);
    if (m) return m;
    return other.trim() ? { name: other.trim(), rxcui: "" } : undefined;
  }

  async function readBack(directions = text, med: Med | undefined = medHintFor(medChoice, otherName)) {
    const trimmed = directions.trim();
    if (!trimmed) return;
    setErrorMsg("");
    setResult(null);
    setPhase("parsing");
    try {
      const res = await fetch("/api/dose/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed.slice(0, MAX_DIRECTIONS), med }),
      });
      if (!res.ok) throw new Error(`parse ${res.status}`);
      const data = (await res.json()) as { input: DoseInput };
      setInput(data.input);
      setAddToCalendar(false);
      setCalName(data.input.drugName || otherName.trim() || med?.name || "");
      setCalTimes(suggestedTimes(data.input.timesPerDay));
      setCalUntil(localDayString(new Date()));
      setCalNote(data.input.howOftenText || "");
      setCalMsg("");
      setPhase("confirm");
    } catch {
      setErrorMsg(t.networkError);
      setPhase("idle");
    }
  }

  /** ScanBottle → fill the field, pick the medicine, and read it back right away. */
  function handleScan(scanned: string, hint?: { drugName?: string }) {
    const joined = scanned
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .join(", ")
      .slice(0, MAX_DIRECTIONS);
    setText(joined);
    let med: Med | undefined;
    const drug = hint?.drugName?.trim() ?? "";
    const match = drug ? matchMed(meds, drug) : null;
    if (match) {
      setMedChoice(match.rxcui);
      med = match;
    } else {
      setMedChoice(OTHER);
      const name = capitalize(drug);
      setOtherName(name);
      med = name ? { name, rxcui: "" } : undefined;
    }
    void readBack(joined, med);
  }

  async function checkIt() {
    if (!input) return;
    setErrorMsg("");
    setCalMsg("");
    if (addToCalendar) {
      try {
        const name = calName.trim() || input.drugName.trim();
        const added = name
          ? addPlannedDoses({
              medicine: name,
              times: calTimes,
              days: daysThrough(calUntil),
              note: calNote,
            })
          : [];
        setCalMsg(added.length ? t.calendarSaved : t.calendarFailed);
      } catch {
        setCalMsg(t.calendarFailed);
      }
    }
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
    setCalMsg("");
    setAddToCalendar(false);
  }

  const busy = phase === "parsing" || phase === "checking";
  const speech = speechFor(phase === "done" ? result : null, phase === "confirm" || phase === "checking" ? input : null, t);

  // Confirmation: show the common name ("Metformin (also sold as Glucophage)").
  const confirmMedName = input
    ? selectedMed
      ? displayName(selectedMed)
      : input.drugName
        ? displayName({ name: input.drugName, rxcui: input.rxcui })
        : t.notNamed
    : "";

  return (
    <Panel aria-label={t.heading}>
      <PanelHeader
        icon={Clock}
        title={t.heading}
        subtitle={t.intro}
        actions={<ListenButton size="sm" variant="outlined" label={t.listen} text={speech} getText={() => speechFor(phase === "done" ? result : null, phase === "confirm" || phase === "checking" ? input : null, t)} />}
      />

      <div className="space-y-4">
        {/* Entry: scan on the left, type on the right */}
        {(phase === "idle" || phase === "parsing") && (
          <div className="grid sm:grid-cols-2 gap-4">
            <ScanBottle onText={handleScan} disabled={busy} />
            <form
              className="space-y-3 min-w-0"
              onSubmit={(e) => {
                e.preventDefault();
                void readBack();
              }}
            >
              {hasPicker && (
                <Select label={t.medLabel} value={medChoice} onChange={(e) => setMedChoice(e.target.value)} className="w-full">
                  {meds.map((m) => {
                    const s = shortName(m);
                    return (
                      <option key={m.rxcui} value={m.rxcui}>
                        {s.brands.length ? `${s.generic} · ${s.brands.join(", ")}` : s.generic}
                      </option>
                    );
                  })}
                  <option value={OTHER}>{t.other}</option>
                </Select>
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
                maxLength={MAX_DIRECTIONS}
              />
              <Button type="submit" size="md" disabled={busy || !text.trim()}>
                {phase === "parsing" ? t.reading : t.readBack}
              </Button>
            </form>
          </div>
        )}

        {/* Confirmation well */}
        {(phase === "confirm" || phase === "checking") && input && (
          <section aria-labelledby={`${id}-confirm`} className="bg-md-surface-container-low rounded-xl p-4 space-y-3">
            <h3 id={`${id}-confirm`} className="eyebrow">
              {t.isThisRight}
            </h3>
            <div>
              <KeyValue k={t.medicine} v={confirmMedName} />
              <KeyValue k={t.strength} v={input.strengthMg != null ? `${input.strengthMg} mg` : t.notSaid} />
              <KeyValue
                k={t.eachDose}
                v={
                  input.unitsPerDose != null
                    ? t.unit(input.unitsPerDose, lang === "es" ? UNIT_ES[input.unitLabel] : input.unitLabel)
                    : t.notSaid
                }
              />
              <KeyValue k={t.howOften} v={howOftenDisplay(input, t)} />
              <KeyValue k={t.withFood} v={input.withFood == null ? t.notSaid : input.withFood ? t.yes : t.no} />
              <KeyValue k={t.asNeeded} v={input.asNeeded ? t.yes : t.no} />
            </div>
            <p className="text-meta text-md-on-surface-variant">
              {t.youWrote}: “{input.userText}”
            </p>
            <label className="flex items-start gap-2 text-label">
              <input
                type="checkbox"
                className="mt-1"
                checked={addToCalendar}
                onChange={(e) => setAddToCalendar(e.target.checked)}
                disabled={busy}
              />
              <span>{t.addToCalendar}</span>
            </label>
            {addToCalendar && (
              <div className="space-y-3 rounded-lg border border-md-outline bg-md-surface-container p-3">
                <p className="text-meta text-md-on-surface-variant">{t.calendarHint}</p>
                <TextField
                  label={t.calendarMedicine}
                  value={calName}
                  onChange={(e) => setCalName(e.target.value)}
                  maxLength={100}
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  {calTimes.map((time, i) => (
                    <div key={i} className="flex items-end gap-1">
                      <TextField
                        className="flex-1"
                        label={`${t.calendarTimes} ${i + 1}`}
                        type="time"
                        value={time}
                        onChange={(e) =>
                          setCalTimes((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
                        }
                        required
                      />
                      {calTimes.length > 1 && (
                        <Button
                          variant="text"
                          size="sm"
                          className="h-11 !px-2"
                          aria-label={`${t.removeTime} ${i + 1}`}
                          onClick={() => setCalTimes((prev) => prev.filter((_, j) => j !== i))}
                          disabled={busy}
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-meta text-md-on-surface-variant">
                    {input?.timesPerDay ? t.slotsHint(input.timesPerDay) : ""}
                  </p>
                  <Button
                    variant="text"
                    size="sm"
                    onClick={() => setCalTimes((prev) => (prev.length >= 12 ? prev : [...prev, "12:00"]))}
                    disabled={busy || calTimes.length >= 12}
                  >
                    + {t.addTime}
                  </Button>
                </div>
                <TextField
                  label={t.calendarRepeat}
                  type="date"
                  min={localDayString(new Date())}
                  value={calUntil}
                  onChange={(e) => setCalUntil(e.target.value || localDayString(new Date()))}
                  hint={t.calendarRepeatHint}
                  disabled={busy}
                />
                <TextField
                  label={t.calendarNote}
                  value={calNote}
                  onChange={(e) => setCalNote(e.target.value)}
                  maxLength={200}
                />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button size="md" onClick={() => void checkIt()} disabled={busy}>
                {phase === "checking" ? t.checking : t.checkIt}
              </Button>
              <Button variant="text" size="md" onClick={() => setPhase("idle")} disabled={busy}>
                {t.edit}
              </Button>
            </div>
            {calMsg && (
              <p role="status" className="text-meta text-md-on-surface-variant">
                {calMsg}
              </p>
            )}
          </section>
        )}

        {errorMsg && (
          <p role="alert" className="text-body text-md-error">
            {errorMsg}
          </p>
        )}

        {/* Result */}
        <div aria-live="polite" aria-atomic="true" className="space-y-3">
          {phase === "done" && result && (
            <>
              {result.status === "consistent" ? <ConsistentWell result={result} lang={lang} /> : <FailClosedWell result={result} lang={lang} />}
              {calMsg && (
                <p role="status" className="text-meta text-md-on-surface-variant">
                  {calMsg}
                </p>
              )}
              <Button variant="text" size="sm" onClick={reset}>
                {t.startOver}
              </Button>
            </>
          )}
        </div>

        <p className="text-meta text-md-on-surface-variant flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{t.disclaimer}</span>
        </p>
      </div>
    </Panel>
  );
}

function ConsistentWell({ result, lang }: { result: DoseResult; lang: "en" | "es" }) {
  const t = T[lang];
  return (
    <article className="bg-md-surface-container-low rounded-xl p-4 space-y-4" aria-label={t.yourDirections}>
      <p className="eyebrow">{t.yourDirections}</p>
      <p className="text-title">{result.plainDose}</p>
      {result.maxPerDayLine && <PlainText as="p" className="text-body" text={result.maxPerDayLine} />}
      {result.timing.length > 0 && (
        <div>
          <p className="text-meta text-md-on-surface-variant mb-2">{t.whenToTake}</p>
          <ul className="flex flex-wrap gap-2" aria-label={t.whenToTake}>
            {result.timing.map((line) => (
              <li key={line}>
                <Chip asSpan>{line}</Chip>
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.missedDoseLine && <PlainText as="p" className="text-body" text={result.missedDoseLine} />}
      {result.askYourPharmacist && (
        <div className="rounded-lg bg-md-surface-container border border-md-outline px-4 py-3">
          <p className="eyebrow mb-1">{t.askTitle}</p>
          <PlainText as="p" className="text-body" text={result.askYourPharmacist} />
        </div>
      )}
      <Evidence quotes={result.labelQuotes} title={t.whereFrom} />
      <p className="text-meta text-md-on-surface-variant">{t.meta(result.ceilingChecked)}</p>
    </article>
  );
}

/**
 * Fail-closed well. Deliberately renders nothing from the input and no dose line:
 * only the reason (digit-free), a question, and the label text as evidence.
 */
function FailClosedWell({ result, lang }: { result: DoseResult; lang: "en" | "es" }) {
  const t = T[lang];
  const reason = noDigits(result.reason ?? "", "reason");
  const ask = noDigits(result.askYourPharmacist ?? "", "askYourPharmacist");
  const noLabel = reason === t.noLabel;
  return (
    <article className="bg-md-surface-container-low rounded-xl p-4 space-y-4" aria-label={t.checkWithPharmacist}>
      <StatusPill tone="error">
        <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
        {t.checkWithPharmacist}
      </StatusPill>
      {reason && <p className="text-title">{reason}</p>}
      {noLabel && <p className="text-body text-md-on-surface-variant">{t.noLabelHelp}</p>}
      {ask && (
        <div className="rounded-lg bg-md-surface-container border border-md-outline px-4 py-3">
          <p className="eyebrow mb-1">{t.askTitle}</p>
          <p className="text-body">{ask}</p>
        </div>
      )}
      <Evidence quotes={result.labelQuotes} title={t.evidence} open />
    </article>
  );
}

function Evidence({ quotes, title, open }: { quotes: DoseResult["labelQuotes"]; title: string; open?: boolean }) {
  if (!quotes.length) return null;
  return (
    <details className="rounded-lg border border-md-outline bg-md-surface-container px-4 py-2 group" open={open}>
      <summary className="cursor-pointer text-label text-md-on-background rounded-full focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2 py-1">
        {title}
      </summary>
      <ul className="mt-3 space-y-3">
        {quotes.map((q) => (
          <li key={q.chunkId} className="text-body text-md-on-surface-variant">
            <blockquote className="border-l-4 border-md-outline pl-3">
              “<PlainText text={q.text} />”
            </blockquote>
            <p className="text-meta mt-1">{q.chunkId}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}
