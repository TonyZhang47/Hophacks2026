"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Leaf, MapPin, MessageSquare, Pill, ScanLine, Volume2 } from "lucide-react";
import { useLang } from "@/components/LanguageContext";

const T = {
  en: {
    eyebrow: "A little clarity, every day",
    desc: "Understand how food and medicine fit together. Make sense of your bottle, and find a rhythm for your day.",
    primary: "Start with my medicines",
    calendar: "My calendar",
    note: "No account needed. A space to understand.",
    cards: [
      { icon: Pill, href: "/meds#my-medicines", title: "My medicines", body: "Add what you take and see how it meets your food." },
      { icon: ScanLine, href: "/meds", title: "Read my bottle", body: "Scan or type the directions and hear them in plain words." },
      { icon: MapPin, href: "/clinics", title: "Clinics near me", body: "Low-cost clinics by ZIP, with what they take." },
      { icon: MessageSquare, href: "/community", title: "Medication talk", body: "What other people noticed, side by side with the label." },
    ],
    strip: [
      { icon: Volume2, text: "Every panel can be read aloud" },
      { icon: Leaf, text: "Food and medicine, connected" },
      { icon: CalendarDays, text: "A calendar that stays on your device" },
    ],
  },
  es: {
    eyebrow: "Un poco de claridad, cada día",
    desc: "Entienda cómo se relacionan sus alimentos y medicamentos. Lea su etiqueta y encuentre un ritmo para su día.",
    primary: "Empezar con mis medicamentos",
    calendar: "Abrir calendario",
    note: "Sin cuenta. Un espacio para entender.",
    cards: [
      { icon: Pill, href: "/meds#my-medicines", title: "Mis medicamentos", body: "Agregue lo que toma y vea cómo se relaciona con su comida." },
      { icon: ScanLine, href: "/meds", title: "Leer mi frasco", body: "Escanee o escriba las indicaciones y escúchelas en palabras sencillas." },
      { icon: MapPin, href: "/clinics", title: "Clínicas cerca", body: "Clínicas de bajo costo por código postal, con lo que aceptan." },
      { icon: MessageSquare, href: "/community", title: "Conversación", body: "Lo que otras personas notaron, junto a la etiqueta." },
    ],
    strip: [
      { icon: Volume2, text: "Cada panel se puede escuchar" },
      { icon: Leaf, text: "Alimentos y medicamentos, conectados" },
      { icon: CalendarDays, text: "Un calendario que se queda en su dispositivo" },
    ],
  },
} as const;

/**
 * Landing: editorial headline on the left, four entry cards on the right, feature strip below.
 * Fills the page width instead of a narrow centered column.
 */
export function HomeHero() {
  const { lang } = useLang();
  const es = lang === "es";
  const t = T[lang];
  return (
    <section className="editorial-hero !text-left !px-0 !pt-10 !pb-4 lg:!pt-16">
      <div className="grid lg:grid-cols-[1.15fr_1fr] gap-10 lg:gap-14 items-center">
        <div>
          <p className="eyebrow mb-5">{t.eyebrow}</p>
          <h1>
            {es ? (
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

        <div className="food-map rounded-2xl p-4 sm:p-5 grid sm:grid-cols-2 gap-3">
          {t.cards.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.href + c.title}
                href={c.href}
                className="panel p-4 flex flex-col gap-2 hover:shadow-md transition-shadow duration-200 ease-md group"
              >
                <span className="h-9 w-9 rounded-lg bg-md-secondary-container grid place-items-center text-md-on-background">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="text-label font-semibold flex items-center gap-1">
                  {c.title}
                  <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                </span>
                <span className="text-meta text-md-on-surface-variant">{c.body}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <ul className="mt-10 grid sm:grid-cols-3 gap-3">
        {t.strip.map((f) => {
          const Icon = f.icon;
          return (
            <li key={f.text} className="panel px-4 py-3 flex items-center gap-3 text-meta text-md-on-surface-variant">
              <Icon size={16} className="shrink-0 text-md-on-background" aria-hidden="true" />
              {f.text}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
