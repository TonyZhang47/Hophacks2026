"use client";

import { ArrowDown, ArrowRight } from "lucide-react";
import { useLang } from "@/components/LanguageContext";

export function HomeHero() {
  const { lang } = useLang();
  const es = lang === "es";
  return (
    <section className="editorial-hero pb-8">
      <p className="eyebrow mb-5">
        {es ? "Un poco de claridad, cada día" : "A little clarity, every day"}
      </p>
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
      <p className="hero-description">
        {es
          ? "Entienda cómo se relacionan sus alimentos y medicamentos. Lea su etiqueta y encuentre un ritmo para su día."
          : "Understand how food and medicine fit together. Make sense of your bottle, and find a rhythm for your day."}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <a className="hero-button" href="/meds#my-medicines">
          {es ? "Empezar con mis medicamentos" : "Start with my medicines"}
          <ArrowRight size={17} />
        </a>
        <a className="hero-secondary" href="/meds#calendar">
          {es ? "Abrir calendario" : "My calendar"}
          <ArrowDown size={16} />
        </a>
      </div>
      <p className="text-meta text-md-on-surface-variant mt-4">
        {es ? "Sin cuenta. Un espacio para entender." : "No account needed. A space to understand."}
      </p>
    </section>
  );
}
