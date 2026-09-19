"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Leaf, MapPin, MessageSquare, Pill, Volume2 } from "lucide-react";
import { useLang } from "@/components/LanguageContext";
import { SeverityChip } from "@/components/ui/SeverityChip";

const T = {
  en: {
    eyebrow: "A little clarity, every day",
    desc: "Understand how food and medicine fit together. Make sense of your bottle, and find a rhythm for your day.",
    primary: "Start with my medicines",
    calendar: "My calendar",
    note: "No account needed. A space to understand.",
    left: { eyebrow: "For your medicines", title: "Read what your bottle actually says", cta: "Open my medicines", href: "/meds#my-medicines" },
    right: { eyebrow: "For your community", title: "Find care nearby and hear from others", cta: "See clinics", href: "/clinics" },
    mock: {
      greeting: "Tom, here's what we found",
      nav: ["My medicines", "Calendar", "Clinics", "Community"],
      rows: [
        { a: "Metformin", b: "Alcohol", sev: "major" as const },
        { a: "Warfarin", b: "Leafy greens · vitamin K", sev: "moderate" as const },
        { a: "Ibuprofen", b: "Food or milk", sev: "minor" as const },
      ],
      whyTitle: "Your directions, in plain words",
      why: "Take 1 tablet by mouth, 2 times a day, with food. The label says do not take more than 2,550 mg in a day.",
      listen: "Listen",
      clinic: { name: "Mountain Laurel Medical Center", meta: "1.9 miles · Oakland, MD", pills: ["Takes Medicaid & Medicare", "Sliding fee"] },
      terms: ["stomach · 4", "sleep · 3", "dizziness · 2"],
      post: "Nausea the first two weeks, then it settled once I took it with dinner.",
      postBy: "quiet-otter · metformin",
      fromLabel: "From the label",
    },
    strip: [
      { icon: Volume2, text: "Every panel can be read aloud" },
      { icon: Leaf, text: "Food and medicine, connected" },
      { icon: CalendarDays, text: "A calendar that keeps track of your medicines" },
    ],
  },
  es: {
    eyebrow: "Un poco de claridad, cada día",
    desc: "Entienda cómo se relacionan sus alimentos y medicamentos. Lea su etiqueta y encuentre un ritmo para su día.",
    primary: "Empezar con mis medicamentos",
    calendar: "Abrir calendario",
    note: "Sin cuenta. Un espacio para entender.",
    left: { eyebrow: "Para sus medicamentos", title: "Lea lo que realmente dice su frasco", cta: "Abrir mis medicamentos", href: "/meds#my-medicines" },
    right: { eyebrow: "Para su comunidad", title: "Encuentre atención cerca y escuche a otros", cta: "Ver clínicas", href: "/clinics" },
    mock: {
      greeting: "Tom, esto es lo que encontramos",
      nav: ["Mis medicamentos", "Calendario", "Clínicas", "Comunidad"],
      rows: [
        { a: "Metformina", b: "Alcohol", sev: "major" as const },
        { a: "Warfarina", b: "Verduras de hoja · vitamina K", sev: "moderate" as const },
        { a: "Ibuprofeno", b: "Comida o leche", sev: "minor" as const },
      ],
      whyTitle: "Sus indicaciones, en palabras sencillas",
      why: "Tome 1 tableta por la boca, 2 veces al día, con comida. La etiqueta dice no tomar más de 2,550 mg en un día.",
      listen: "Escuchar",
      clinic: { name: "Mountain Laurel Medical Center", meta: "1.9 millas · Oakland, MD", pills: ["Acepta Medicaid y Medicare", "Tarifa según ingresos"] },
      terms: ["estómago · 4", "sueño · 3", "mareo · 2"],
      post: "Náuseas las primeras dos semanas; luego se calmó cuando la tomé con la cena.",
      postBy: "quiet-otter · metformina",
      fromLabel: "De la etiqueta",
    },
    strip: [
      { icon: Volume2, text: "Cada panel se puede escuchar" },
      { icon: Leaf, text: "Alimentos y medicamentos, conectados" },
      { icon: CalendarDays, text: "Un calendario que lleva el control de sus medicamentos" },
    ],
  },
} as const;

/** Section header in the reference style: gray eyebrow, dark title, pill CTA on the right. */
function PreviewHeader({ eyebrow, title, cta, href }: { eyebrow: string; title: string; cta: string; href: string }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <p className="text-body text-md-on-surface-variant">{eyebrow}</p>
        <h2 className="text-title sm:text-headline font-semibold tracking-tight mt-0.5">{title}</h2>
      </div>
      <Link href={href} className="hero-button !py-2.5 !px-5 shrink-0 text-meta">
        {cta}
      </Link>
    </div>
  );
}

