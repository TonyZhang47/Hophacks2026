"use client";

import { useEffect, useId, useRef, useState } from "react";
import commonMeds from "@/data/common_meds.json";
import { useLang } from "@/components/LanguageContext";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { genericFor } from "@/lib/plainNames";
import { medLabel, medLabelText } from "@/components/meds/MedChips";
import { Search } from "lucide-react";
import type { Med } from "@/lib/types";

const DEBOUNCE_MS = 250;
const REMOTE_MAX = 8;

const OPTIONS = (commonMeds as Med[]).filter(
  (m, i, a) => a.findIndex((x) => x.rxcui === m.rxcui) === i,
);

function allGenerics(): Med[] {
  return OPTIONS.filter((m) => !m.name.includes("("));
}

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Instant local filter of the bundled list (name, ingredient, brand aliases). */
function filterCommon(q: string): Med[] {
  const needle = norm(q);
  if (!needle) return allGenerics();
  const scored: { med: Med; score: number }[] = [];
  for (const med of OPTIONS) {
    const name = norm(med.name);
    const ing = (med.ingredientName ?? "").toLowerCase();
    let score = -1;
    if (name.startsWith(needle) || ing.startsWith(needle)) score = 0;
    else if (name.split(/[\s(]+/).some((w) => w.startsWith(needle))) score = 1;
    else if (name.includes(needle) || ing.includes(needle)) score = 2;
    if (score >= 0) scored.push({ med, score });
  }
  scored.sort((x, y) => x.score - y.score || x.med.name.localeCompare(y.med.name));
  const seen = new Set<string>();
  const out: Med[] = [];
  for (const { med } of scored) {
    if (seen.has(med.rxcui)) continue;
    seen.add(med.rxcui);
    out.push(OPTIONS.find((m) => m.rxcui === med.rxcui && !m.name.includes("(")) ?? med);
  }
  return out;
}

function mergeByRxcui(local: Med[], remote: Med[], needle: string): Med[] {
  const q = norm(needle);
  const matches = (m: Med) => {
    if (!q) return true;
    return norm(m.name).includes(q) || norm(m.ingredientName ?? "").includes(q);
  };
  const seen = new Set(local.map((m) => m.rxcui));
  const out = [...local];
  let extra = 0;
  for (const m of remote) {
    if (seen.has(m.rxcui) || !matches(m)) continue;
    seen.add(m.rxcui);
    out.push(m);
    extra++;
    if (extra >= REMOTE_MAX) break;
  }
  return out;
}

export function MedicinePicker({
  value,
  onChange,
  label,
}: {
  value: Med | null;
  onChange: (m: Med) => void;
  label: string;
}) {
  const { lang } = useLang();
  const es = lang === "es";
  const [q, setQ] = useState(value ? medLabelText(value) : "");
  const [results, setResults] = useState<Med[]>(() => filterCommon(""));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [announce, setAnnounce] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const selectedRxcui = value?.rxcui ?? "";
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optId = (i: number) => `${baseId}-opt-${i}`;

  const t = es
    ? {
        placeholder: "Escriba un nombre o marca, p. ej. metformina",
        hint: "Escriba para ver coincidencias. Elija una de la lista.",
        none: "No encontramos nada con ese nombre.",
        searching: "Buscando…",
        count: (n: number) => (n === 1 ? "1 resultado" : `${n} resultados`),
        addTyped: "Usar este nombre",
        selected: (s: string) => `${s} seleccionado.`,
      }
    : {
        placeholder: "Type a name or brand, e.g. metformin",
        hint: "Type to see matches. Choose one from the list.",
        none: "Nothing found with that name.",
        searching: "Searching…",
        count: (n: number) => (n === 1 ? "1 result" : `${n} results`),
        addTyped: "Use this name",
        selected: (s: string) => `${s} selected.`,
      };

  useEffect(() => {
    setQ(value ? medLabelText(value) : "");
  }, [selectedRxcui]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const query = q.trim();
    const selectedLabel = value ? medLabelText(value) : "";
    if (value && query === selectedLabel) {
      abortRef.current?.abort();
      setResults(filterCommon(""));
      setLoading(false);
      return;
    }
    const local = filterCommon(query);
    setResults(local);
    setActive(local.length ? 0 : -1);
    abortRef.current?.abort();
    if (query.length < 2) {
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/meds/search?q=${encodeURIComponent(query)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { results: Med[] };
        const merged = mergeByRxcui(local, data.results ?? [], query);
        setResults(merged);
        setActive(merged.length ? 0 : -1);
        setAnnounce(merged.length ? t.count(merged.length) : t.none);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setResults(local);
          setAnnounce(local.length ? t.count(local.length) : t.none);
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

  const choose = (m: Med) => {
    onChange(m);
    setQ(medLabelText(m));
    setOpen(false);
    setActive(-1);
    setAnnounce(t.selected(medLabelText(m)));
  };

  const addTyped = () => {
    const name = q.trim().slice(0, 80);
    if (name.length < 2) return;
    const generic = genericFor(name) || name.toLowerCase();
    const known = OPTIONS.find(
      (m) => m.name.toLowerCase() === name.toLowerCase() || m.ingredientName === generic,
    );
    choose(
      known || {
        name,
        rxcui: `manual:${name.toLowerCase()}`,
        ingredientName: generic,
      },
    );
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
    if (!results.length) {
      if (e.key === "Enter") {
        e.preventDefault();
        addTyped();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && results[active]) choose(results[active]);
    }
  };

  return (
    <div className="relative w-full max-w-md">
      <Search
        className="pointer-events-none absolute left-3.5 top-[3rem] -translate-y-1/2 h-4 w-4 text-md-on-surface-variant z-10"
        aria-hidden="true"
      />
      <TextField
        ref={inputRef}
        label={label}
        placeholder={t.placeholder}
        hint={t.hint}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onFocus={(e) => {
          e.currentTarget.select();
          setResults(filterCommon(""));
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? optId(active) : undefined}
        style={{ paddingLeft: "2.5rem" }}
      />
      {q.trim().length >= 2 &&
        q.trim() !== (value ? medLabelText(value) : "") &&
        !results.length &&
        !loading && (
        <Button variant="text" size="sm" className="mt-1" onClick={addTyped}>
          {t.addTyped}
        </Button>
      )}
      <p aria-live="polite" className="sr-only">
        {loading ? t.searching : announce}
      </p>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="panel absolute z-30 top-[4.75rem] w-full max-h-80 overflow-auto shadow-md p-1.5 list-none"
        >
          {results.length === 0 && (
            <li className="px-3 py-2.5 text-body text-md-on-surface-variant" aria-disabled="true">
              {loading ? t.searching : t.none}
            </li>
          )}
          {results.map((m, i) => {
            const isActive = i === active;
            const selected = m.rxcui === selectedRxcui;
            const { generic, brands } = medLabel(m);
            return (
              <li
                key={`${m.rxcui}-${m.name}`}
                id={optId(i)}
                role="option"
                aria-selected={isActive}
                aria-label={medLabelText(m)}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(m)}
                className={`flex items-center justify-between gap-3 rounded-lg px-3 min-h-11 py-2 cursor-pointer transition-colors duration-200 ease-md ${
                  isActive ? "bg-md-secondary-container" : "hover:bg-md-surface-container-low"
                }`}
              >
                <span className="min-w-0 truncate">
                  <span className="text-label text-md-on-background">{generic}</span>
                  {brands.length > 0 && (
                    <span className="text-meta text-md-on-surface-variant"> · {brands.join(", ")}</span>
                  )}
                </span>
                {selected && (
                  <span className="shrink-0 text-meta text-md-on-surface-variant">
                    {es ? "elegido" : "selected"}
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
