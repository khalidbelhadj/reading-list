# Nav pill animation stutters on a route's first visit

## Symptom

Clicking a nav tab (Review, Settings, Reading list) made the pill animation
glitch — it would start, snap back, and replay. Only on the **first** visit to
that route; every later click looked correct.

## Cause 1: two navs animating the same transition

`PageNav` read `useLocation()`, which flips to the **pending** location the
moment a navigation starts — before the destination route's component chunk has
loaded (`defaultPreload: false`, so chunks are fetched on click).

Every page renders its own `PageNav` (the home toolbar has one, `SecondaryPage`
has one), so one click produced two of them animating the same transition:

1. The **outgoing** page's nav — still mounted — re-rendered with the new
   pathname and started animating its `NavLabel` widths.
2. ~50ms later the route resolved, that tree unmounted, and the destination
   page's nav mounted and replayed the animation from its `initial` state.

Measured in dev (render/mount timestamps, home → /settings):

| | outgoing nav flips | destination nav commits | gap |
|---|---|---|---|
| first visit (cold chunk) | 12ms | 65ms | **53ms** |
| later visits (warm chunk) | 3ms | 12ms | 9ms |

The tween is 150ms, so a 53ms interruption shows ~1/3 of it before the restart,
while a 9ms gap lands inside a single frame — which is why it only ever looked
broken the first time.

## Cause 2: the pill background could not transition

Reading the *resolved* location instead of the pending one fixed the restart but
left a briefer artifact, because it made the destination nav's mount state
depend on a race: whether `resolvedLocation` had updated by the time that nav
first rendered. Both orderings happened in practice.

When the nav mounted already in the final state, the pill **background** — a
`bg-muted` class toggled by `active` — snapped to the new tab in one frame while
the labels animated over 150ms, leaving the outgoing label sitting there as bare
text with no pill behind it. A CSS transition can't help: the route swap mounts
a brand-new element, and an element has no before-change style on its first
render, so `transition-colors` has nothing to transition from.

## Fix

Two changes, both in `components/items-list/`:

1. **The nav's active tab is a prop, not router state.** `PageNav` takes
   `current` (`"/" | "/review" | "/settings"`), passed by the page that renders
   it — `toolbar.tsx` for home, `secondary-page.tsx` for Review/Settings (each
   route file supplies its own). `PageNav` no longer subscribes to the router at
   all, so each nav's active tab is fixed for its whole life and the animation
   starts exactly once, on mount, in the nav that stays on screen.
2. **The pill background is a motion layer** (`NavPill` in
   `page-nav-shared.tsx`): an `absolute inset-0 rounded-full bg-muted` span
   whose opacity animates, with `initial` taken from `wasActive`. Motion renders
   `initial` and animates away from it, which survives the remount that defeats
   CSS transitions. Icon and label moved into a `relative` wrapper so they paint
   above it.

The `useNavFrom`/`wasActive` hand-off is unchanged — it now feeds both the label
widths and the pill opacity through one shared `NAV_TRANSITION`, so they move
together.

## Related

- Route chunks are still fetched on click (`defaultPreload: false` in
  `app/router.tsx`), so the first click on a tab has a short dead period before
  the page (and the pill) responds. `defaultPreload: "intent"` would warm the
  chunk on hover if that ever feels sluggish.
- The outgoing item's *text colour* still snaps rather than fading, for the same
  fresh-element reason. Far less visible than the background was; motion it the
  same way if it ever bothers anyone.

## Debugging technique

The Browser-pane preview throttles `requestAnimationFrame` to ~1fps (and clamps
`setTimeout` to ~1s once the tab has been hidden a while), and `motion` captures
the global `rAF` at module init — so motion animations freeze mid-flight there
and cannot be observed by screenshot or by polling.

What worked: a temporary dev-only head script (must run before any module
script) replacing `rAF` with a manually drained queue —

```js
var q = new Map(), id = 1;
window.requestAnimationFrame = function (cb) { var i = id++; q.set(i, cb); return i; };
window.__drain = function () { var cbs = [...q.values()]; q.clear(); cbs.forEach(cb => cb(performance.now())); };
```

— then stepping frames from the console and sampling `getBoundingClientRect()`
and computed opacity after each `__drain()`. That makes the animation
deterministic and immune to throttling, and it is what made both causes visible.
Yield with a `MessageChannel` round-trip between frames, not `setTimeout`.
