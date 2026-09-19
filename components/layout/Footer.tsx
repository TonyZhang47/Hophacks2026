import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-md-outline/20 mt-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-meta text-md-on-surface-variant">
        <span>© {new Date().getFullYear()} RxPlain · HopHacks 2026 · a free educational accessibility tool</span>
        <Link href="/privacy" className="text-md-primary underline underline-offset-4 rounded-full">
          Privacy Policy
        </Link>
        <Link href="/terms" className="text-md-primary underline underline-offset-4 rounded-full">
          Terms
        </Link>
      </div>
    </footer>
  );
}
