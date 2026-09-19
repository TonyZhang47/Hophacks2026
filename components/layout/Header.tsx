"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LANGS, useLang, type Lang } from "@/components/LanguageContext";
import { ListenButton } from "@/components/ui/ListenButton";

const NAV = [
  { href: "/meds", label: { en: "Meds", es: "Medicamentos" } },
  { href: "/clinics", label: { en: "Clinics", es: "Clínicas" } },
  { href: "/community", label: { en: "Community", es: "Comunidad" } },
];

function visibleBlockText(el: Element): string {
  const copy = el.cloneNode(true) as HTMLElement;
  copy
    .querySelectorAll("button, select, input, textarea, [aria-hidden='true'], .sr-only, nav")
    .forEach((n) => n.remove());
  return copy.innerText?.replace(/\s+/g, " ").trim() || copy.textContent?.replace(/\s+/g, " ").trim() || "";
}

/** Reads visible page copy (disclaimer + main), skipping controls. */
function pageText() {
  const parts: string[] = [];
  const disclaimer = document.querySelector("[data-page-disclaimer]");
  if (disclaimer instanceof HTMLElement && disclaimer.getClientRects().length) {
    const line = visibleBlockText(disclaimer);
    if (line) parts.push(line);
  }
  const main = document.getElementById("main");
  if (main) {
    const line = visibleBlockText(main);
    if (line) parts.push(line);
  }
  return parts.join("\n");
}

export function Header() {
  const pathname = usePathname();
  const { lang, setLang } = useLang();
  return (
    <header className="sticky top-0 z-40 bg-md-surface-container/90 backdrop-blur-sm border-b border-md-outline">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 min-h-20 py-3 flex flex-wrap items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-full pr-2"
          aria-label="RxPlain home"
        >
          <span className="h-8 w-8 rounded-lg bg-md-primary text-md-on-primary grid place-items-center text-label font-semibold">
            Rx
          </span>
          <span className="font-serif text-section font-normal">RxPlain</span>
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1 sm:ml-4">
          {NAV.map((n) => {
            const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
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
                {n.label[lang]}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ListenButton
            getText={pageText}
            text=""
            label={lang === "es" ? "Leer página" : "Read page"}
            variant="outlined"
            size="sm"
          />
          <label className="sr-only" htmlFor="lang">
            {lang === "es" ? "Idioma" : "Language"}
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
