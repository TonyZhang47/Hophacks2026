"use client";

import { useEffect, useRef } from "react";
import type { Core } from "cytoscape";
import { SeverityChip } from "@/components/ui/SeverityChip";
import { useLang } from "@/components/LanguageContext";
import { cardId } from "@/components/meds/InteractionCardList";
import { shortName } from "@/lib/plainNames";
import type { InteractionResult, Med, Severity } from "@/lib/types";

/**
 * Raw hex is allowed ONLY here: Cytoscape paints to canvas and cannot read Tailwind classes.
 * These mirror the `sev-*` and `md-*` tokens in tailwind.config.ts (rev 3). Keep them in sync.
 */
const SEV_HEX: Record<Severity, string> = {
  major: "#DC2626", // sev-major
  moderate: "#D97706", // sev-moderate
  minor: "#2563EB", // sev-minor
  unknown: "#6B7280", // sev-unknown
};
const NODE_BG = "#FFFFFF"; // md-surface-container
const NODE_BORDER = "#C9CCD2"; // md-outline-strong
const NODE_TEXT = "#111318"; // md-on-background
const EDGE_TEXT_BG = "#FFFFFF"; // md-surface-container
const FONT = "var(--font-inter), Inter, system-ui, sans-serif";

const SEV_WIDTH: Record<Severity, number> = { major: 5, moderate: 4, minor: 3, unknown: 2 };

const SEV_WORD = {
  en: { major: "major", moderate: "moderate", minor: "minor", unknown: "unknown" } as Record<Severity, string>,
  es: { major: "mayor", moderate: "moderada", minor: "menor", unknown: "desconocida" } as Record<Severity, string>,
};

export interface InteractionGraphProps {
  meds: Med[];
  results: InteractionResult[];
}

/**
 * Body of the "Map of your medicines" panel: the Cytoscape canvas (white), an sr-only
 * edge list, and a severity legend. The panel header is rendered by the workspace.
 */
export function InteractionGraph({ meds, results }: InteractionGraphProps) {
  const { lang } = useLang();
  const hostRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const words = SEV_WORD[lang];
  const t =
    lang === "es"
      ? {
          hint: "Cada línea es una posible interacción. Toque una línea para ir a su tarjeta.",
          hintNoResults: "Sus medicamentos aparecen aquí. Revíselos para ver las líneas entre ellos.",
          legend: "Leyenda",
          ariaIntro: "Mapa de interacciones.",
          pairs: (n: number) => (n === 1 ? "1 par" : `${n} pares`),
          list: "Lista de pares para lectores de pantalla",
          and: "y",
        }
      : {
          hint: "Each line is a possible interaction. Tap a line to jump to its card.",
          hintNoResults: "Your medicines appear here. Check them to see the lines between them.",
          legend: "Legend",
          ariaIntro: "Interaction map.",
          pairs: (n: number) => (n === 1 ? "1 pair" : `${n} pairs`),
          list: "List of pairs for screen readers",
          and: "and",
        };

  const edgeSentences = results.map((r) => `${shortName(r.a).generic} ${t.and} ${shortName(r.b).generic}: ${words[r.severity]}`);
  const ariaLabel = `${t.ariaIntro} ${t.pairs(results.length)}. ${edgeSentences.join(". ")}.`;

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    (async () => {
      const cytoscape = (await import("cytoscape")).default;
      if (cancelled || !hostRef.current) return;

      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

      const elements = [
        ...meds.map((m) => ({ data: { id: m.rxcui, label: shortName(m).generic } })),
        ...results.map((r) => ({
          data: {
            id: `e-${cardId(r.a.rxcui, r.b.rxcui)}`,
            source: r.a.rxcui,
            target: r.b.rxcui,
            severity: r.severity,
            label: words[r.severity],
            color: SEV_HEX[r.severity],
            width: SEV_WIDTH[r.severity],
            a: r.a.rxcui,
            b: r.b.rxcui,
          },
        })),
      ];

      cyRef.current?.destroy();
      const cy = cytoscape({
        container: hostRef.current,
        elements,
        userZoomingEnabled: false,
        userPanningEnabled: false,
        boxSelectionEnabled: false,
        autoungrabify: true,
        style: [
          {
            selector: "node",
            style: {
              "background-color": NODE_BG,
              "border-color": NODE_BORDER,
              "border-width": 1,
              label: "data(label)",
              color: NODE_TEXT,
              "font-family": FONT,
              "font-size": 15,
              "font-weight": 500,
              "text-valign": "center",
              "text-halign": "center",
              "text-wrap": "wrap",
              "text-max-width": "120",
              width: "label",
              height: "label",
              padding: "12px",
              shape: "round-rectangle",
            },
          },
          {
            selector: "edge",
            style: {
              "line-color": "data(color)",
              width: "data(width)",
              "curve-style": "bezier",
              label: "data(label)",
              "font-family": FONT,
              "font-size": 13,
              "font-weight": 500,
              color: "data(color)",
              "text-background-color": EDGE_TEXT_BG,
              "text-background-opacity": 1,
              "text-background-padding": "3px",
              "text-background-shape": "roundrectangle",
              "text-rotation": "autorotate",
              "line-style": "solid",
            },
          },
          { selector: "edge[severity = 'unknown']", style: { "line-style": "dashed" } },
          { selector: "edge:active, edge.hover", style: { "overlay-opacity": 0.08 } },
        ],
        layout: { name: "circle", padding: 32, animate: !reduced, animationDuration: 300 },
      });

      cy.on("mouseover", "edge", (e) => {
        e.target.addClass("hover");
        host.style.cursor = "pointer";
      });
      cy.on("mouseout", "edge", (e) => {
        e.target.removeClass("hover");
        host.style.cursor = "";
      });
      cy.on("tap", "edge", (e) => {
        const { a, b } = e.target.data() as { a: string; b: string };
        const el = document.getElementById(cardId(a, b));
        if (!el) return;
        el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
        el.focus({ preventScroll: true });
      });

      cyRef.current = cy;
    })();

    return () => {
      cancelled = true;
      cyRef.current?.destroy();
      cyRef.current = null;
    };
    // Rebuild only when the data changes; `words` is derived from lang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meds, results, lang]);

  useEffect(() => {
    const onResize = () => {
      cyRef.current?.resize();
      cyRef.current?.fit(undefined, 32);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!meds.length) return null;

  return (
    <div className="space-y-3">
      <p className="text-meta text-md-on-surface-variant">{results.length ? t.hint : t.hintNoResults}</p>

      <div className="overflow-hidden rounded-lg border border-md-outline bg-md-surface-container">
        <div ref={hostRef} role="img" aria-label={ariaLabel} className="h-[360px] w-full" />
      </div>

      <ul className="sr-only" aria-label={t.list}>
        {edgeSentences.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2" aria-label={t.legend}>
        <span className="text-meta font-medium text-md-on-surface-variant mr-1">{t.legend}:</span>
        {(["major", "moderate", "minor", "unknown"] as Severity[]).map((s) => (
          <SeverityChip key={s} severity={s} />
        ))}
      </div>
    </div>
  );
}
