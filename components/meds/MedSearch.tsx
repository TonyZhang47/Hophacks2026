"use client";

import { useEffect, useId, useRef, useState } from "react";
import { filterCommon, mergeLive, GENERIC_OPTIONS } from "@/lib/medOptions";
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
const LIVE_MIN_CHARS = 3;
const LIVE_WHEN_FEWER_THAN = 3;

/**
 * Medicine picker. Clicking the field opens the full, scrollable list; typing filters it
 * instantly (generic or brand name), and a live RxNorm lookup fills in anything the
 * bundled list does not know. Keyboard: up/down/enter/escape, aria-activedescendant.
 */
export function MedSearch({ meds, onAdd, max = 10 }: MedSearchProps) {
  const { lang } = useLang();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Med[]>(GENERIC_OPTIONS);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [announce, setAnnounce] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
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
            : "Haga clic para ver la lista, o escriba para filtrar. Agregue de 1 a 10 medicamentos.",
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
            : "Click to browse the list, or type to filter. Add 1 to 10 medicines.",
          none: "Nothing found with that name.",
          added: "already added",
          count: (n: number) => (n === 1 ? "1 result" : `${n} results`),
          searching: "Searching…",
          addedMsg: (s: string) => `${s} added.`,
        };

  // Local filter is instant; the live lookup only runs when the bundled list is thin.
  useEffect(() => {
    const query = q.trim();
    abortRef.current?.abort();
    const local = filterCommon(query);
    setResults(local);
    setActive(local.length ? 0 : -1);
    setAnnounce(local.length ? t.count(local.length) : t.none);
    if (query.length < LIVE_MIN_CHARS || local.length >= LIVE_WHEN_FEWER_THAN) {
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
        const merged = mergeLive(local, data.results);
        setResults(merged);
        setActive(merged.length ? 0 : -1);
        setAnnounce(merged.length ? t.count(merged.length) : t.none);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setAnnounce(local.length ? t.count(local.length) : t.none);
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

  // Keep the active option in view while arrowing through a long list.
  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(optId(active))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open]);

  const isAdded = (m: Med) => meds.some((x) => x.rxcui === m.rxcui);

  const choose = (m: Med) => {
    if (full || isAdded(m)) return;
    onAdd(m);
    setQ("");
    setOpen(false);
    setActive(-1);
    setAnnounce(t.addedMsg(medLabelText(m)));
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (!results.length) return;
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
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? optId(active) : undefined}
        style={{ paddingLeft: "2.5rem" }}
      />

      <p aria-live="polite" className="sr-only">
        {loading ? t.searching : announce}
      </p>

      {open && !full && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          aria-label={t.label}
          className="panel absolute z-30 top-12 w-full max-h-72 overflow-y-auto overscroll-contain shadow-md p-1.5 list-none"
        >
          {results.length === 0 && (
            <li className="px-3 py-2.5 text-body text-md-on-surface-variant" aria-disabled="true">
              {loading ? t.searching : t.none}
            </li>
          )}
          {results.map((m, i) => {
            const added = isAdded(m);
            const isActive = i === active;
            const { generic } = medLabel(m);
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
                className={`flex items-center justify-between gap-3 rounded-lg px-3 min-h-10 py-1.5 cursor-pointer transition-colors duration-200 ease-md ${
                  isActive ? "bg-md-secondary-container" : "hover:bg-md-surface-container-low"
                } ${added ? "opacity-60 cursor-default" : ""}`}
              >
                <span className="min-w-0 truncate text-label text-md-on-background">{generic}</span>
                {added && <span className="shrink-0 text-meta text-md-on-surface-variant">{t.added}</span>}
              </li>
            );
          })}
          {loading && results.length > 0 && (
            <li className="px-3 py-2 text-meta text-md-on-surface-variant" aria-disabled="true">
              {t.searching}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
