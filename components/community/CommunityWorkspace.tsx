"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { MapPin, MessagesSquare } from "lucide-react";
import { BlurBackdrop } from "@/components/ui/BlurBackdrop";
import { ClinicFinder } from "@/components/community/ClinicFinder";
import { MedicationTalk } from "@/components/community/MedicationTalk";

type PanelId = "clinics" | "talk";

const PANELS: { id: PanelId; label: string; Icon: typeof MapPin }[] = [
  { id: "clinics", label: "Find a clinic", Icon: MapPin },
  { id: "talk", label: "Medication talk", Icon: MessagesSquare },
];

/**
 * /community — two panels. Tabs below lg (keyboard: ←/→/Home/End move focus and select),
 * side by side on lg and up (both panels always rendered so state survives resizing).
 */
export function CommunityWorkspace() {
  const [active, setActive] = useState<PanelId>("clinics");
  const [wide, setWide] = useState(false);
  const tabRefs = useRef<Record<PanelId, HTMLButtonElement | null>>({ clinics: null, talk: null });
  const baseId = useId();

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
      const order = PANELS.map((p) => p.id);
      let next = idx;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % order.length;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + order.length) % order.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = order.length - 1;
      else return;
      e.preventDefault();
      setActive(order[next]);
      tabRefs.current[order[next]]?.focus();
    },
    [],
  );

  return (
    <div className="space-y-6 py-6">
      <header className="relative overflow-hidden rounded-3xl md:rounded-[48px] bg-md-surface-container px-6 py-10 md:px-12 md:py-14 shadow-lg">
        <BlurBackdrop variant="community" />
        <div className="relative space-y-4 max-w-3xl">
          <h1 className="text-headline md:text-display">People near you</h1>
          <p className="text-body text-md-on-surface-variant">
            Find a clinic that takes your coverage, and hear what others say about their medicines.
          </p>
          <p
            role="note"
            className="inline-flex items-center rounded-full bg-md-secondary-container text-md-on-secondary-container px-5 py-2 text-label"
          >
            Anonymous and public. Not medical advice. Please don&rsquo;t share personal details.
          </p>
        </div>
      </header>

      {/* Tabs (below lg only). Both panels stay mounted; hidden ones are display:none. */}
      <div
        role="tablist"
        aria-label="Community sections"
        className={`flex gap-2 rounded-full bg-md-surface-container p-1 ${wide ? "lg:hidden" : ""}`}
      >
        {PANELS.map(({ id, label, Icon }, idx) => {
          const selected = active === id;
          return (
            <button
              key={id}
              ref={(el) => {
                tabRefs.current[id] = el;
              }}
              role="tab"
              id={`${baseId}-tab-${id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(id)}
              onKeyDown={(e) => onKeyDown(e, idx)}
              className={`flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-full text-label transition-all duration-200 ease-md active:scale-95 focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2 ${
                selected
                  ? "bg-md-primary text-md-on-primary shadow-sm"
                  : "text-md-primary hover:bg-md-primary/10"
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        {PANELS.map(({ id, label }) => {
          const hidden = !wide && active !== id;
          return (
            <section
              key={id}
              role={wide ? undefined : "tabpanel"}
              id={`${baseId}-panel-${id}`}
              aria-labelledby={wide ? undefined : `${baseId}-tab-${id}`}
              hidden={hidden}
              className={hidden ? "hidden" : "space-y-6"}
            >
              <h2 className="text-title">{label}</h2>
              {id === "clinics" ? <ClinicFinder /> : <MedicationTalk />}
            </section>
          );
        })}
      </div>
    </div>
  );
}
