"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, MessageSquare, Pill, type LucideIcon } from "lucide-react";
import { useLang } from "@/components/LanguageContext";
import { SeverityChip } from "@/components/ui/SeverityChip";

const T = {
  en: {
    eyebrow: "A little clarity, every day",
    desc: "Understand how food and medicine fit together. Make sense of your bottle, and find a rhythm for your day.",
    primary: "Start with my medicines",
    calendar: "My calendar",
    note: "No account needed. A space to understand.",
    rows: [
      { a: "Medicine 1", b: "", sev: "major" as const },
      { a: "Medicine 2", b: "", sev: "moderate" as const },
      { a: "Medicine 3", b: "", sev: "minor" as const },
    ],
    tiles: { meds: "My medicines", calendar: "Calendar", clinics: "Clinics", community: "Community" },
    days: ["M", "T", "W", "T", "F", "S", "S"],
    clinicPill: "1.9 miles · takes Medicaid",
    bubble1: "Nausea the first week?",
    bubble2: "Better with dinner.",
  },
  es: {
    eyebrow: "Un poco de claridad, cada día",
    desc: "Entienda cómo se relacionan sus alimentos y medicamentos. Lea su etiqueta y encuentre un ritmo para su día.",
    primary: "Empezar con mis medicamentos",
    calendar: "Abrir calendario",
    note: "Sin cuenta. Un espacio para entender.",
    rows: [
      { a: "Medicamento 1", b: "", sev: "major" as const },
      { a: "Medicamento 2", b: "", sev: "moderate" as const },
      { a: "Medicamento 3", b: "", sev: "minor" as const },
    ],
    tiles: { meds: "Mis medicamentos", calendar: "Calendario", clinics: "Clínicas", community: "Comunidad" },
    days: ["L", "M", "X", "J", "V", "S", "D"],
    clinicPill: "1.9 millas · acepta Medicaid",
    bubble1: "¿Náuseas la primera semana?",
    bubble2: "Mejor con la cena.",
  },
} as const;

/** One of the four tiles: icon + short title, then a tiny illustration. Whole tile is a link. */
function Tile({ href, icon: Icon, title, children }: { href: string; icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-xl bg-md-surface-container border border-md-outline p-3 sm:p-4 flex flex-col gap-3 hover:shadow-md transition-shadow duration-200 ease-md"
    >
      <span className="flex items-center gap-2 text-meta font-medium text-md-on-background">
        <Icon size={15} className="text-md-on-surface-variant" aria-hidden="true" />
        {title}
      </span>
      <span aria-hidden="true">{children}</span>
    </Link>
  );
}

/**
 * Landing: headline block on the left, four quiet tiles on the right. Nothing else.
 */
export function HomeHero() {
  const { lang } = useLang();
  const t = T[lang];
  return (
    <section className="editorial-hero !text-left !px-0 !pt-12 lg:!pt-20 !pb-12">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Left: the former top half */}
        <div>
          <p className="eyebrow mb-5">{t.eyebrow}</p>
          <h1>
            {lang === "es" ? (
              <>
                Sus medicamentos.
                <br />
                <em>La vida cotidiana.</em>
              </>
            ) : (
              <>
                Your medicines.
                <br />
                <em>Meet everyday life.</em>
              </>
            )}
          </h1>
          <p className="hero-description !mx-0">{t.desc}</p>
          <div className="flex flex-wrap gap-3">
            <Link className="hero-button" href="/meds#my-medicines">
              {t.primary}
              <ArrowRight size={17} />
            </Link>
            <Link className="hero-secondary" href="/meds#calendar">
              {t.calendar}
              <CalendarDays size={16} />
            </Link>
          </div>
          <p className="text-meta text-md-on-surface-variant mt-4">{t.note}</p>
        </div>

        {/* Right: four quiet tiles — my medicines, calendar, clinics, community */}
        <div className="rounded-2xl bg-md-surface-container-low border border-md-outline p-3 sm:p-5">
          <div className="grid grid-cols-2 gap-3">
            {/* My medicines */}
            <Tile href="/meds#my-medicines" icon={Pill} title={t.tiles.meds}>
              <ul className="space-y-2">
                {t.rows.map((r) => (
                  <li key={r.a} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="h-6 w-6 rounded-md bg-md-primary shrink-0" />
                      <span className="text-meta text-md-on-background truncate">{r.a}</span>
                    </span>
                    <SeverityChip severity={r.sev} className="scale-[0.8] origin-right" />
                  </li>
                ))}
              </ul>
            </Tile>

            {/* Calendar */}
            <Tile href="/meds#calendar" icon={CalendarDays} title={t.tiles.calendar}>
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-md-on-surface-variant">
                {t.days.map((d, i) => (
                  <span key={i}>{d}</span>
                ))}
                {Array.from({ length: 14 }, (_, i) => (
                  <span
                    key={i}
                    className={`h-6 rounded-md grid place-items-center ${
                      i === 9 ? "bg-md-primary text-md-on-primary" : "bg-md-surface-container-low"
                    }`}
                  >
                    {[2, 5, 9, 12].includes(i) && <span className={`h-1.5 w-1.5 rounded-full ${i === 9 ? "bg-md-on-primary" : "bg-md-primary"}`} />}
                  </span>
                ))}
              </div>
            </Tile>

            {/* Clinics */}
            <Tile href="/clinics" icon={MapPin} title={t.tiles.clinics}>
              <div className="relative h-16 rounded-lg bg-md-surface-container-low overflow-hidden">
                <span className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(#c8bfb1 1px, transparent 1px)", backgroundSize: "10px 10px" }} />
                <span className="absolute left-[38%] top-[30%] h-3 w-3 rounded-full bg-md-primary ring-4 ring-md-primary/15" />
                <span className="absolute left-[70%] top-[58%] h-2 w-2 rounded-full bg-md-on-surface-variant" />
                <span className="absolute left-[18%] top-[64%] h-2 w-2 rounded-full bg-md-on-surface-variant" />
              </div>
              <span className="mt-2 inline-flex items-center rounded-full bg-md-secondary-container px-2 h-6 text-[11px] text-md-on-background">
                {t.clinicPill}
              </span>
            </Tile>

            {/* Community */}
            <Tile href="/community" icon={MessageSquare} title={t.tiles.community}>
              <div className="space-y-2">
                <span className="block w-10/12 rounded-2xl rounded-bl-md bg-md-surface-container-low px-3 py-2 text-[11px] text-md-on-background">
                  {t.bubble1}
                </span>
                <span className="block w-9/12 ml-auto rounded-2xl rounded-br-md bg-md-primary px-3 py-2 text-[11px] text-md-on-primary">
                  {t.bubble2}
                </span>
              </div>
            </Tile>
          </div>
        </div>
      </div>
    </section>
  );
}
