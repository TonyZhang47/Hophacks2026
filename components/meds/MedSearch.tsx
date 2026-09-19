"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { genericFor } from "@/lib/plainNames";
import commonMeds from "@/data/common_meds.json";
import { Search } from "lucide-react";
import { TextField } from "@/components/ui/TextField";
import { useLang } from "@/components/LanguageContext";
import { medLabel, medLabelText } from "@/components/meds/MedChips";
import type { Med } from "@/lib/types";

export interface MedSearchProps {
  meds: Med[];
  onAdd: (med: Med) => void;
  max?: number;
}

const DEBOUNCE_MS = 250;

/**
 * Search-as-you-type over /api/meds/search. Results are a keyboard-navigable listbox
 * (up/down/enter/escape, aria-activedescendant). Selecting adds a med, no duplicates.
 * Brand names ("advil", "tylenol") resolve through the bundled common-meds list; each
 * option shows the generic in bold with the brand aliases muted.
 */
export function MedSearch({ meds, onAdd, max = 10 }: MedSearchProps) {
  const { lang } = useLang();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Med[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [announce, setAnnounce] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optId = (i: number) => `${baseId}-opt-${i}`;

  const full = meds.length >= max;
  const t =
    lang === "es"
      ? {
          label: "Busque un medicamento",
          placeholder: "Nombre o marca, p. ej. metformina o Advil",
          hint: full
            ? `Ya tiene ${max} medicamentos, el máximo.`
            : "Escriba 2 letras o más. Agregue de 1 a 10 medicamentos.",
          none: "No encontramos nada con ese nombre.",
          added: "ya agregado",
          count: (n: number) => (n === 1 ? "1 resultado" : `${n} resultados`),
          searching: "Buscando…",
          addedMsg: (s: string) => `${s} agregado.`,
        }
      : {
          label: "Search for a medicine",
          placeholder: "Name or brand, e.g. metformin or Advil",
          hint: full
            ? `You have ${max} medicines, the maximum.`
            : "Type 2 or more letters. Add 1 to 10 medicines.",
          none: "Nothing found with that name.",
          added: "already added",
          count: (n: number) => (n === 1 ? "1 result" : `${n} results`),
          searching: "Searching…",
          addedMsg: (s: string) => `${s} added.`,
        };

  useEffect(() => {
    const query = q.trim();
    abortRef.current?.abort();
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/meds/search?q=${encodeURIComponent(query)}`,
          { signal: ctrl.signal },
        );
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { results: Med[] };
        setResults(data.results);
        setOpen(true);
        setActive(data.results.length ? 0 : -1);
        setAnnounce(
          data.results.length ? t.count(data.results.length) : t.none,
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setResults([]);
          setOpen(true);
          setAnnounce(t.none);
        }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const isAdded = (m: Med) => meds.some((x) => x.rxcui === m.rxcui);

  const choose = (m: Med) => {
    if (full || isAdded(m)) return;
    onAdd(m);
    setQ("");
    setResults([]);
    setOpen(false);
    setActive(-1);
    setAnnounce(t.addedMsg(medLabelText(m)));
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || !results.length) {
      if (e.key === "Escape") setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      if (active >= 0) {
        e.preventDefault();
        choose(results[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3.5 top-[22px] -translate-y-1/2 h-4 w-4 text-md-on-surface-variant z-10"
        aria-hidden="true"
      />
      <TextField
        ref={inputRef}
        label={t.label}
        hideLabel
        placeholder={t.placeholder}
        hint={t.hint}
        value={q}
        disabled={full}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? optId(active) : undefined}
        style={{ paddingLeft: "2.5rem" }}
      />

      <Button
        variant="text"
        size="sm"
        className="mt-2"
        disabled={full || q.trim().length < 2}
        onClick={() => {
          const name = q.trim().slice(0, 80);
          const generic = genericFor(name) || name.toLowerCase();
          const known = (commonMeds as Med[]).find(
            (m) =>
              m.name.toLowerCase() === name.toLowerCase() ||
              m.ingredientName === generic,
          );
          choose(
            known || {
              name,
              rxcui: `manual:${name.toLowerCase()}`,
              ingredientName: generic,
            },
          );
        }}
      >
        {lang === "es" ? "Agregar nombre escrito" : "Add typed name"}
      </Button>
      <p className="text-meta text-md-on-surface-variant mt-1">
        {lang === "es"
          ? "Los nombres sin verificar se marcan como desconocidos."
          : "Unrecognized names will be marked unknown."}
      </p>
      <p aria-live="polite" className="sr-only">
        {loading ? t.searching : announce}
      </p>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t.label}
          className="panel absolute z-30 top-12 w-full max-h-80 overflow-auto shadow-md p-1.5 list-none"
        >
          {results.length === 0 && (
            <li
              className="px-3 py-2.5 text-body text-md-on-surface-variant"
              aria-disabled="true"
            >
              {loading ? t.searching : t.none}
            </li>
          )}
          {results.map((m, i) => {
            const added = isAdded(m);
            const isActive = i === active;
            const { generic, brands } = medLabel(m);
            return (
              <li
                key={`${m.rxcui}-${i}`}
                id={optId(i)}
                role="option"
                aria-selected={isActive}
                aria-disabled={added || undefined}
                aria-label={medLabelText(m)}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(m)}
                className={`flex items-center justify-between gap-3 rounded-lg px-3 min-h-11 py-2 cursor-pointer transition-colors duration-200 ease-md ${
                  isActive
                    ? "bg-md-secondary-container"
                    : "hover:bg-md-surface-container-low"
                } ${added ? "opacity-60 cursor-default" : ""}`}
              >
                <span className="min-w-0 truncate">
                  <span className="text-label text-md-on-background">
                    {generic}
                  </span>
                  {brands.length > 0 && (
                    <span className="text-meta text-md-on-surface-variant">
                      {" "}
                      · {brands.join(", ")}
                    </span>
                  )}
                </span>
                {added && (
                  <span className="shrink-0 text-meta text-md-on-surface-variant">
                    {t.added}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
