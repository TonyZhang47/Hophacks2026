"use client";

import { Card } from "@/components/ui/Card";
import { ListenButton } from "@/components/ui/ListenButton";
import { PlainText } from "@/components/ui/PlainText";
import { SEVERITY_ACCENT, SeverityChip } from "@/components/ui/SeverityChip";
import { useLang } from "@/components/LanguageContext";
import { shortName } from "@/lib/plainNames";
import type { EvidenceSnippet, InteractionCard, InteractionResult, Severity } from "@/lib/types";

/** Stable DOM id for a pair card; order-independent so the graph can find it. */
export function cardId(rxcuiA: string, rxcuiB: string): string {
  const [x, y] = [rxcuiA, rxcuiB].sort();
  return `card-${x}-${y}`;
}

export type SeverityFilter = Severity | "all";

const STRINGS = {
  en: {
    whatHappens: "What happens",
    howSerious: "How serious",
    whatToDo: "What to do",
    ask: "Ask your pharmacist or doctor",
    evidence: "Evidence",
    evidenceHint: "where this came from",
    noEvidence: "No label text was available for this pair.",
    source: { openfda: "From the label", ddinter: "From DDInter", seed: "Demo seed" } as Record<EvidenceSnippet["source"], string>,
    severityWord: { major: "major", moderate: "moderate", minor: "minor", unknown: "unknown" } as Record<Severity, string>,
    and: "and",
    listen: "Read this card",
    noneInFilter: "No pairs at this level.",
  },
  es: {
    whatHappens: "Qué pasa",
    howSerious: "Qué tan serio es",
    whatToDo: "Qué hacer",
    ask: "Pregunte a su farmacéutico o médico",
    evidence: "Evidencia",
    evidenceHint: "de dónde viene esto",
    noEvidence: "No había texto de etiqueta disponible para este par.",
    source: { openfda: "De la etiqueta", ddinter: "De DDInter", seed: "Datos de demostración" } as Record<EvidenceSnippet["source"], string>,
    severityWord: { major: "mayor", moderate: "moderada", minor: "menor", unknown: "desconocida" } as Record<Severity, string>,
    and: "y",
    listen: "Leer esta tarjeta",
    noneInFilter: "No hay pares en este nivel.",
  },
};

export interface InteractionCardListProps {
  cards: InteractionCard[];
  results: InteractionResult[];
  /** Show only one severity (default: all). */
  filter?: SeverityFilter;
}

export function findResult(card: InteractionCard, results: InteractionResult[]): InteractionResult | undefined {
  return results.find(
    (r) =>
      (r.a.name === card.drugA && r.b.name === card.drugB) || (r.a.name === card.drugB && r.b.name === card.drugA),
  );
}

/** Pair title: generics only ("Ibuprofen + Warfarin"); brands go in a muted line under it. */
function pairTitle(card: InteractionCard, r?: InteractionResult): string {
  return r ? `${shortName(r.a).generic} + ${shortName(r.b).generic}` : `${card.drugA} + ${card.drugB}`;
}
function pairBrands(r?: InteractionResult): string {
  if (!r) return "";
  const parts = [r.a, r.b]
    .map((m) => {
      const s = shortName(m);
      return s.brands.length ? `${s.generic}: ${s.brands.join(", ")}` : "";
    })
    .filter(Boolean);
  return parts.length ? `Also sold as — ${parts.join(" · ")}` : "";
}

/** Text a screen reader or the Listen button reads for one card, in natural order. */
export function cardSpeechText(card: InteractionCard, lang: "en" | "es", r?: InteractionResult): string {
  const t = STRINGS[lang];
  const a = r ? shortName(r.a).generic : card.drugA;
  const b = r ? shortName(r.b).generic : card.drugB;
  return [
    `${a} ${t.and} ${b}. ${t.howSerious}: ${t.severityWord[card.severity]}.`,
    `${t.whatHappens}: ${card.whatHappens}`,
    `${t.howSerious}: ${card.howSerious}`,
    `${t.whatToDo}: ${card.whatToDo}`,
    `${t.ask}: ${card.askYourClinician}`,
  ].join(" ");
}

export function InteractionCardList({ cards, results, filter = "all" }: InteractionCardListProps) {
  const { lang } = useLang();
  const t = STRINGS[lang];
  const visible = filter === "all" ? cards : cards.filter((c) => c.severity === filter);

  if (!cards.length) return null;
  if (!visible.length) return <p className="text-body text-md-on-surface-variant">{t.noneInFilter}</p>;

  return (
    <ul className="list-none p-0 m-0 grid md:grid-cols-2 gap-4">
      {visible.map((card, i) => {
        const r = findResult(card, results);
        const id = r ? cardId(r.a.rxcui, r.b.rxcui) : `card-${card.severity}-${i}`;
        const snippets = r?.evidenceSnippets ?? [];
        return (
          <Card
            key={id}
            as="li"
            id={id}
            dense
            tabIndex={-1}
            accentClass={SEVERITY_ACCENT[card.severity]}
            className="scroll-mt-24 focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2"
            aria-labelledby={`${id}-title`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex flex-col gap-1.5">
                <h3 id={`${id}-title`} className="text-title">
                  {pairTitle(card, r)}
                </h3>
                {pairBrands(r) && <p className="text-meta text-md-on-surface-variant mt-0.5">{pairBrands(r)}</p>}
                <div>
                  <SeverityChip severity={card.severity} />
                </div>
              </div>
              <ListenButton
                iconOnly
                size="sm"
                variant="outlined"
                label={t.listen}
                text={cardSpeechText(card, lang, r)}
                className="shrink-0"
              />
            </div>

            <dl className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-3">
              <Section label={t.whatHappens} text={card.whatHappens} />
              <Section label={t.howSerious} text={card.howSerious} />
              <Section label={t.whatToDo} text={card.whatToDo} />
              <Section label={t.ask} text={card.askYourClinician} />
            </dl>

            <details className="mt-4 rounded-lg bg-md-surface-container-low border border-md-outline px-3 py-1.5">
              <summary className="cursor-pointer text-meta font-medium text-md-on-background min-h-10 flex items-center rounded-lg focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2">
                {t.evidence} ({snippets.length}) · {t.evidenceHint}
              </summary>
              {snippets.length === 0 ? (
                <p className="py-2 text-meta text-md-on-surface-variant">{t.noEvidence}</p>
              ) : (
                <ul className="list-none p-0 m-0 py-1.5 space-y-3">
                  {snippets.map((s) => (
                    <li key={s.id} id={`ev-${s.id}`}>
                      <p className="flex flex-wrap items-center gap-x-2 text-meta text-md-on-surface-variant">
                        <span className="font-medium text-md-on-background">{t.source[s.source]}</span>
                        <span>
                          {s.drug} · {s.section.replace(/_/g, " ")}
                        </span>
                      </p>
                      <PlainText as="p" className="mt-1 text-meta text-md-on-surface-variant" text={s.text} />
                    </li>
                  ))}
                </ul>
              )}
            </details>
          </Card>
        );
      })}
    </ul>
  );
}

function Section({ label, text }: { label: string; text: string }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow mb-1">{label}</dt>
      <dd className="m-0">
        <PlainText as="p" className="text-body" text={text} />
      </dd>
    </div>
  );
}
