import { plainify } from "@/lib/glossary";

/**
 * Renders text with technical terms swapped for plain phrases. Each swap is dotted-underlined
 * and carries the original term in a tooltip / screen-reader description, so nothing is hidden.
 *
 *   <PlainText text="Warfarin is an anticoagulant." />  →  Warfarin is a <u title="anticoagulant">blood thinner</u>.
 */
export function PlainText({ text, className = "", as: Tag = "span" }: { text: string; className?: string; as?: "span" | "p" }) {
  const segs = plainify(text);
  return (
    <Tag className={className}>
      {segs.map((s, i) =>
        s.original ? (
          <span key={i} className="plain-term" title={`Label term: ${s.original}`}>
            {s.text}
            <span className="sr-only"> (label term: {s.original})</span>
          </span>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </Tag>
  );
}
