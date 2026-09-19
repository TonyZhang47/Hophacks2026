import { forwardRef, type ButtonHTMLAttributes } from "react";

export type ButtonVariant = "filled" | "tonal" | "outlined" | "text" | "fab";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-medium text-label whitespace-nowrap select-none transition-all duration-200 ease-md active:scale-95 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  filled: "rounded-full bg-md-primary text-md-on-primary hover:bg-md-primary/90 active:bg-md-primary/80 shadow-sm",
  tonal:
    "rounded-full bg-md-secondary-container text-md-on-secondary-container border border-md-outline hover:bg-md-outline/60",
  outlined:
    "rounded-full border border-md-outline bg-md-surface-container text-md-on-background hover:bg-md-secondary-container",
  text: "rounded-full text-md-on-background hover:bg-md-secondary-container",
  fab: "rounded-full bg-md-primary text-md-on-primary shadow-lg hover:shadow-xl h-14 px-5",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-meta",
  md: "h-10 px-5",
  lg: "h-12 px-6 text-body",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "filled", size = "md", className = "", type = "button", ...props },
  ref,
) {
  const sizeCls = variant === "fab" ? "" : sizes[size];
  return <button ref={ref} type={type} className={`${base} ${variants[variant]} ${sizeCls} ${className}`} {...props} />;
});
