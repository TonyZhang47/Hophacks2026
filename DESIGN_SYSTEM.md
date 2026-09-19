# RxPlain design system — Material You (Material Design 3)

Adapted from the **Material Design** prompt at [designprompts.dev/material-design](https://www.designprompts.dev/material-design) (open it and press **Prompt** for the full 24k-character original). This file keeps the tokens and rules that matter for RxPlain and adds the accessibility overrides our product needs. **When this file and the original disagree, this file wins.**

## Vibe
Friendly, soft, rounded, colorful, personal. Tonal surfaces instead of stark white. Pill buttons. Organic blurred shapes in the background. Smooth, confident motion (never bouncy, never jarring). Every interactive element gives tactile feedback.

## Tokens (Tailwind theme — put these in `tailwind.config.ts` under `theme.extend.colors.md`)

| Token | Hex | Use |
| --- | --- | --- |
| `md-background` | `#FFFBFE` | Page background. **Never `#FFFFFF`.** |
| `md-on-background` | `#1C1B1F` | Body text. Never pure black. |
| `md-primary` | `#6750A4` | CTAs, focus rings, Listen buttons, active nav |
| `md-on-primary` | `#FFFFFF` | Text on primary |
| `md-secondary-container` | `#E8DEF8` | Chips (med chips, top-terms chips), tonal buttons |
| `md-on-secondary-container` | `#1D192B` | Text on secondary container |
| `md-tertiary` | `#7D5260` | FAB, accents |
| `md-surface-container` | `#F3EDF7` | Cards (interaction cards, dose card, clinic rows, posts) |
| `md-surface-container-low` | `#E7E0EC` | Inputs, recessed areas |
| `md-outline` | `#79747E` | Borders (sparingly), input bottom border |
| `md-on-surface-variant` | `#49454F` | Secondary text, icons |

**Severity tokens (RxPlain-specific; always paired with a text label, never color alone):**

| Token | Hex | Label text |
| --- | --- | --- |
| `sev-major` | `#B3261E` (MD3 error) | "Major" |
| `sev-moderate` | `#7D5260` (tertiary) | "Moderate" |
| `sev-minor` | `#6750A4` (primary) | "Minor" |
| `sev-unknown` | `#79747E` (outline) | "Unknown" |

Use severity color for the graph edge, the card's left accent bar, and the chip background at 15% opacity. The chip **text** is the label word.

**State layers (opacity overlays, not hue changes):**
- Solid button hover `bg-md-primary/90`, active `bg-md-primary/80`
- Transparent hover `bg-md-primary/10`, focus `bg-md-primary/5`

## Typography
- **Font:** Roboto via `next/font/google`, weights 400 / 500 / 700. Headings 500, body 400.
- **RxPlain scale (one step larger than MD3 for low-vision readers):**
  - Display: 3.5rem (hero only)
  - Headline: 2rem
  - Title (card titles): 1.5rem
  - **Body default: 1.25rem / 20px** (MD3 "Body Large"). Never below 1rem anywhere except metadata.
  - Label (buttons/chips): 1rem, weight 500, letter-spacing 0.01em
  - Metadata: 0.875rem (this is the floor)
- Line height 1.5–1.6 for body, 1.2–1.3 for headlines.
- Dose card `plainDose` line: Title size (1.5rem), weight 500.

## Shape
- Buttons, chips, badges, Listen button: `rounded-full` — **always** pill.
- FAB: `rounded-2xl` (28px), 56×56.
- Cards: `rounded-3xl` (24px).
- Hero / major section containers: `rounded-[48px]` desktop, `rounded-3xl` mobile.
- Dialogs / sheets: 28px.
- **Inputs (MD3 filled text field):** `rounded-t-lg` (12px top), square bottom, `bg-md-surface-container-low`, `h-14`, 2px bottom border `border-md-outline` → `border-md-primary` on focus, 200ms color transition.

## Elevation and effects
- Depth comes from tonal surfaces first, shadows second. Cards `shadow-sm` at rest → `shadow-md` on hover; important sections `shadow-lg`; modals `shadow-xl`.
- Shadows are soft and diffuse, near-black at 5–15% opacity.
- **Organic blur shapes** in hero and the Community header: 2–3 large `rounded-full` / `rounded-[100px]` divs, primary / secondary / tertiary at 10–30% opacity, `blur-3xl`, `mix-blend-multiply`, positioned partially off-canvas, **`aria-hidden="true"`**.
- Header: `bg-md-background/80 backdrop-blur-sm border-b border-md-outline/20`.
- Glass cards only inside colored containers: `bg-white/10 backdrop-blur-sm border border-white/10`.

## Motion
- Easing: `cubic-bezier(0.2, 0, 0, 1)` (Emphasized Decelerate).
- Durations: hover/color 200ms, cards/surfaces 300ms, sheets/dialogs 400ms. Never > 500ms.
- `active:scale-95` on every clickable element. `hover:scale-[1.02]` on interactive cards. `group` + `group-hover:` for coordinated effects.
- Animate: background (state layers), shadow, scale, opacity, transform. Don't animate: border radius, layout, hue.
- **`prefers-reduced-motion: reduce` → drop all scale/translate transforms, keep color transitions.** This is mandatory for RxPlain.

## Components (RxPlain mapping)
- **Header:** RxPlain wordmark left, nav (Meds · Community) as text buttons, language selector as an outlined pill, sticky with backdrop blur.
- **Disclaimer banner:** `bg-md-secondary-container` full-width rounded-3xl strip under the header, Body size, persistent.
- **Search + med chips:** filled text field; chips are `rounded-full bg-md-secondary-container` with an × text button; max 10.
- **Interaction cards:** `bg-md-surface-container rounded-3xl p-6` with a 6px left accent in the severity color, a severity chip (label text), the four short paragraphs, and a **Listen** pill button (filled primary, speaker icon + "Listen") top-right.
- **Graph container:** hero-style `rounded-[48px]` surface container with blur shapes behind; edge labels rendered as text.
- **Dose Explainer card:** biggest card on the page. `plainDose` at Title size, `maxPerDayLine` below, Listen button prominent, "Where this came from" as an expandable tonal section. **Fail-closed card** uses `bg-md-secondary-container` with an outlined `sev-major` chip reading "Check with your pharmacist" — still no number.
- **Community → clinics:** list of cards; distance and phone as Body; coverage lines as text chips ("Takes Medicaid · by program rule", "Blue Cross · 2 people confirmed"); `tel:` link as a tonal pill; Listen pill per row.
- **Community → talk:** top-terms chips in a wrapping row at the top (`rounded-full bg-md-secondary-container`, label + count e.g. "nausea · 12"), selected chip becomes filled primary; posts are surface-container cards; the openFDA adverse-reactions panel is an outlined card labeled "From the label".
- **FAB:** tertiary, bottom-right on results: "Read all".
- **Share-sheet PDF:** not styled by this system — plain, high-contrast print layout.

## Accessibility overrides (RxPlain must-haves, beyond the original prompt)
- Body text ≥ 20px; touch targets ≥ 44×44; contrast ≥ 4.5:1 for text (primary `#6750A4` on `#FFFBFE` passes; `md-on-surface-variant` on `md-surface-container` passes).
- Focus: `focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2` on everything interactive.
- Severity, coverage, and status are always words, never color alone.
- Decorative blur shapes are `aria-hidden`; icon-only buttons have `aria-label`; inputs have visible labels.
- Keyboard completes the whole main path; the Listen button is reachable by Tab on every card.
- Reduced motion respected (see Motion).

## Anti-patterns
No pure white backgrounds. No rectangular buttons. No heavy drop shadows. No hue changes on hover. No pure black text. No flat, borderless-bottom inputs. No color-only status. No text under 14px. No animation over 500ms.

## Checklist for Cursor
- [ ] Roboto loaded (400/500/700) via `next/font`
- [ ] `md-*` and `sev-*` tokens in Tailwind config; no raw hex in components
- [ ] Background `#FFFBFE`; cards `#F3EDF7`
- [ ] All buttons/chips `rounded-full`; cards `rounded-3xl`; hero `rounded-[48px]`
- [ ] Filled text field inputs
- [ ] Blur shapes in hero + Community header, `aria-hidden`
- [ ] State-layer hover/active; `active:scale-95`; `cubic-bezier(0.2,0,0,1)`
- [ ] Body 20px; focus rings; reduced-motion media query
- [ ] Severity chips show the word
