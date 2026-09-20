/**
 * Pharmacy labels are often printed in all caps. After OCR, show normal
 * sentence capitalization so the directions box and “You wrote” are readable.
 * Numbers, %, and common units/abbreviations stay conventional.
 */

const UNIT_FIX: Record<string, string> = {
  mg: "mg",
  mcg: "mcg",
  ml: "mL",
  mls: "mL",
  hcl: "HCl",
  bid: "BID",
  tid: "TID",
  qid: "QID",
  prn: "PRN",
  po: "PO",
  xr: "XR",
  er: "ER",
  sr: "SR",
  cr: "CR",
  ir: "IR",
};

function lettersOf(s: string): string {
  return s.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü]/g, "");
}

function capitalizeSentences(s: string): string {
  return s.replace(/(^|[.!?]\s+)([a-záéíóúñü])/g, (_, pre: string, ch: string) => pre + ch.toUpperCase());
}

function formatOcrLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return "";
  const letters = lettersOf(trimmed);
  if (!letters) return trimmed;
  const upper = (trimmed.match(/[A-ZÁÉÍÓÚÑÜ]/g) ?? []).length;
  // Short all-caps tokens (BID, PRN) stay as printed.
  if (letters.length <= 4 && upper === letters.length) return trimmed;
  // Leave mixed- or lower-case text alone — only rewrite pharmacy all-caps.
  if (upper / letters.length < 0.65) return trimmed;
  const source = trimmed.toLowerCase().replace(/\b([a-z]+)\b/g, (w) => UNIT_FIX[w] ?? w);
  return capitalizeSentences(source);
}

export function formatOcrLabelText(text: string): string {
  return text
    .split(/\r?\n/)
    .map(formatOcrLine)
    .join("\n")
    .trim();
}
