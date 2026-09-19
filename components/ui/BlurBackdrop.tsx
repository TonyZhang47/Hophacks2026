/**
 * Rev 3 (dashboard style) has no decorative blur shapes. Kept as a no-op so
 * existing call sites compile; remove call sites when you touch them.
 */
export function BlurBackdrop(_props: { variant?: "hero" | "community" }) {
  return null;
}
