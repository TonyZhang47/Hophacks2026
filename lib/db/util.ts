/** Utilities shared by both DB adapters (no server-only import so tests/scripts can use them). */
export const STOP_WORDS = new Set(
  `a an and are as at be but by for from had has have he her his i if in is it its me my not of on or our she so that the their them they this to was we were what when which with you your im ive dont didnt cant just really very also been being than then there these those into about after before while more most some such only other one two day days week weeks month months take taking took get got like feel felt still every each also`.split(
    /\s+/,
  ),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/'/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
}

export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
