"use client";

import { PageHeader } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/SeverityChip";
import { ClinicFinder } from "@/components/community/ClinicFinder";
import { MedicationTalk } from "@/components/community/MedicationTalk";
import { useLang } from "@/components/LanguageContext";

/**
 * /community — DESIGN_SYSTEM.md rev 3 "Community page composition":
 * page header row, then a 12-column grid with "Find a clinic" (5) beside "Medication talk" (7).
 * Below lg the two panels stack; both are always mounted so state survives resizing.
 */
const T = {
  en: {
    title: "People near you",
    subtitle: "Find a clinic that takes your coverage, and hear what others say about their medicines.",
    note: "Anonymous · public · not medical advice",
  },
  es: {
    title: "Personas cerca de usted",
    subtitle: "Encuentre una clínica que acepte su cobertura y lea lo que otras personas dicen de sus medicamentos.",
    note: "Anónimo · público · no es consejo médico",
  },
} as const;

export function CommunityWorkspace() {
  const { lang } = useLang();
  const t = T[lang];
  return (
    <div className="pb-8">
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <StatusPill tone="neutral" className="h-8 px-3">
            <span role="note">{t.note}</span>
          </StatusPill>
        }
      />
      <div className="grid grid-cols-12 gap-6 items-start">
        <MedicationTalk className="col-span-12" />
        <ClinicFinder className="col-span-12" />
      </div>
    </div>
  );
}
