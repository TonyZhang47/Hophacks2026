export function DisclaimerBanner() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4">
      <p
        role="note"
        className="rounded-3xl bg-md-secondary-container text-md-on-secondary-container px-6 py-3 text-body"
      >
        <strong className="font-medium">Educational only, not medical advice.</strong> RxPlain helps you read
        and hear what your labels say. Always talk with a pharmacist or doctor before changing how you take any
        medicine.
      </p>
    </div>
  );
}
