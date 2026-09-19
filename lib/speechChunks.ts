/** Preserve every character while staying below each TTS request limit. */
export function speechChunks(text: string, max = 3000): string[] {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    let end = rest.lastIndexOf(". ", max);
    if (end > max / 2) end++;
    else {
      end = rest.lastIndexOf(" ", max);
      if (end < 1) end = max;
    }
    out.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  if (rest) out.push(rest);
  return out;
}
