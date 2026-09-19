import { forwardRef, type ButtonHTMLAttributes } from "react";

export type ButtonVariant = "filled" | "tonal" | "outlined" | "text" | "fab";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-medium text-label whitespace-nowrap select-none transition-all duration-200 ease-md active:scale-95 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  filled: "rounded-full bg-md-primary text-md-on-primary hover:bg-md-primary/90 active:bg-md-primary/80 hover:shadow-md",
  tonal:
    "rounded-full bg-md-secondary-container text-md-on-secondary-container hover:bg-md-secondary-container/80 active:bg-md-secondary-container/70",
  outlined: "rounded-full border border-md-outline text-md-primary hover:bg-md-primary/5 active:bg-md-primary/10",
  text: "rounded-full text-md-primary hover:bg-md-primary/10 active:bg-md-primary/5",
  fab: "rounded-2xl bg-md-tertiary text-md-on-tertiary shadow-md hover:shadow-xl h-14 w-14 p-0",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4",
  md: "h-11 px-6",
  lg: "h-12 px-8 text-body",
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
