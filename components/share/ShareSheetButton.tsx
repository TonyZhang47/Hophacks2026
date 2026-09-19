"use client";
// CONTRACT STUB — replaced by the voice/share feature module. Keep this signature.
import type { ClinicResult, DoseInput, DoseResult, InteractionCard, Med } from "@/lib/types";

export interface ShareSheetData {
  meds: Med[];
  cards: InteractionCard[];
  doses: { input: DoseInput; result: DoseResult }[];
  clinic?: ClinicResult | null;
}

export function ShareSheetButton({ data: _data, className = "" }: { data: ShareSheetData; className?: string }) {
  return (
    <button type="button" className={`rounded-full h-11 px-6 bg-md-secondary-container text-md-on-secondary-container ${className}`}>
      Share sheet (PDF)
    </button>
  );
}
