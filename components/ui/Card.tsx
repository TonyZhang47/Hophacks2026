import type { HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  /** Left accent bar color class, e.g. "border-l-sev-major" */
  accentClass?: string;
  as?: "div" | "section" | "article" | "li";
}

export function Card({ interactive, accentClass, className = "", as = "div", children, ...props }: CardProps) {
  const Tag = as as unknown as "div";
  return (
    <Tag
      className={`bg-md-surface-container rounded-3xl p-6 shadow-sm transition-all duration-300 ease-md ${
        interactive ? "hover:shadow-md hover:scale-[1.02]" : ""
      } ${accentClass ? `border-l-[6px] ${accentClass}` : ""} ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}
