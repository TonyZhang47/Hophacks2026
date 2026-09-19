# RxPlain design system — rev 3, analytics-dashboard style

Rev 3 replaces the Material You look (rev 2) with the **clean analytics-dashboard** aesthetic the team chose from a reference shot: white panels on a soft gray canvas, hairline borders, charcoal primary buttons, small uppercase section labels with an icon, big KPI numbers with green/red delta pills, dropdown filters in panel corners, and a lot of breathing room. **Token names are unchanged from rev 2 (`md-*`, `sev-*`) so components keep working; only the values changed.** When this file and any older prompt text disagree, this file wins.

## Vibe
Calm, precise, uncluttered. Information is arranged in a **grid of panels**, never a tall stack. Color is reserved for status (severity, coverage, deltas) and the one accent. Everything else is white, gray, and charcoal.

## Tokens (Tailwind `theme.extend.colors.md` / `.sev`)

| Token | Value | Use |
| --- | --- | --- |
| `md-background` | `#F4F5F7` | Page canvas |
| `md-on-background` | `#111318` | Primary text |
| `md-primary` | `#111318` | Filled buttons, active nav, selected chips |
| `md-on-primary` | `#FFFFFF` | Text on primary |
| `md-secondary-container` | `#F1F2F4` | Chips, tonal buttons, nested wells |
| `md-tertiary` | `#2563EB` | The single accent: chart lines, links, info pills |
| `md-surface-container` | `#FFFFFF` | Panels, cards, inputs |
| `md-surface-container-low` | `#F8F9FB` | Recessed wells inside panels |
| `md-outline` | `#E4E6EA` | Hairline borders |
| `md-outline-strong` | `#C9CCD2` | Hover borders, dotted underlines |
| `md-on-surface-variant` | `#6B7280` | Secondary text, icons, eyebrows |
| `md-success` / `md-warning` / `md-error` | `#16A34A` / `#D97706` / `#DC2626` | Delta pills, status |

**Severity (always a word + a dot + tint, never color alone):** `sev-major #DC2626`, `sev-moderate #D97706`, `sev-minor #2563EB`, `sev-unknown #6B7280`. Use `SeverityChip`.

