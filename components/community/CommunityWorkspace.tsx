"use client";

import { PageHeader } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/SeverityChip";
import { MedicationTalk } from "@/components/community/MedicationTalk";
import { useLang } from "@/components/LanguageContext";

const T = {
  en: {
    title: "Medication talk",
    subtitle: "Choose a medicine, share how it went for you, and read what others say. Experiences, not advice.",
    note: "Anonymous · public · not medical advice",
  },
  es: {
    title: "Conversación sobre medicamentos",
    subtitle: "Elija un medicamento, cuente cómo le fue y lea lo que dicen otras personas. Experiencias, no consejos.",
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
      <MedicationTalk />
    </div>
  );
}
