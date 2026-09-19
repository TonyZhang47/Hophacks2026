import type { Severity } from "@/lib/types";

export const SEVERITY_LABEL: Record<Severity, string> = {
  major: "Major",
  moderate: "Moderate",
  minor: "Minor",
  unknown: "Unknown",
};

const styles: Record<Severity, string> = {
  major: "bg-sev-major/10 text-sev-major",
  moderate: "bg-sev-moderate/10 text-sev-moderate",
  minor: "bg-sev-minor/10 text-sev-minor",
  unknown: "bg-sev-unknown/10 text-sev-unknown",
};

const dots: Record<Severity, string> = {
  major: "bg-sev-major",
  moderate: "bg-sev-moderate",
  minor: "bg-sev-minor",
  unknown: "bg-sev-unknown",
};

export const SEVERITY_ACCENT: Record<Severity, string> = {
  major: "border-l-sev-major",
  moderate: "border-l-sev-moderate",
  minor: "border-l-sev-minor",
  unknown: "border-l-sev-unknown",
};

/** Status pill: dot + WORD + tint. Severity is never color alone. */
export function SeverityChip({ severity, className = "" }: { severity: Severity; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full h-7 px-2.5 text-meta font-medium ${styles[severity]} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dots[severity]}`} aria-hidden="true" />
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

/** Generic status pill for other states (e.g. "+1.8%", "by program rule"). */
export function StatusPill({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: "neutral" | "success" | "warning" | "error" | "info";
  className?: string;
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "bg-md-secondary-container text-md-on-surface-variant",
    success: "bg-md-success/10 text-md-success",
    warning: "bg-md-warning/10 text-md-warning",
    error: "bg-md-error/10 text-md-error",
    info: "bg-md-tertiary/10 text-md-tertiary",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full h-6 px-2 text-meta font-medium ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}
