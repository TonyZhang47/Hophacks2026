"use client";
import { useState } from "react";
import { ArrowDown, ArrowRight, Leaf, Pill } from "lucide-react";
import type { FoodResult } from "@/lib/food";
import { SeverityChip } from "@/components/ui/SeverityChip";
import { useLang } from "@/components/LanguageContext";

export function FoodMap({
  results,
  onSelect,
}: {
  results: FoodResult[];
  onSelect?: () => void;
}) {
  const { lang } = useLang();
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="food-map space-y-3 p-4 sm:p-7 rounded-2xl">
      <div className="flex justify-between text-meta uppercase tracking-widest mb-5">
        <span>{lang === "es" ? "Medicamento" : "Medicine"}</span>
        <span>{lang === "es" ? "Alimento o bebida" : "Food & drink"}</span>
      </div>
      {results.length ? (
        results.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-label={`${r.medicine.name}, ${r.food}, ${r.severity}. View details`}
            aria-pressed={selected === r.id}
            onClick={() => {
              setSelected(r.id);
              onSelect?.();
              requestAnimationFrame(() => {
                const el = document.getElementById(`food-${r.id}`);
                el?.scrollIntoView({
                  behavior: window.matchMedia(
                    "(prefers-reduced-motion: reduce)",
                  ).matches
                    ? "auto"
                    : "smooth",
                  block: "center",
                });
                el?.focus({ preventScroll: true });
              });
            }}
            className="map-connection group w-full grid grid-cols-[1fr_48px_1fr] sm:grid-cols-[1fr_100px_1fr] items-center text-left"
          >
            <span className="map-node">
              <Pill size={18} />
              <span>{r.medicine.name}</span>
            </span>
            <span
              className={`map-line ${r.severity === "unknown" ? "map-line-unknown" : ""}`}
            >
              <ArrowRight size={16} />
            </span>
            <span className="map-node !bg-white flex-col !items-start">
              <span className="flex gap-2 items-center">
                <Leaf size={17} />
                {r.food}
              </span>
              <SeverityChip severity={r.severity} />
            </span>
          </button>
        ))
      ) : (
        <div className="py-7 text-center">
          <div className="flex items-center justify-center gap-8 mb-6">
            <span className="map-node">
              <Pill /> {lang === "es" ? "Su medicina" : "Your medicine"}
            </span>
            <ArrowRight size={22} />
            <span className="map-node">
              <Leaf /> {lang === "es" ? "Su comida" : "Your food"}
            </span>
          </div>
          <p className="text-md-on-surface-variant">
            {lang === "es"
              ? "Agregue un medicamento y revise los alimentos para conectar los puntos."
              : "Add a medicine and check foods to connect the dots."}
          </p>
        </div>
      )}
      {!!results.length && (
        <p className="text-meta text-md-on-surface-variant pt-3 flex gap-2">
          <ArrowDown size={15} />
          {lang === "es"
            ? "Seleccione una conexión para leer su explicación."
            : "Select a connection to read its explanation below."}
        </p>
      )}
    </div>
  );
}
