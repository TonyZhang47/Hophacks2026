"use client";
// CONTRACT STUB — replaced by the dose feature module. Keep this signature.
import type { DoseInput, DoseResult, Med } from "@/lib/types";

export interface DoseExplainerProps {
  /** Meds already added on the Meds page; used to prefill the picker. */
  meds: Med[];
  /** Called whenever a dose result is produced (for the share sheet). */
  onResult?: (r: { input: DoseInput; result: DoseResult }) => void;
}

export function DoseExplainer(_props: DoseExplainerProps) {
  return <section className="py-6 text-body">Dose explainer coming up.</section>;
}
