import { Info } from "lucide-react";

export function DisclaimerBanner() {
  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 mt-4">
      <p
        role="note"
        className="panel flex items-start gap-3 px-4 py-3 text-meta text-md-on-surface-variant"
      >
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-md-on-surface-variant" aria-hidden="true" />
        <span>
          <strong className="font-semibold text-md-on-background">Educational only, not medical advice.</strong>{" "}
          RxPlain helps you read and hear what your labels say. Always talk with a pharmacist or doctor before
          changing how you take any medicine.
        </span>
      </p>
    </div>
  );
}
