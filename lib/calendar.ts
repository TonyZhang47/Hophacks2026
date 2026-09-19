/** Browser localStorage calendar. Same key and row shape as the Meds calendar panel. */

export const CALENDAR_KEY = "rxplain.calendar.v1";
export const CALENDAR_EVENT = "rxplain-calendar";

export type CalendarEntry = {
  id: string;
  medicine: string;
  scheduled: string;
  status: "planned" | "taken";
  takenAt?: string;
  note: string;
};

const TIME = /^\d{2}:\d{2}$/;
const SLOT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function localDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isCalendarEntry(e: unknown): e is CalendarEntry {
  if (!e || typeof e !== "object") return false;
  const x = e as CalendarEntry;
  return (
    typeof x.id === "string" &&
    typeof x.medicine === "string" &&
    typeof x.note === "string" &&
    SLOT.test(x.scheduled) &&
    (x.status === "planned" || x.status === "taken")
  );
}

export function loadCalendarEntries(): CalendarEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const data = JSON.parse(localStorage.getItem(CALENDAR_KEY) || "[]");
    return Array.isArray(data) ? data.filter(isCalendarEntry) : [];
  } catch {
    return [];
  }
}

export function saveCalendarEntries(next: CalendarEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CALENDAR_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(CALENDAR_EVENT));
}

/** Spread typical clock times for N doses a day. User can still edit each slot. */
export function suggestedTimes(timesPerDay: number | null | undefined): string[] {
  const n = Math.min(Math.max(Math.round(timesPerDay ?? 1) || 1, 1), 6);
  const slots: Record<number, string[]> = {
    1: ["08:00"],
    2: ["08:00", "20:00"],
    3: ["08:00", "14:00", "20:00"],
    4: ["08:00", "12:00", "16:00", "20:00"],
    5: ["08:00", "11:00", "14:00", "17:00", "20:00"],
    6: ["08:00", "10:00", "12:00", "14:00", "16:00", "20:00"],
  };
  return slots[n] ?? ["08:00"];
}

export function addPlannedDoses(opts: {
  medicine: string;
  times: string[];
  startDay?: string;
  days?: number;
  note?: string;
}): CalendarEntry[] {
  const medicine = opts.medicine.trim();
  const times = opts.times.map((t) => t.trim()).filter((t) => TIME.test(t));
  if (!medicine || !times.length) return [];
  const start = opts.startDay && /^\d{4}-\d{2}-\d{2}$/.test(opts.startDay) ? opts.startDay : localDay(new Date());
  const days = Math.min(Math.max(opts.days ?? 1, 1), 366);
  const note = (opts.note ?? "").trim().slice(0, 200);
  const existing = loadCalendarEntries();
  const added: CalendarEntry[] = [];
  const origin = new Date(`${start}T12:00`);
  for (let d = 0; d < days; d++) {
    const day = new Date(origin);
    day.setDate(origin.getDate() + d);
    const ymd = localDay(day);
    for (const time of times) {
      added.push({
        id: crypto.randomUUID(),
        medicine,
        scheduled: `${ymd}T${time}`,
        status: "planned",
        note,
      });
    }
  }
  const next = [...existing, ...added];
  saveCalendarEntries(next);
  return added;
}
