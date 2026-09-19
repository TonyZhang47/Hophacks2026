"use client";

import { X } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { useLang } from "@/components/LanguageContext";
import { capitalize, shortName } from "@/lib/plainNames";
import type { Med } from "@/lib/types";

/**
 * Common-name label parts for a medicine: generic first, brands as a muted suffix.
 * Falls back to the "Brand (ingredient)" pattern in the name for live RxNorm results
 * that are not in the bundled list.
 */
export function medLabel(med: Med): { generic: string; brands: string[] } {
  const s = shortName(med);
  if (s.brands.length) return s;
  const m = med.name.match(/^(.+?)\s*\((.+)\)$/);
  if (m) return { generic: capitalize(med.ingredientName || m[2].trim()), brands: [] };
  return { generic: s.generic, brands: [] };
}

/** "Ibuprofen · Advil, Motrin" as one string (for aria-labels and speech). */
export function medLabelText(med: Med): string {
  const { generic, brands } = medLabel(med);
  return brands.length ? `${generic} · ${brands.join(", ")}` : generic;
}

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
      {meds.map((m) => {
        const { generic, brands } = medLabel(m);
        return (
          <li key={m.rxcui}>
            <Chip asSpan className="pr-0.5 h-10">
              <span className="text-md-on-background">{generic}</span>
              {brands.length > 0 && <span className="text-md-on-surface-variant font-normal">· {brands.join(", ")}</span>}
              <button
                type="button"
                onClick={() => onRemove(m.rxcui)}
                aria-label={`${removeWord} ${medLabelText(m)}`}
                className="inline-flex items-center justify-center h-8 w-8 rounded-full text-md-on-surface-variant hover:bg-md-secondary-container hover:text-md-on-background active:scale-95 transition-all duration-200 ease-md focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </Chip>
          </li>
        );
      })}
    </ul>
  );
}
