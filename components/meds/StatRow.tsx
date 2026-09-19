"use client";

import { SEVERITY_HELP } from "@/lib/food";
import { StatTile } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/SeverityChip";
import { useLang } from "@/components/LanguageContext";
import type { Severity } from "@/lib/types";

export type SeverityCounts = Record<Severity, number>;

export interface StatRowProps {
  /** null before a check has run. */
  counts: SeverityCounts | null;
  medCount: number;
  maxMeds: number;
  /** Severity key only (no medicine-count tile), laid out to sit under the food map. */
  compact?: boolean;
}

const ORDER: Severity[] = ["major", "moderate", "minor", "unknown"];

const STRINGS = {
  en: {
    label: {
      major: "Major",
      moderate: "Moderate",
      minor: "Minor",
      unknown: "Unknown",
    } as Record<Severity, string>,
    meds: "Medicines",
    none: "none found",
    of: (n: number, max: number) => `${n} of ${max}`,
    live: (c: SeverityCounts | null, n: number) =>
      c
        ? `Results: ${c.major} major, ${c.moderate} moderate, ${c.minor} minor, ${c.unknown} unknown, across ${n} medicines.`
        : `${n} medicines listed. No check has run yet.`,
  },
  es: {
    label: {
      major: "Mayores",
      moderate: "Moderadas",
      minor: "Menores",
      unknown: "Desconocidas",
    } as Record<Severity, string>,
    meds: "Medicamentos",
    none: "ninguna",
    of: (n: number, max: number) => `${n} de ${max}`,
    live: (c: SeverityCounts | null, n: number) =>
      c
        ? `Resultados: ${c.major} mayores, ${c.moderate} moderadas, ${c.minor} menores, ${c.unknown} desconocidas, entre ${n} medicamentos.`
        : `${n} medicamentos en la lista. Todavía no se ha hecho una revisión.`,
  },
};

/** KPI row under the page header: one tile per severity plus the medicine count. */
export function StatRow({ counts, medCount, maxMeds, compact }: StatRowProps) {
  const { lang } = useLang();
  const t = STRINGS[lang];

  return (
    <div>
      <div className={compact ? "grid grid-cols-2 xl:grid-cols-4 gap-3" : "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"}>
        {ORDER.map((sev) => {
          const n = counts ? counts[sev] : null;
          return (
            <div key={sev} className="severity-tile" data-page-read>
              <StatTile
                label={t.label[sev]}
                tone={sev}
                value={n === null ? "—" : n}
                pill={undefined}
              />
              <p className="text-meta text-md-on-surface-variant mt-2">
                {SEVERITY_HELP[lang][sev]}
              </p>
            </div>
          );
        })}
        {!compact && (
          <StatTile
            label={t.meds}
            value={medCount}
            pill={
              <StatusPill tone="neutral">{t.of(medCount, maxMeds)}</StatusPill>
            }
          />
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {t.live(counts, medCount)}
      </p>
    </div>
  );
}
