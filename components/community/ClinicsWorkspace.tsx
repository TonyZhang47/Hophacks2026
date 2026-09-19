"use client";

import { ClinicFinder } from "@/components/community/ClinicFinder";
import { useLang } from "@/components/LanguageContext";
import { PageHeader } from "@/components/ui/Panel";

const T = {
  en: {
    title: "Clinics",
    subtitle: "Community health centers and rural health clinics near a ZIP. We only use the ZIP, never your exact spot.",
  },
  es: {
    title: "Clínicas",
    subtitle: "Centros de salud comunitarios y clínicas rurales cerca de un código postal. Solo usamos el ZIP, nunca su ubicación exacta.",
  },
} as const;

export function ClinicsWorkspace() {
  const { lang } = useLang();
  const t = T[lang];
  return (
    <div className="pb-8">
      <PageHeader title={t.title} subtitle={t.subtitle} />
      <ClinicFinder showHeader={false} />
    </div>
  );
}
