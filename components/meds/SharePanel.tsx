"use client";

import { FileText } from "lucide-react";
import { KeyValue, Panel, PanelHeader } from "@/components/ui/Panel";
import { ListenButton } from "@/components/ui/ListenButton";
import { ShareSheetButton, type ShareSheetData } from "@/components/share/ShareSheetButton";
import { useLang } from "@/components/LanguageContext";

export interface SharePanelProps {
  data: ShareSheetData;
  className?: string;
}

const STRINGS = {
  en: {
    title: "Share sheet",
    subtitle: "One page to show a caregiver or bring to your next visit.",
    meds: "Medicines",
    flagged: "Flagged pairs",
    doses: "Dose lines",
    clinic: "Nearest clinic",
    none: "—",
    listen: "Read preview",
    speak: (m: number, f: number, d: number) =>
      `The share sheet will include ${m} medicines, ${f} flagged pairs, and ${d} dose lines. No clinic is attached.`,
  },
  es: {
    title: "Hoja para compartir",
    subtitle: "Una página para mostrar a un cuidador o llevar a su próxima visita.",
    meds: "Medicamentos",
    flagged: "Pares señalados",
    doses: "Líneas de dosis",
    clinic: "Clínica más cercana",
    none: "—",
    listen: "Leer resumen",
    speak: (m: number, f: number, d: number) =>
      `La hoja para compartir incluirá ${m} medicamentos, ${f} pares señalados y ${d} líneas de dosis. No hay clínica adjunta.`,
  },
};

/** Row C right column: what will print, then the download button (voice/share module). */
export function SharePanel({ data, className = "" }: SharePanelProps) {
  const { lang } = useLang();
  const t = STRINGS[lang];
  const flagged = data.cards.filter((c) => c.severity !== "unknown").length;
  const speech = t.speak(data.meds.length, flagged, data.doses.length);

  return (
    <Panel className={className} aria-labelledby="share-panel-title">
      <PanelHeader
        icon={FileText}
        title={t.title}
        subtitle={t.subtitle}
        actions={<ListenButton size="sm" variant="outlined" label={t.listen} text={speech} />}
      />
      <span id="share-panel-title" className="sr-only">
        {t.title}
      </span>
      <div className="mb-5">
        <KeyValue k={t.meds} v={data.meds.length} />
        <KeyValue k={t.flagged} v={flagged} />
        <KeyValue k={t.doses} v={data.doses.length} />
        <KeyValue k={t.clinic} v={data.clinic ? data.clinic.name : t.none} />
      </div>
      <ShareSheetButton data={data} />
    </Panel>
  );
}
