"use client";

import { useEffect, useRef, useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ClinicResult, DoseInput, DoseResult, InteractionCard, Med } from "@/lib/types";

/** Everything the one-page share sheet is built from — the same validated JSON the UI shows. */
export interface ShareSheetData {
  meds: Med[];
  cards: InteractionCard[];
  doses: { input: DoseInput; result: DoseResult }[];
  clinic?: ClinicResult | null;
}

type State = "idle" | "loading" | "error";

/**
 * Tonal pill that POSTs the current results to /api/export/pdf and downloads the PDF.
 * Disabled (with a hint) until at least one medicine is listed.
 */
export function ShareSheetButton({ data, className = "" }: { data: ShareSheetData; className?: string }) {
  const [state, setState] = useState<State>("idle");
  const abortRef = useRef<AbortController | null>(null);
  const empty = !data?.meds || data.meds.length === 0;

  useEffect(() => () => abortRef.current?.abort(), []);

  const download = async () => {
    if (state === "loading" || empty) return;
    setState("loading");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`pdf ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "rxplain-share-sheet.pdf";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Give the browser a tick to start the download before revoking.
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setState("idle");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setState("error");
    }
  };

  const Icon = state === "loading" ? Loader2 : FileDown;
  const label = state === "loading" ? "Preparing PDF…" : "Download share sheet (PDF)";

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <Button
        variant="tonal"
        size="md"
        onClick={download}
        disabled={empty || state === "loading"}
        aria-busy={state === "loading"}
        aria-describedby="share-sheet-hint"
        title={empty ? "Add at least one medicine first" : undefined}
      >
        <Icon className={`h-5 w-5 ${state === "loading" ? "animate-spin" : ""}`} aria-hidden="true" />
        <span>{label}</span>
      </Button>
      <p id="share-sheet-hint" className="text-meta text-md-on-surface-variant" aria-live="polite">
        {empty
          ? "Add at least one medicine to make a share sheet."
          : state === "error"
            ? "Could not make the PDF right now. Please try again."
            : "One page to show a caregiver or bring to your next visit."}
      </p>
    </div>
  );
}
