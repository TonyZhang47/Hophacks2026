import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

interface Common {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
}

export type TextFieldProps = Common & InputHTMLAttributes<HTMLInputElement>;

/** Material 3 filled text field: rounded top, square bottom, 2px bottom border. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, className = "", id, ...props },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div className={className}>
      <label htmlFor={inputId} className="block text-label text-md-on-surface-variant mb-1">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error || undefined}
        aria-describedby={hint || error ? `${inputId}-hint` : undefined}
        className={`w-full h-14 rounded-t-lg rounded-b-none bg-md-surface-container-low px-4 text-body text-md-on-background placeholder:text-md-on-background/50 border-b-2 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2 ${
          error ? "border-md-error" : "border-md-outline focus:border-md-primary"
        }`}
        {...props}
      />
      {(hint || error) && (
        <p id={`${inputId}-hint`} className={`mt-1 text-meta ${error ? "text-md-error" : "text-md-on-surface-variant"}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
});

export type TextAreaProps = Common & TextareaHTMLAttributes<HTMLTextAreaElement>;

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, hint, error, className = "", id, ...props },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div className={className}>
      <label htmlFor={inputId} className="block text-label text-md-on-surface-variant mb-1">
        {label}
      </label>
      <textarea
        ref={ref}
        id={inputId}
        aria-invalid={!!error || undefined}
        aria-describedby={hint || error ? `${inputId}-hint` : undefined}
        className={`w-full min-h-28 rounded-t-lg rounded-b-none bg-md-surface-container-low px-4 py-3 text-body text-md-on-background placeholder:text-md-on-background/50 border-b-2 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2 ${
          error ? "border-md-error" : "border-md-outline focus:border-md-primary"
        }`}
        {...props}
      />
      {(hint || error) && (
        <p id={`${inputId}-hint`} className={`mt-1 text-meta ${error ? "text-md-error" : "text-md-on-surface-variant"}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
});
