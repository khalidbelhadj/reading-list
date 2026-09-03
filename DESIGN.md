# Design system

The visual contract for the app. `app/routes/design` renders it live; every
shared component in `components/system/` has a demo there. Decisions below are
final; the candidate rounds that produced them stay on `/design/rounds`.

## Character

Translucent, elegant, slightly warm, rounded, quiet. Closer to a well made
macOS app than to a web dashboard. Nothing announces itself: hierarchy comes
from size, weight, spacing and a single accent, not from borders, gradients or
decoration.

## Decisions

| Foundation | Decision | Values |
| --- | --- | --- |
| Neutrals | **Whisper**: warm grey, hue 70 to 80, chroma ≈0.004 | light bg `oklch(0.985 0.004 80)`, fg `oklch(0.22 0.008 70)`; dark bg `oklch(0.2 0.005 70)`, fg `oklch(0.96 0.004 80)` |
| Accent | **Assistant blue**: the Google Assistant mic blue, Blue 600 in light and Blue 200 in dark (replaced ceremonial matcha on 2026-09-01) | light `oklch(0.575 0.195 258)` on `oklch(0.985 0.002 80)` text; dark `oklch(0.76 0.11 260)` on `oklch(0.2 0.04 260)` text |
| Radius | **Pillowy**: 10px controls, 20px surfaces | `--radius-control: 10px`, `--radius-surface: 20px` |
| Glass | **Frost**: 74% tint, 18px blur, saturate 1.2 | `color-mix(in oklab, var(--card) 74%, transparent)` + `blur(18px)` |
| Type | **Compact**: micro 11, small 12, body 13, title 15, heading 20, display 28; line heights 1.3 / 1.35 / 1.4 / 1.3 / 1.2 / 1.05 (dense, never `leading-relaxed`). Use the small steps: micro for key caps, group labels and captions; small for meta | `text-micro` `text-small` `text-body` `text-title` `text-heading` `text-display` |
| Surface edge | **Hairline and shadow** | `shadow-surface`: 1px inset line at 6% + `0 1px 2px` + `0 8px 24px -8px` |
| Density | **Normal**: 26px list rows, 2px gap (28px read as too sparse in the real reading list); the sidebar sits denser at 24px rows with the same 2px gap; menus and select popups at 24px with no gap | `h-row` (lists, `gap-0.5`), `h-sidebar-row` (sidebar), menu items `h-6` |
| Motion | ease-out quint, 150ms for state, 250ms for layout | `cubic-bezier(0.22, 1, 0.36, 1)` |

## Rules

- One typeface family: DM Sans (`font-content`), DM Mono for code. No others.
- One accent. Everything else is a neutral or a semantic colour (destructive).
- No borders as decoration; no side stripes; no gradient text; no middle dots
  (`·`) or em dashes in UI copy.
- Surfaces are either opaque (`--card`) or frost (`.glass`); never a third kind. Tooltips are the one exception: a flat solid fill, no hairline, no blur.
- Chrome is non-selectable; content is selectable. The sidebar, toolbars,
  section headings, tooltips, hover cards, toasts, field labels, and empty
  states carry `select-none`, set on the container rather than per label.
  Notes, card faces, item titles and metadata, dialog descriptions, error
  text, and anything typed stay selectable.
- Every shared component lives in `components/system/` with a sibling
  `*.demo.tsx` rendered on `/design`; the build fails without the demo.

## Tokens

Defined once in `app/globals.css` and exposed as Tailwind utilities:

| Token | Utility | Purpose |
| --- | --- | --- |
| `--r-control` / `--r-surface` | `rounded-control` / `rounded-surface` | buttons, inputs, rows / cards, panels, dialogs |
| `--edge-surface` | `shadow-surface` | the opaque-surface edge |
| `--row-height` | `h-row` | list row height |
| `--text-*` | `text-micro` … `text-display` | the six type styles |
| `.glass` | `glass` | the frost surface |
| `--starred` | `text-starred` | the gold star on starred items (light `oklch(0.75 0.145 85)`, dark `oklch(0.82 0.15 88)`) |
| `--link` | `text-link` | content links, a normal blue rather than the accent (light `oklch(0.55 0.16 250)`, dark `oklch(0.72 0.14 245)`) |

## Sounds

One instrument, used rarely. Every sound is a short sine tap from
`lib/sounds.ts` (Web Audio, no assets), same envelope family, most under
200 ms, master gain 0.25. A sound marks a moment the eye can miss or a
beginning or an end; it never narrates navigation, saving, sync, or
background work. The full set, auditionable on `/design/components` under
Sound board:

| Moment | Sound |
|---|---|
| A pasted url lands | ascending arpeggio (784, 988, 1318) |
| Answer revealed | the smallest tick (587) |
| Card rated | one tap, pitch steps with the grade (440 + 110 per step) |
| Card skipped | a low tap sliding down (330 to 247), quieter than a grade |
| Queue finished | soft detuned major chord, replaces the last tap |
| Stack started | rising phrase (523, 659, 784), lighter than the paste |
| Starred / unstarred | two notes up (659, 988) / the same two down |
| Item deleted | a low thud (110 to 70), the one weighty sound |
| An error | two low notes down (330, 262); the toast carries the words |

Silent on purpose: opening things, switching queues, notes saving, sync from
another device, the index working. The whole set can be switched off with
Sounds in the settings menu.

## Components

Two layers, both presentation only:

- **Base** (`components/system/`): primitives with no knowledge of the app.
  Anything here could ship in another product unchanged.
- **App** (`components/app/`): compositions shaped by this app (list rows,
  sidebar entries, item and flashcard rows). Built from base; data in as props.

Each component ships with `<name>.demo.tsx` next to it. The demo is what
`/design/components` renders (under Base and App headings) and what
`components/app/demos.test.ts` checks for.