## Typography
- **Inter** via `next/font/google`, 400/500/600/700. Headings 600.
- Scale (Tailwind `fontSize`): `display` 36px · `headline` 24px · `title` 18px · `kpi` 32px/600 · `body` 17px · `label` 15px/500 · `meta` 13px · `eyebrow` 12px/600 uppercase, 0.08em tracking.
- Body is 17px (a step above the reference's 13–14px) for the low-vision audience; never below `meta` (13px).
- Numbers use tabular figures (`font-feature-settings: "tnum"` is on body).

## Shape, borders, elevation
- Panels/cards: `.panel` = white, `border border-md-outline`, `rounded-2xl` (16px), `shadow-sm`. Hover on interactive cards → `shadow-md` only (no scale).
- Buttons and chips: pill (`rounded-full`). Filled = charcoal. Tonal = light gray with border. Outlined = white with border.
- Inputs: white, hairline border, `rounded-lg` (10px), 44px tall, border turns charcoal on focus. No MD3 bottom-border fields.
- Dropdown filters in panel headers: pill selects, 36px tall (`Select` in `components/ui/TextField`).
- No decorative blur shapes, no gradients, no colored section backgrounds. `BlurBackdrop` renders nothing.

## Layout — the rules that matter most
1. **Grid, not stack.** Pages are a 12-column grid with 24px gutters (`grid grid-cols-12 gap-6`). Desktop compositions put panels side by side; a panel is only allowed to sit alone in a row if it is the graph or a table that needs the width. Mobile collapses to one column.
2. **Page header row** replaces the hero: `PageHeader` = title (24px) + one-line subtitle on the left, primary actions on the right. ~24px above, ~16px below.
3. **KPI row** directly under the page header when there are numbers to show: 3–4 `StatTile`s in one row (`grid-cols-2 lg:grid-cols-4`).
4. **Panel anatomy:** `PanelHeader` (icon + uppercase eyebrow title + optional subtitle; actions/filters on the right) → 16px → body. Panel padding 20px. Inside a panel use `KeyValue` rows or dense cards; never nest a panel in a panel more than one level.
5. **Whitespace budget:** 24px between panels, 16px between panel header and body, 12px between list items, 8px between chips. If two things compete for the same column, split the column rather than stacking a third panel.
6. **Sticky sidebars only on lg+:** on the Meds page the left column (medicine list + actions) may be `lg:sticky lg:top-20`.
7. **Long lists live inside a panel with their own scroll** (`max-h-[70vh] overflow-y-auto`) so the page stays a dashboard, not a scroll of cards.

### Meds page composition (lg+)
```
PageHeader: "Your medicines" · subtitle · [Try a demo set] [Download share sheet]
StatTiles:   Major n · Moderate n · Minor n · Unknown n    (one row)
Row A:  col-span-4  Panel "My medicines"  (search, chips, Check button, Read-all)
        col-span-8  Panel "Map of your medicines" (graph + legend + edge list)
Row B:  col-span-12 Panel "Possible interactions" (cards in a 2-col grid inside, own scroll)
Row C:  col-span-7  Panel "How much and when" (dose explainer, scan button)
        col-span-5  Panel "Share sheet" (preview lines + download) 
```
### Community page composition (lg+)
```
PageHeader: "People near you" · subtitle
Row A:  col-span-5  Panel "Find a clinic" (form on top, results list below with own scroll)
        col-span-7  Panel "Medication talk": header with med filter dropdown;
                    inside: 2-col — left top-terms + official-label well, right post list + form
```

## Components (RxPlain mapping)
- **Header:** white, bottom hairline, "Rx" charcoal mark + wordmark, pill nav (active = charcoal), right side: **Read page** (outlined, speaker icon) and language pill select.
- **Disclaimer:** slim white panel with info icon, 13px text. Not a colored banner.
- **Listen button:** filled charcoal pill with speaker icon; `size="sm"` inside panel headers; `iconOnly` in dense rows. Every panel that outputs text has one in its header; the share sheet panel and clinic rows too.
- **Read selection:** selecting any text on the page shows a floating Listen pill next to it (`ReadSelection`, mounted in the layout).
- **Plain terms:** all label/database text passes through `PlainText`; replaced terms get a dotted underline with the original in the tooltip. Speech uses `plainifyForSpeech`.
- **Common names:** medicine chips and card titles show the generic with brands: "Ibuprofen · Advil, Motrin" (`lib/plainNames`).
- **Interaction cards:** dense `Card` with 4px left accent in severity color, title row (pair + `SeverityChip` + Listen iconOnly), then a 2-col grid of the four labeled sections.
- **Graph panel:** white, edges colored by severity with the word as edge label, legend chips beneath.
- **Dose explainer:** panel with a two-button entry — **Scan my bottle** (camera/file) and **Type the directions** — then the confirmation well, then the result well. Fail-closed result uses a `StatusPill tone="error"` reading "Check with your pharmacist" and no numbers.
- **Clinic rows:** dense cards with name, site type in words, distance + address, `tel:` tonal pill, coverage `StatusPill`s (words), Listen iconOnly.
- **Share sheet panel:** what will print (meds, flagged pairs, dose lines) as `KeyValue` rows + the download button.

## Motion
`cubic-bezier(0.2,0,0,1)`, 150–250ms, only for color/shadow/opacity. `active:scale-95` on buttons. Reduced-motion media query removes transforms.

## Accessibility (unchanged, mandatory)
Body ≥ 17px, targets ≥ 40px, contrast ≥ 4.5:1 for text (charcoal on white and `#6B7280` on white both pass), visible focus ring, status = words, `aria-live` on result regions, keyboard-operable tabs and listboxes, no color-only meaning, every Listen control has an `aria-label`.

## Anti-patterns
No purple, no blur shapes, no giant rounded hero, no more than two panels stacked before a horizontal split, no full-width single-column pages on desktop, no color-only status, no text under 13px, no shadows heavier than `shadow-md` at rest.
