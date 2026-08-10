# The reader replaces the list, and how its size is derived (2026-08-08)

**What changed.** "Read in app" used to add a third column: the reader docked
to the right edge, the item panel forced into expanded mode and pushed left of
it, the list buried underneath. Now the reader stands in for the *items list*
— it occupies the main column, the notes stay in their ordinary docked side
view on the right, and the two are a split rather than a stack.

Two consequences that are easy to miss when reading the diff:

- **The reader is not a panel**, despite the file name. The item panel beside
  it is a floating card (border, radius, shadow, `bg-surface`); the reader is
  bare content on `bg-background`, in the exact box the list occupies. That is
  deliberate — card chrome made it read as a third thing stacked over the
  layout instead of the main column changing what it shows.
- **It cross-fades, it does not slide.** Nothing is arriving from off-screen,
  so a slide was lying about the motion. `lib/use-linger.ts` keeps it mounted
  for `FADE_MS` past its own close so the dissolve back to the list can play;
  everything that decides *behaviour* reads the live value, and only rendering
  and the covered-layer flags read the lingering one.

## Publish the edge, not the size

The reader has no size of its own. It fills the main column up to wherever the
notes panel says it must stop, published by `SlidingItemPanel` as
`--notes-inset-right` / `--notes-inset-bottom` and read straight into the
reader's trailing insets. That keeps exactly one resize handle on the single
boundary between the panes, and lets a drag move both edges without a React
render on the reader at all.

The subtle part is **what the variable means**. The first version published
the panel's *size* and had the reader add the gap itself. That works docked to
the side and is wrong docked to the bottom, because the layout is not
symmetric: a side-docked panel floats free with a gap on both sides, a
bottom-docked one butts directly against the content above it (see
`layoutGap`). Adding a uniform gap left an 8px sliver of the list showing
through between the reader and the notes sheet in the narrow layout.

The variable now means **"where the main column ends"**, measured from the
edge the panel is docked to and inclusive of everything in between — the
panel's size, its `SLIDE_OFFSET` float, and the gap (if any) on the column's
side of it. Side publishes `panelWidth + SLIDE_OFFSET * 2`, bottom publishes
`panelHeight + SLIDE_OFFSET`. The reader reads it with the layout's own
padding as the fallback, so a closed panel needs no special case.

Checkable invariant: the reader's box and the list's box must be identical.
The list's right edge sits at `container padding (8) + spacer (panelWidth + 8)`
from the viewport edge; the reader's inset is `panelWidth + 16`. Same number.
If those ever drift, something is showing through.

`--notes-resize-ms` is the same publisher's way of killing the reader's easing
for the duration of a drag or a window resize, so the two sides of one
boundary do not ease independently. (During a *drag* the global
`body.panel-resizing *` rule already covers it; the variable is what handles
the window-resize re-clamp, which that rule does not.)

## Hosts differ in their padding

`ReadingPanel` takes an `inset` prop because the two hosts are padded
differently: the main window's layout is `p-2`, a detached item window
(`?window=1`) is edge-to-edge. Matching the host is what makes the reader land
in the same box as the content it replaces, so `ItemWindow` passes `0`. The
same reasoning applies to what it publishes: nothing floats in a detached
window, so its inset is the notes width with no gap folded in.

## Verifying this in the browser preview

The reader is Electron-only (`isElectron()` gates `?read=`), so exercising it
in the preview means stubbing `window.readingList = { platform: "electron" }`
and driving `history.pushState` + a synthetic `popstate` — a reload wipes the
stub, but popstate re-reads the URL without one.

**The trap:** a preview tab that is not painting has its CSS transitions
frozen at their start value, and `getComputedStyle` reports that frozen value.
A `bottom: var(--notes-inset-bottom, 8px)` that had genuinely resolved to
`528px` kept reading back as `8px`, and `getBoundingClientRect` returned
pre-transition geometry — which reads exactly like a broken layout. Take a
screenshot first (it forces a paint), *then* measure. Several apparent bugs in
this work were only that.

**Generalises to:** any measurement of a transitioned property in the preview.
If a number looks like the value from before the change you just made, you are
probably reading a frozen transition, not a bug.
