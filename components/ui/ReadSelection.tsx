"use client";

import { useEffect, useState } from "react";
import { ListenButton } from "@/components/ui/ListenButton";

/**
 * Select any text on the page → a small "Listen" pill appears next to it.
 * Complements the per-card Listen buttons and the header "Read page" control.
 */
export function ReadSelection() {
  const [sel, setSel] = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    const update = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const s = window.getSelection();
        const text = s?.toString().trim() ?? "";
        if (!s || s.rangeCount === 0 || text.length < 4) return setSel(null);
        // Ignore selections inside inputs (they have their own affordances).
        const node = s.anchorNode?.parentElement;
        if (node?.closest("input, textarea, [contenteditable]")) return setSel(null);
        const r = s.getRangeAt(0).getBoundingClientRect();
        if (!r.width && !r.height) return setSel(null);
        setSel({ text, x: Math.min(r.right, window.innerWidth - 140), y: Math.max(r.top - 44, 8) });
      }, 150);
    };
    document.addEventListener("selectionchange", update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      document.removeEventListener("selectionchange", update);
      window.removeEventListener("scroll", update);
      window.clearTimeout(timer);
    };
  }, []);

  if (!sel) return null;
  return (
    <div
      className="fixed z-50 pointer-events-auto"
      style={{ left: sel.x, top: sel.y }}
      role="region"
      aria-label="Read selected text"
    >
      <ListenButton text={sel.text} label="Listen to selection" size="sm" variant="filled" className="shadow-lg" />
    </div>
  );
}
