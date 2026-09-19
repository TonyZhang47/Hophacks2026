import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

interface Common {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  /** Visually hide the label (still read by screen readers). */
  hideLabel?: boolean;
}

const fieldCls = (error?: string) =>
  `w-full rounded-lg bg-md-surface-container px-3.5 text-body text-md-on-background placeholder:text-md-on-surface-variant border transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2 ${
    error ? "border-md-error" : "border-md-outline hover:border-md-outline-strong focus:border-md-primary"
  }`;

export type TextFieldProps = Common & InputHTMLAttributes<HTMLInputElement>;

/** Dashboard text input: white, hairline border, 10px radius. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, className = "", id, hideLabel, ...props },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div className={className}>
      <label htmlFor={inputId} className={hideLabel ? "sr-only" : "block text-meta font-medium text-md-on-surface-variant mb-1.5"}>
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error || undefined}
        aria-describedby={hint || error ? `${inputId}-hint` : undefined}
        className={`h-11 ${fieldCls(error)}`}
        {...props}
      />
      {(hint || error) && (
        <p id={`${inputId}-hint`} className={`mt-1.5 text-meta ${error ? "text-md-error" : "text-md-on-surface-variant"}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
});

export type TextAreaProps = Common & TextareaHTMLAttributes<HTMLTextAreaElement>;

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, hint, error, className = "", id, hideLabel, ...props },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div className={className}>
      <label htmlFor={inputId} className={hideLabel ? "sr-only" : "block text-meta font-medium text-md-on-surface-variant mb-1.5"}>
        {label}
      </label>
      <textarea
        ref={ref}
        id={inputId}
        aria-invalid={!!error || undefined}
        aria-describedby={hint || error ? `${inputId}-hint` : undefined}
        className={`min-h-28 py-2.5 ${fieldCls(error)}`}
        {...props}
      />
      {(hint || error) && (
        <p id={`${inputId}-hint`} className={`mt-1.5 text-meta ${error ? "text-md-error" : "text-md-on-surface-variant"}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
});

/** Native select styled like the inputs (dropdown filters in panel headers). */
export const Select = forwardRef<HTMLSelectElement, Common & React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { label, hint, error, className = "", id, hideLabel, children, ...props },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div className={className}>
      <label htmlFor={inputId} className={hideLabel ? "sr-only" : "block text-meta font-medium text-md-on-surface-variant mb-1.5"}>
        {label}
      </label>
      <select ref={ref} id={inputId} className={`h-9 rounded-full text-meta ${fieldCls(error)} !px-3.5`} {...props}>
        {children}
      </select>
      {(hint || error) && (
        <p id={`${inputId}-hint`} className={`mt-1.5 text-meta ${error ? "text-md-error" : "text-md-on-surface-variant"}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
});
