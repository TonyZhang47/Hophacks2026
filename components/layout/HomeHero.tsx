"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Pill, Volume2 } from "lucide-react";
import { useLang } from "@/components/LanguageContext";
import { SeverityChip } from "@/components/ui/SeverityChip";

const T = {
  en: {
    eyebrow: "A little clarity, every day",
    desc: "Understand how food and medicine fit together. Make sense of your bottle, and find a rhythm for your day.",
    primary: "Start with my medicines",
    calendar: "My calendar",
    note: "No account needed. A space to understand.",
    nav: ["My medicines", "Calendar", "Clinics", "Community"],
    greeting: "Tom, here's what we found",
    rows: [
      { a: "Metformin", b: "Alcohol", sev: "major" as const },
      { a: "Warfarin", b: "Leafy greens · vitamin K", sev: "moderate" as const },
      { a: "Ibuprofen", b: "Food or milk", sev: "minor" as const },
    ],
    whyTitle: "Your directions, in plain words",
    why: "Take 1 tablet by mouth, 2 times a day, with food.",
    listen: "Listen",
    clinicTitle: "Near you",
    clinic: { name: "Mountain Laurel Medical Center", meta: "1.9 miles · Takes Medicaid & Medicare" },
  },
  es: {
    eyebrow: "Un poco de claridad, cada día",
    desc: "Entienda cómo se relacionan sus alimentos y medicamentos. Lea su etiqueta y encuentre un ritmo para su día.",
    primary: "Empezar con mis medicamentos",
    calendar: "Abrir calendario",
    note: "Sin cuenta. Un espacio para entender.",
    nav: ["Mis medicamentos", "Calendario", "Clínicas", "Comunidad"],
    greeting: "Tom, esto es lo que encontramos",
    rows: [
      { a: "Metformina", b: "Alcohol", sev: "major" as const },
      { a: "Warfarina", b: "Verduras de hoja · vitamina K", sev: "moderate" as const },
      { a: "Ibuprofeno", b: "Comida o leche", sev: "minor" as const },
    ],
    whyTitle: "Sus indicaciones, en palabras sencillas",
    why: "Tome 1 tableta por la boca, 2 veces al día, con comida.",
    listen: "Escuchar",
    clinicTitle: "Cerca de usted",
    clinic: { name: "Mountain Laurel Medical Center", meta: "1.9 millas · Acepta Medicaid y Medicare" },
  },
} as const;

/**
 * Landing: headline block on the left, one quiet product preview on the right. Nothing else.
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

        {/* Right: one combined preview window */}
        <div className="rounded-2xl bg-md-surface-container-low border border-md-outline p-3 sm:p-5" aria-hidden="true">
          <div className="grid grid-cols-[104px_1fr] sm:grid-cols-[132px_1fr] gap-3">
            <div className="rounded-xl bg-md-surface-container border border-md-outline p-3 text-meta text-md-on-surface-variant space-y-2.5">
              <p className="flex items-center gap-1.5 text-md-on-background font-medium">
                <Pill size={14} /> RxPlain
              </p>
              {t.nav.map((n, i) => (
                <p key={n} className={i === 0 ? "text-md-on-background font-medium" : ""}>
                  {i === 0 ? "• " : ""}
                  {n}
                </p>
              ))}
            </div>
            <div className="space-y-3 min-w-0">
              <div className="rounded-xl bg-md-surface-container border border-md-outline p-3 sm:p-4">
                <p className="text-meta font-medium text-md-on-background mb-3">{t.greeting}</p>
                <ul className="space-y-2.5">
                  {t.rows.map((r) => (
                    <li key={r.a} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="h-8 w-8 rounded-lg bg-md-primary shrink-0" />
                        <span className="min-w-0">
                          <span className="block text-meta font-medium text-md-on-background truncate">{r.a}</span>
                          <span className="block text-[11px] text-md-on-surface-variant truncate">{r.b}</span>
                        </span>
                      </span>
                      <SeverityChip severity={r.sev} className="scale-90 origin-right" />
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl bg-md-surface-container border border-md-outline p-3 sm:p-4">
                <p className="eyebrow mb-2">{t.whyTitle}</p>
                <p className="text-meta text-md-on-background">{t.why}</p>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-md-outline px-2.5 h-7 text-[11px] text-md-on-background">
                  <Volume2 size={12} /> {t.listen}
                </span>
              </div>
              <div className="rounded-xl bg-md-surface-container border border-md-outline p-3 sm:p-4">
                <p className="eyebrow mb-2 flex items-center gap-1.5">
                  <MapPin size={12} /> {t.clinicTitle}
                </p>
                <p className="text-meta font-medium text-md-on-background">{t.clinic.name}</p>
                <p className="text-[11px] text-md-on-surface-variant mt-0.5">{t.clinic.meta}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
