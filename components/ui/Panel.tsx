import type { HTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Dashboard panel primitives (DESIGN_SYSTEM.md rev 3).
 *   <Panel>
 *     <PanelHeader icon={Activity} title="Channel performance" actions={<Select…/>} />
 *     …body…
 *   </Panel>
 */
export interface PanelProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "section" | "article" | "aside";
  padded?: boolean;
}

export function Panel({ as = "section", padded = true, className = "", children, ...props }: PanelProps) {
  const Tag = as as unknown as "div";
  return (
    <Tag className={`panel ${padded ? "p-5" : ""} min-w-0 ${className}`} {...props}>
      {children}
    </Tag>
  );
}

export function PanelHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
  className = "",
  as: Tag = "h2",
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  return (
    <div className={`flex items-start justify-between gap-3 mb-4 ${className}`}>
      <div className="min-w-0">
        <Tag className="eyebrow flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-md-on-surface-variant" aria-hidden="true" />}
          {title}
        </Tag>
        {subtitle && <p className="mt-1 text-meta text-md-on-surface-variant">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/** Big number + label + optional delta pill, like "$1,389.652  +1.8%". */
export function StatTile({
  value,
  label,
  pill,
  className = "",
  tone = "neutral",
}: {
  value: ReactNode;
  label: string;
  pill?: ReactNode;
  className?: string;
  tone?: "neutral" | "major" | "moderate" | "minor" | "unknown";
}) {
  const valueTone = {
    neutral: "text-md-on-background",
    major: "text-sev-major",
    moderate: "text-sev-moderate",
    minor: "text-sev-minor",
    unknown: "text-sev-unknown",
  }[tone];
  return (
    <div className={`panel p-4 flex flex-col gap-1 min-w-0 ${className}`}>
      <span className="eyebrow">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className={`text-kpi ${valueTone}`}>{value}</span>
        {pill}
      </div>
    </div>
  );
}

/** Page-level header row: title on the left, actions on the right. Replaces the old hero. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pt-6 pb-4">
      <div className="min-w-0">
        <h1 className="text-headline">{title}</h1>
        {subtitle && <p className="mt-1 text-body text-md-on-surface-variant max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Small uppercase key/value row used inside panels. */
export function KeyValue({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-md-outline last:border-b-0">
      <span className="text-meta text-md-on-surface-variant">{k}</span>
      <span className="text-label text-md-on-background text-right">{v}</span>
    </div>
  );
}
