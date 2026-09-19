import type { HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  /** Left accent bar color class, e.g. "border-l-sev-major" */
  accentClass?: string;
  as?: "div" | "section" | "article" | "li";
  /** Tighter padding for dense lists. */
  dense?: boolean;
}

/** Dashboard panel: white, hairline border, 16px radius, soft shadow. */
export function Card({ interactive, accentClass, className = "", as = "div", dense, children, ...props }: CardProps) {
  const Tag = as as unknown as "div";
  return (
    <Tag
      className={`panel ${dense ? "p-4" : "p-5"} transition-shadow duration-200 ease-md ${
        interactive ? "hover:shadow-md" : ""
      } ${accentClass ? `border-l-4 ${accentClass}` : ""} ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}
