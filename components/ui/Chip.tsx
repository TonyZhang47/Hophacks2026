import type { ButtonHTMLAttributes } from "react";

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  /** Render as a static span (non-interactive). */
  asSpan?: boolean;
}

const base =
  "inline-flex items-center gap-2 rounded-full h-10 px-4 text-label transition-all duration-200 ease-md";

export function Chip({ selected, asSpan, className = "", children, ...props }: ChipProps) {
  const look = selected
    ? "bg-md-primary text-md-on-primary"
    : "bg-md-secondary-container text-md-on-secondary-container";
  if (asSpan) {
    return <span className={`${base} ${look} ${className}`}>{children}</span>;
  }
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`${base} ${look} active:scale-95 hover:shadow-sm ${
        selected ? "hover:bg-md-primary/90" : "hover:bg-md-secondary-container/80"
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
