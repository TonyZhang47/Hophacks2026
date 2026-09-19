"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LANGS, useLang, type Lang } from "@/components/LanguageContext";

const NAV = [
  { href: "/", label: "Meds" },
  { href: "/community", label: "Community" },
];

export function Header() {
  const pathname = usePathname();
  const { lang, setLang } = useLang();
  return (
    <header className="sticky top-0 z-40 bg-md-background/80 backdrop-blur-sm border-b border-md-outline/20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
        <Link href="/" className="text-title font-bold text-md-primary rounded-full px-2" aria-label="RxPlain home">
          RxPlain
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1 ml-2">
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-4 h-10 inline-flex items-center text-label transition-colors duration-200 ease-md active:scale-95 ${
                  active
                    ? "bg-md-secondary-container text-md-on-secondary-container"
                    : "text-md-primary hover:bg-md-primary/10"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto">
          <label className="sr-only" htmlFor="lang">
            Language
          </label>
          <select
            id="lang"
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            className="h-10 rounded-full border border-md-outline bg-transparent px-4 text-label text-md-primary hover:bg-md-primary/5 transition-colors duration-200"
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
