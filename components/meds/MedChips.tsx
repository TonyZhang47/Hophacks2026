"use client";

import { X } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { useLang } from "@/components/LanguageContext";
import type { Med } from "@/lib/types";

export interface MedChipsProps {
  meds: Med[];
  onRemove: (rxcui: string) => void;
}

/** Selected medicines as pill chips, each with an accessible remove button. */
export function MedChips({ meds, onRemove }: MedChipsProps) {
  const { lang } = useLang();
  if (!meds.length) return null;
  const removeWord = lang === "es" ? "Quitar" : "Remove";
  const heading = lang === "es" ? "Sus medicamentos" : "Your medicines";

  return (
    <ul aria-label={heading} className="flex flex-wrap gap-2 list-none p-0 m-0">
      {meds.map((m) => (
        <li key={m.rxcui}>
          <Chip asSpan className="pr-1 h-11">
            <span>{m.name}</span>
            <button
              type="button"
              onClick={() => onRemove(m.rxcui)}
              aria-label={`${removeWord} ${m.name}`}
              className="inline-flex items-center justify-center h-9 w-9 rounded-full text-md-on-secondary-container hover:bg-md-primary/10 active:bg-md-primary/5 active:scale-95 transition-all duration-200 ease-md focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </Chip>
        </li>
      ))}
    </ul>
  );
}
