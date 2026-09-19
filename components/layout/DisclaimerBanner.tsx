"use client";

import { Info } from "lucide-react";
import { useLang } from "@/components/LanguageContext";

export function DisclaimerBanner() {
  const { lang } = useLang();
  const es = lang === "es";
  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 mt-4">
      <p
        data-page-disclaimer
        role="note"
        className="panel flex items-start gap-3 px-4 py-3 text-meta text-md-on-surface-variant"
      >
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-md-on-surface-variant" aria-hidden="true" />
        <span>
          <strong className="font-semibold text-md-on-background">
            {es ? "Solo con fines educativos, no es consejo médico." : "Educational only, not medical advice."}
          </strong>{" "}
          {es
            ? "RxPlain le ayuda a leer y escuchar lo que dicen sus etiquetas. Hable siempre con un farmacéutico o médico antes de cambiar cómo toma cualquier medicamento."
            : "RxPlain helps you read and hear what your labels say. Always talk with a pharmacist or doctor before changing how you take any medicine."}
        </span>
      </p>
    </div>
  );
}
