"use client";

import { Card } from "@/components/ui/Card";
import { ListenButton } from "@/components/ui/ListenButton";
import { SEVERITY_ACCENT, SeverityChip, SEVERITY_LABEL } from "@/components/ui/SeverityChip";
import { useLang } from "@/components/LanguageContext";
import type { EvidenceSnippet, InteractionCard, InteractionResult, Severity } from "@/lib/types";

/** Stable DOM id for a pair card; order-independent so the graph can find it. */
export function cardId(rxcuiA: string, rxcuiB: string): string {
  const [x, y] = [rxcuiA, rxcuiB].sort();
  return `card-${x}-${y}`;
}

const ORDER: Severity[] = ["major", "moderate", "minor", "unknown"];

const STRINGS = {
  en: {
    groupTitle: { major: "Major interactions", moderate: "Moderate interactions", minor: "Minor interactions", unknown: "No listed interaction" } as Record<Severity, string>,
    whatHappens: "What happens",
    howSerious: "How serious",
    whatToDo: "What to do",
    ask: "Ask your pharmacist or doctor",
    evidence: "Evidence",
    evidenceHint: "Where this came from",
    noEvidence: "No label text was available for this pair.",
    source: { openfda: "From the label", ddinter: "From DDInter", seed: "Demo seed" } as Record<EvidenceSnippet["source"], string>,
    severityWord: { major: "major", moderate: "moderate", minor: "minor", unknown: "unknown" } as Record<Severity, string>,
    and: "and",
  },
  es: {
    groupTitle: { major: "Interacciones mayores", moderate: "Interacciones moderadas", minor: "Interacciones menores", unknown: "Sin interacción listada" } as Record<Severity, string>,
    whatHappens: "Qué pasa",
    howSerious: "Qué tan serio es",
    whatToDo: "Qué hacer",
    ask: "Pregunte a su farmacéutico o médico",
    evidence: "Evidencia",
    evidenceHint: "De dónde viene esto",
    noEvidence: "No había texto de etiqueta disponible para este par.",
    source: { openfda: "De la etiqueta", ddinter: "De DDInter", seed: "Datos de demostración" } as Record<EvidenceSnippet["source"], string>,
    severityWord: { major: "mayor", moderate: "moderada", minor: "menor", unknown: "desconocida" } as Record<Severity, string>,
    and: "y",
  },
};

export interface InteractionCardListProps {
  cards: InteractionCard[];
  results: InteractionResult[];
}

function findResult(card: InteractionCard, results: InteractionResult[]): InteractionResult | undefined {
  return results.find(
    (r) =>
      (r.a.name === card.drugA && r.b.name === card.drugB) || (r.a.name === card.drugB && r.b.name === card.drugA),
  );
}

/** Text a screen reader or the Listen button reads for one card, in natural order. */
export function cardSpeechText(card: InteractionCard, lang: "en" | "es"): string {
  const t = STRINGS[lang];
  return [
    `${card.drugA} ${t.and} ${card.drugB}. ${t.howSerious}: ${t.severityWord[card.severity]}.`,
    `${t.whatHappens}: ${card.whatHappens}`,
    `${t.howSerious}: ${card.howSerious}`,
    `${t.whatToDo}: ${card.whatToDo}`,
    `${t.ask}: ${card.askYourClinician}`,
  ].join(" ");
}

export function InteractionCardList({ cards, results }: InteractionCardListProps) {
  const { lang } = useLang();
  const t = STRINGS[lang];
  if (!cards.length) return null;

  return (
    <div className="space-y-8">
      {ORDER.map((sev) => {
        const group = cards.filter((c) => c.severity === sev);
        if (!group.length) return null;
        return (
          <section key={sev} aria-labelledby={`group-${sev}`}>
            <h2 id={`group-${sev}`} className="text-title mb-4 flex items-center gap-3">
              <span>{t.groupTitle[sev]}</span>
              <span className="text-meta font-normal text-md-on-surface-variant">({group.length})</span>
            </h2>
            <ul className="list-none p-0 m-0 space-y-4">
              {group.map((card, i) => {
                const r = findResult(card, results);
                const id = r ? cardId(r.a.rxcui, r.b.rxcui) : `card-${sev}-${i}`;
                const snippets = r?.evidenceSnippets ?? [];
                return (
                  <Card
                    key={id}
                    as="li"
                    id={id}
                    tabIndex={-1}
                    accentClass={SEVERITY_ACCENT[card.severity]}
                    className="scroll-mt-24 focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2"
                    aria-labelledby={`${id}-title`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-col gap-2 min-w-0">
                        <h3 id={`${id}-title`} className="text-title">
                          {card.drugA} + {card.drugB}
                        </h3>
                        <div>
                          <SeverityChip severity={card.severity} />
                          <span className="sr-only">{SEVERITY_LABEL[card.severity]}</span>
                        </div>
                      </div>
                      <ListenButton text={cardSpeechText(card, lang)} className="shrink-0" />
                    </div>

                    <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                      <Section label={t.whatHappens} text={card.whatHappens} />
                      <Section label={t.howSerious} text={card.howSerious} />
                      <Section label={t.whatToDo} text={card.whatToDo} />
                      <Section label={t.ask} text={card.askYourClinician} />
                    </dl>

                    <details className="mt-5 rounded-3xl bg-md-secondary-container/40 px-5 py-3 group">
                      <summary className="cursor-pointer text-label text-md-primary min-h-11 flex items-center rounded-full focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2">
                        {t.evidence} ({snippets.length}) · {t.evidenceHint}
                      </summary>
                      {snippets.length === 0 ? (
                        <p className="py-3 text-body text-md-on-surface-variant">{t.noEvidence}</p>
                      ) : (
                        <ul className="list-none p-0 m-0 py-2 space-y-3">
                          {snippets.map((s) => (
                            <li key={s.id} id={`ev-${s.id}`} className="text-body">
                              <span className="inline-flex items-center rounded-full bg-md-secondary-container px-3 h-8 text-meta font-medium text-md-on-secondary-container mr-2 align-middle">
                                {t.source[s.source]}
                              </span>
                              <span className="text-meta text-md-on-surface-variant align-middle">
                                {s.drug} · {s.section.replace(/_/g, " ")}
                              </span>
                              <p className="mt-1 text-md-on-surface-variant">{s.text}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </details>
                  </Card>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Section({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <dt className="text-meta font-medium uppercase tracking-wide text-md-on-surface-variant mb-1">{label}</dt>
      <dd className="text-body m-0">{text}</dd>
    </div>
  );
}
