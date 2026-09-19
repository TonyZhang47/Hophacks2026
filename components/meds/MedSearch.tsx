"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import { TextField } from "@/components/ui/TextField";
import { useLang } from "@/components/LanguageContext";
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
          placeholder: "Escriba un nombre, por ejemplo metformina o Advil",
          hint: full ? `Ya tiene ${max} medicamentos, el máximo.` : "Escriba al menos 2 letras. Agregue de 2 a 10 medicamentos.",
          none: "No encontramos nada con ese nombre.",
          added: "ya agregado",
          count: (n: number) => (n === 1 ? "1 resultado" : `${n} resultados`),
          searching: "Buscando…",
        }
      : {
          label: "Search for a medicine",
          placeholder: "Type a name, for example metformin or Advil",
          hint: full ? `You have ${max} medicines, the maximum.` : "Type at least 2 letters. Add 2 to 10 medicines.",
          none: "Nothing found with that name.",
          added: "already added",
          count: (n: number) => (n === 1 ? "1 result" : `${n} results`),
          searching: "Searching…",
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
        const res = await fetch(`/api/meds/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { results: Med[] };
        setResults(data.results);
        setOpen(true);
        setActive(data.results.length ? 0 : -1);
        setAnnounce(data.results.length ? t.count(data.results.length) : t.none);
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
    setAnnounce(lang === "es" ? `${m.name} agregado.` : `${m.name} added.`);
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
      <TextField
        ref={inputRef}
        label={t.label}
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
      />
      <Search className="pointer-events-none absolute right-4 top-[2.4rem] h-5 w-5 text-md-on-surface-variant" aria-hidden="true" />

      <p aria-live="polite" className="sr-only">
        {loading ? t.searching : announce}
      </p>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t.label}
          className="absolute z-30 mt-2 w-full max-h-80 overflow-auto bg-md-surface-container rounded-3xl shadow-md p-2 list-none"
        >
          {results.length === 0 && (
            <li className="px-4 py-3 text-body text-md-on-surface-variant" aria-disabled="true">
              {loading ? t.searching : t.none}
            </li>
          )}
          {results.map((m, i) => {
            const added = isAdded(m);
            const isActive = i === active;
            return (
              <li
                key={m.rxcui}
                id={optId(i)}
                role="option"
                aria-selected={isActive}
                aria-disabled={added || undefined}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(m)}
                className={`flex items-center justify-between gap-3 rounded-full px-4 min-h-11 py-2 text-body cursor-pointer transition-colors duration-200 ease-md ${
                  isActive ? "bg-md-primary/10" : "hover:bg-md-primary/5"
                } ${added ? "opacity-60 cursor-default" : ""}`}
              >
                <span>{m.name}</span>
                {added && <span className="text-meta text-md-on-surface-variant">{t.added}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
