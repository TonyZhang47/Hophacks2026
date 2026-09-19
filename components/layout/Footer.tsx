import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-md-outline mt-8 bg-md-surface-container">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-meta text-md-on-surface-variant">
        <span>© {new Date().getFullYear()} RxPlain · HopHacks 2026 · a free educational accessibility tool</span>
        <Link href="/privacy" className="text-md-on-background underline underline-offset-4 rounded-full">
          Privacy Policy
        </Link>
        <Link href="/terms" className="text-md-on-background underline underline-offset-4 rounded-full">
          Terms
        </Link>
      </div>
    </footer>
  );
}
