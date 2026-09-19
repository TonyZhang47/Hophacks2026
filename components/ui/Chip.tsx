import type { ButtonHTMLAttributes } from "react";

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  /** Render as a static span (non-interactive). */
  asSpan?: boolean;
}

const base = "inline-flex items-center gap-1.5 rounded-full h-8 px-3 text-meta font-medium transition-all duration-200 ease-md";

export function Chip({ selected, asSpan, className = "", children, ...props }: ChipProps) {
  const look = selected
    ? "bg-md-primary text-md-on-primary border border-md-primary"
    : "bg-md-surface-container text-md-on-background border border-md-outline";
  if (asSpan) {
    return <span className={`${base} ${look} ${className}`}>{children}</span>;
  }
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`${base} ${look} active:scale-95 ${selected ? "hover:bg-md-primary/90" : "hover:bg-md-secondary-container"} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
