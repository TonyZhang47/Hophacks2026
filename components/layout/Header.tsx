"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LANGS, useLang, type Lang } from "@/components/LanguageContext";
import { ListenButton } from "@/components/ui/ListenButton";

const NAV = [
  { href: "/", label: "Meds" },
  { href: "/community", label: "Community" },
];

/** Reads everything currently on screen (the main region), in document order. */
function pageText() {
  const main = document.getElementById("main");
  return (main?.innerText ?? "").replace(/\s+\n/g, "\n").trim();
}

export function Header() {
  const pathname = usePathname();
  const { lang, setLang } = useLang();
  return (
    <header className="sticky top-0 z-40 bg-md-surface-container/90 backdrop-blur-sm border-b border-md-outline">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 rounded-full pr-2" aria-label="RxPlain home">
          <span className="h-8 w-8 rounded-lg bg-md-primary text-md-on-primary grid place-items-center text-label font-semibold">
            Rx
          </span>
          <span className="text-title">RxPlain</span>
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1 ml-4">
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-4 h-9 inline-flex items-center text-label transition-colors duration-200 ease-md active:scale-95 ${
                  active
                    ? "bg-md-primary text-md-on-primary"
                    : "text-md-on-surface-variant hover:bg-md-secondary-container hover:text-md-on-background"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ListenButton getText={pageText} text="" label="Read page" variant="outlined" size="sm" />
          <label className="sr-only" htmlFor="lang">
            Language
          </label>
          <select
            id="lang"
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            className="h-9 rounded-full border border-md-outline bg-md-surface-container pl-4 text-label text-md-on-background hover:bg-md-secondary-container transition-colors duration-200"
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}
