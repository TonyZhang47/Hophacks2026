"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Check,
  Pencil,
  Trash2,
} from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { TextField, Select } from "@/components/ui/TextField";
import { useLang } from "@/components/LanguageContext";
import {
  CALENDAR_EVENT,
  CALENDAR_KEY,
  loadCalendarEntries,
  localDay,
  saveCalendarEntries,
  type CalendarEntry,
} from "@/lib/calendar";
import type { Med } from "@/lib/types";

export { localDay };

export function MedicationCalendar({ meds }: { meds: Med[] }) {
  const { lang } = useLang();
  const es = lang === "es";
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [time, setTime] = useState("08:00");
  const [medicine, setMedicine] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"planned" | "taken">("planned");
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const today = localDay(new Date());
    setDay(today);
    setMonth(today.slice(0, 7));
    try {
      setEntries(loadCalendarEntries());
    } catch {
      setError(
        "Saved entries could not be loaded. New entries will stay in this tab.",
      );
    }
    setReady(true);
    function refresh() {
      try {
        setEntries(loadCalendarEntries());
      } catch {
        /* keep current rows */
      }
    }
    window.addEventListener(CALENDAR_EVENT, refresh);
    function onStorage(e: StorageEvent) {
      if (e.key === null || e.key === CALENDAR_KEY) refresh();
    }
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CALENDAR_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  function save(next: CalendarEntry[]) {
    setEntries(next);
    try {
      saveCalendarEntries(next);
      setError("");
    } catch {
      setError(
        es
          ? "No se pudo guardar. Los cambios solo están en esta pestaña."
          : "Could not save to this device. Changes are only in this tab.",
      );
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!medicine.trim() || !day || !time) return;
    const date = new Date(`${day}T${time}`);
    if (status === "taken" && date > new Date()) {
      setError(
        es
          ? "Una toma realizada no puede estar en el futuro."
          : "A taken dose cannot be in the future.",
      );
      return;
    }
    const added: CalendarEntry[] = [
      {
        id: editing || crypto.randomUUID(),
        medicine: medicine.trim(),
        scheduled: `${localDay(date)}T${time}`,
        status,
        takenAt: status === "taken" ? date.toISOString() : undefined,
        note: note.trim(),
      },
    ];
    save([...entries.filter((x) => x.id !== editing), ...added]);
    setEditing(null);
    setMessage(es ? "Entrada guardada." : "Calendar updated.");
  }
  function moveMonth(delta: number) {
    const d = new Date(`${month}-01T12:00`);
    d.setMonth(d.getMonth() + delta);
    setMonth(localDay(d).slice(0, 7));
  }
  const start = month ? new Date(`${month}-01T12:00`) : null;
  const total = start
    ? new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
    : 0;
  const offset = start ? (start.getDay() + 6) % 7 : 0;
  const today = localDay(new Date());
  const selected = entries
    .filter((e) => e.scheduled.startsWith(day))
    .sort((a, b) => a.scheduled.localeCompare(b.scheduled));
  return (
    <Panel id="calendar" className="scroll-mt-24">
      <PanelHeader
        icon={CalendarDays}
        title={es ? "Su calendario de medicamentos" : "Your medicine calendar"}
        subtitle={
          es
            ? "Registre las tomas realizadas y planificadas. Guardado solo en este navegador; sin notificaciones."
            : "A little structure for your day. Track planned and taken doses. Saved in this browser; no notifications."
        }
      />
      <div className={editing ? "grid lg:grid-cols-[1.1fr_1fr] gap-8" : ""}>
        <div>
          <div className="flex justify-between items-center mb-4">
            <Button
              variant="text"
              size="sm"
              aria-label="Previous month"
              onClick={() => moveMonth(-1)}
              disabled={!ready}
            >
              <ChevronLeft size={18} />
            </Button>
            <h3 className="text-title">
              {start?.toLocaleDateString(es ? "es" : "en-US", {
                month: "long",
                year: "numeric",
              })}
            </h3>
            <Button
              variant="text"
              size="sm"
              aria-label="Next month"
              onClick={() => moveMonth(1)}
              disabled={!ready}
            >
              <ChevronRight size={18} />
            </Button>
          </div>
          <div
            className="grid grid-cols-7 text-center gap-1"
            aria-label={es ? "Calendario mensual" : "Monthly calendar"}
          >
            {(es
              ? ["L", "M", "X", "J", "V", "S", "D"]
              : ["M", "T", "W", "T", "F", "S", "S"]
            ).map((s, i) => (
              <span
                key={i}
                className="text-meta pb-2 text-md-on-surface-variant"
              >
                {s}
              </span>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <span key={`blank${i}`} />
            ))}
            {Array.from({ length: total }, (_, i) => {
              const date = `${month}-${String(i + 1).padStart(2, "0")}`;
              const n = entries.filter((e) =>
                e.scheduled.startsWith(date),
              ).length;
              return (
                <button
                  key={date}
                  onClick={() => {
                    setDay(date);
                    setEditing(null);
                    setMessage("");
                  }}
                  aria-label={`${date}, ${n} entries`}
                  aria-pressed={day === date}
                  aria-current={today === date ? "date" : undefined}
                  className={`calendar-day ${day === date ? "selected" : ""} ${today === date ? "today" : ""}`}
                >
                  <span>{i + 1}</span>
                  <span className="text-[10px] h-3">
                    {n
                      ? `${n} ${es ? (n === 1 ? "toma" : "tomas") : n === 1 ? "dose" : "doses"}`
                      : ""}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex justify-between items-center mt-5">
            <span className="text-meta">
              {es
                ? "● Día con tomas registradas"
                : "Doses appear beneath each date"}
            </span>
            <Button
              variant="text"
              size="sm"
              onClick={() => {
                setDay(today);
                setMonth(today.slice(0, 7));
              }}
            >
              {es ? "Hoy" : "Today"}
            </Button>
          </div>
        </div>
        {/* Entries are added from "How much and when" above; this form only edits an existing one. */}
        {editing && (
        <div>
          <form onSubmit={submit} className="space-y-3">
            <h3 className="text-title">{es ? "Editar entrada" : "Edit entry"}</h3>
            <TextField
              label={es ? "Medicamento" : "Calendar medicine"}
              list="calendar-medicines"
              required
              maxLength={100}
              value={medicine}
              onChange={(e) => setMedicine(e.target.value)}
              placeholder={
                es
                  ? "Escriba o elija un medicamento"
                  : "Type or choose a medicine"
              }
            />
            <datalist id="calendar-medicines">
              {meds.map((m) => (
                <option key={m.rxcui} value={m.name} />
              ))}
            </datalist>
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label={es ? "Fecha" : "Date"}
                type="date"
                required
                value={day}
                onChange={(e) => {
                  setDay(e.target.value);
                  if (e.target.value) setMonth(e.target.value.slice(0, 7));
                }}
              />
              <TextField
                label={es ? "Hora" : "Time"}
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            <Select
              label={es ? "Estado" : "Status"}
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              <option value="planned">{es ? "Planificada" : "Planned"}</option>
              <option value="taken">
                {es ? "Ya tomada" : "Already taken"}
              </option>
            </Select>
            <TextField
              label={
                es
                  ? "Nota opcional de su etiqueta"
                  : "Optional note from your label"
              }
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                es ? "Sus propias indicaciones" : "Your own directions"
              }
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={!ready}>
                {editing
                  ? es
                    ? "Guardar cambios"
                    : "Save changes"
                  : es
                    ? "Agregar al calendario"
                    : "Add to calendar"}
              </Button>
              {editing && (
                <Button variant="text" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              )}
            </div>
            <p role="status" className="text-meta">
              {message}
            </p>
            <p role="alert" className="text-meta text-md-error">
              {error}
            </p>
          </form>
        </div>
        )}
      </div>
      {!editing && error && (
        <p role="alert" className="text-meta text-md-error mt-3">
          {error}
        </p>
      )}
      <div className="border-t border-md-outline mt-6 pt-5">
        <h3 className="text-title mb-3">
          {day
            ? new Date(`${day}T12:00`).toLocaleDateString(es ? "es" : "en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })
            : ""}
        </h3>
        {!selected.length ? (
          <p className="text-md-on-surface-variant">
            {es
              ? "Nada registrado para este día."
              : "Nothing on the calendar for this day yet."}
          </p>
        ) : (
          <ul className="space-y-3">
            {selected.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap gap-4 items-center bg-md-surface-container-low rounded-xl p-4"
              >
                <time className="font-medium">{e.scheduled.slice(11)}</time>
                <div className="flex-1 min-w-32">
                  <p className="font-medium">{e.medicine}</p>
                  <p className="text-meta text-md-on-surface-variant">
                    {e.status === "taken"
                      ? es
                        ? "Tomada"
                        : "Taken"
                      : es
                        ? "Planificada"
                        : "Planned"}
                    {e.takenAt
                      ? ` · ${new Date(e.takenAt).toLocaleTimeString(es ? "es" : "en-US", { hour: "2-digit", minute: "2-digit" })}`
                      : ""}
                    {e.note ? ` · ${e.note}` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outlined"
                  onClick={() =>
                    save(
                      entries.map((x) =>
                        x.id === e.id
                          ? {
                              ...x,
                              status:
                                x.status === "taken" ? "planned" : "taken",
                              takenAt:
                                x.status === "taken"
                                  ? undefined
                                  : new Date().toISOString(),
                            }
                          : x,
                      ),
                    )
                  }
                >
                  <Check size={15} />
                  {e.status === "taken"
                    ? es
                      ? "Deshacer"
                      : "Undo taken"
                    : es
                      ? "Marcar tomada ahora"
                      : "Taken now"}
                </Button>
                <button
                  aria-label={`Edit ${e.medicine} at ${e.scheduled.slice(11)}`}
                  className="p-2"
                  onClick={() => {
                    setEditing(e.id);
                    setMedicine(e.medicine);
                    setDay(e.scheduled.slice(0, 10));
                    setTime(e.scheduled.slice(11));
                    setStatus(e.status);
                    setNote(e.note);
                  }}
                >
                  <Pencil size={16} />
                </button>
                <button
                  aria-label={`Delete ${e.medicine} at ${e.scheduled.slice(11)}`}
                  className="p-2"
                  onClick={() => save(entries.filter((x) => x.id !== e.id))}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-meta text-md-on-surface-variant mt-5">
        {es
          ? "Registre únicamente el horario que le indicaron. El calendario no recomienda dosis ni cambios de tratamiento."
          : "Record the schedule you were given. This calendar does not recommend doses or treatment changes."}
      </p>
    </Panel>
  );
}