/** A quiet, static "app window" — muted frame, small type, no icons-in-boxes. */
function Window({ children, sidebar }: { children: React.ReactNode; sidebar: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-md-surface-container-low border border-md-outline p-3 sm:p-5 overflow-hidden" aria-hidden="true">
      <div className="grid grid-cols-[104px_1fr] sm:grid-cols-[132px_1fr] gap-3 min-h-[320px]">
        <div className="rounded-xl bg-md-surface-container border border-md-outline p-3 text-meta text-md-on-surface-variant space-y-2.5">{sidebar}</div>
        <div className="space-y-3 min-w-0">{children}</div>
      </div>
    </div>
  );
}

export function HomeHero() {
  const { lang } = useLang();
  const t = T[lang];
  const m = t.mock;
  return (
    <section className="editorial-hero !pb-4 !pt-12 lg:!pt-16">
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
      <p className="hero-description">{t.desc}</p>
      <div className="flex flex-wrap justify-center gap-3">
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

      {/* Two product previews, side by side, like the reference. */}
      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 mt-16 text-left">
        <div>
          <PreviewHeader {...t.left} />
          <Window
            sidebar={
              <>
                <p className="flex items-center gap-1.5 text-md-on-background font-medium"><Pill size={14} /> RxPlain</p>
                {m.nav.map((n, i) => (
                  <p key={n} className={i === 0 ? "text-md-on-background font-medium" : ""}>
                    {i === 0 ? "• " : ""}
                    {n}
                  </p>
                ))}
              </>
            }
          >
            <div className="rounded-xl bg-md-surface-container border border-md-outline p-3 sm:p-4">
              <p className="text-meta font-medium text-md-on-background mb-3">{m.greeting}</p>
              <ul className="space-y-2.5">
                {m.rows.map((r) => (
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
              <p className="eyebrow mb-2">{m.whyTitle}</p>
              <p className="text-meta text-md-on-background">{m.why}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-md-outline px-2.5 h-7 text-[11px] text-md-on-background">
                <Volume2 size={12} /> {m.listen}
              </span>
            </div>
          </Window>
        </div>

        <div>
          <PreviewHeader {...t.right} />
          <Window
            sidebar={
              <>
                <p className="flex items-center gap-1.5 text-md-on-background font-medium"><MapPin size={14} /> {lang === "es" ? "Clínicas" : "Clinics"}</p>
                <p className="text-md-on-background font-medium">• 21550</p>
                <p>{lang === "es" ? "Radio 25 mi" : "25 mi radius"}</p>
                <p className="flex items-center gap-1.5 pt-2 text-md-on-background font-medium"><MessageSquare size={14} /> {lang === "es" ? "Comunidad" : "Community"}</p>
                <p>{lang === "es" ? "Metformina" : "Metformin"}</p>
              </>
            }
          >
            <div className="rounded-xl bg-md-surface-container border border-md-outline p-3 sm:p-4">
              <p className="text-meta font-medium text-md-on-background">{m.clinic.name}</p>
              <p className="text-[11px] text-md-on-surface-variant mt-0.5">{m.clinic.meta}</p>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {m.clinic.pills.map((p) => (
                  <span key={p} className="rounded-full bg-md-secondary-container px-2 h-6 inline-flex items-center text-[11px] text-md-on-background">
                    {p}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-xl bg-md-surface-container border border-md-outline p-3 sm:p-4">
              <div className="flex flex-wrap gap-1.5 mb-3">
                {m.terms.map((x) => (
                  <span key={x} className="rounded-full border border-md-outline px-2 h-6 inline-flex items-center text-[11px] text-md-on-background">
                    {x}
                  </span>
                ))}
              </div>
              <p className="text-meta text-md-on-background">“{m.post}”</p>
              <p className="text-[11px] text-md-on-surface-variant mt-1.5">{m.postBy}</p>
            </div>
            <div className="rounded-xl bg-md-surface-container border border-md-outline p-3 sm:p-4">
              <p className="eyebrow mb-1.5">{m.fromLabel}</p>
              <div className="space-y-1.5">
                <span className="block h-2 rounded bg-md-outline w-11/12" />
                <span className="block h-2 rounded bg-md-outline w-9/12" />
              </div>
            </div>
          </Window>
        </div>
      </div>

      <ul className="mt-12 grid sm:grid-cols-3 gap-3 text-left">
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
