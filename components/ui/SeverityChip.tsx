import type { Severity } from "@/lib/types";

export const SEVERITY_LABEL: Record<Severity, string> = {
  major: "Major",
  moderate: "Moderate",
  minor: "Minor",
  unknown: "Unknown",
};

const styles: Record<Severity, string> = {
  major: "bg-sev-major/15 text-sev-major",
  moderate: "bg-sev-moderate/15 text-sev-moderate",
  minor: "bg-sev-minor/15 text-sev-minor",
  unknown: "bg-sev-unknown/15 text-sev-unknown",
};

export const SEVERITY_ACCENT: Record<Severity, string> = {
  major: "border-l-sev-major",
  moderate: "border-l-sev-moderate",
  minor: "border-l-sev-minor",
  unknown: "border-l-sev-unknown",
};

/** Severity is always a word plus color, never color alone. */
export function SeverityChip({ severity, className = "" }: { severity: Severity; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full h-9 px-4 text-label ${styles[severity]} ${className}`}>
      {SEVERITY_LABEL[severity]}
    </span>
  );
}
