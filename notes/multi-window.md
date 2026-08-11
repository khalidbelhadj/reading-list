# Multi-window architecture (items + reviews)

The app supports secondary windows on both platforms with one code path:
`window.open` on app-origin URLs. On the web that yields a tab; in Electron
the main process intercepts it (`setWindowOpenHandler` in `electron/web-contents.ts`)
and creates a real child `BrowserWindow` with the same preload, navigation
guards, zoom, and theme handling as the main window (all wired globally via
`app.on("web-contents-created")`, so nothing is main-window-specific anymore).

All client helpers live in `lib/app-windows.ts`:

- **Item windows** — `openItemInNewWindow(id)` opens `/?item=<id>&expanded=1`
  named `item-<id>` (re-opening the same item reuses its window). The window
  is just another app instance deep-linked into the expanded panel — zero
  bespoke UI.
- **Review windows** — `useStartReview` opens a **blank placeholder window
  synchronously in the confirm click** (popup blockers kill `window.open`
  after an `await`), then points it at `/review/<sessionId>` once the server
  creates the session; closes it when there are 0 cards / on error; falls
  back to in-window navigation when the popup was blocked (`window.open`
  returned null). Gated by the `reviewsInNewWindow` setting (switch in the
  quick-settings dropdown, default on) — off means the old in-window
  navigation.
- **Hand-back** — a secondary window shows an item in the original window via
  `openItemInOriginWindow(id)`: `window.opener.postMessage` (same-origin —
  works identically in Electron child windows, which keep their opener).
  `WindowMessageWatcher` (mounted in `__root.tsx`) receives it, opens the item
  via `openItemInPanel`, and raises the window through the `focus-window` IPC
  (renderers can't focus their own BrowserWindow; on the web raising another
  tab isn't possible and the message alone has to do).
- `openItemInPanel(id)` is the single implementation of "open item in this
  window's panel" (sets `?item=` + fires popstate for PanelLayout; full
  navigation off the home route) — also used by the tiptap item-link node and
  the Electron deep-link watcher.

Review-session UI adapts via `useIsSecondaryWindow()` (opener alive?): the
card's item meta is "Show in list" (copy-ID moved to a hover icon next to
it), and "Back to list" becomes "Close window" when the review runs in a
popup, since the list window is still behind it.

## Data sync between windows

Sibling windows do NOT sync through the Supabase Realtime path: all windows
of one browser share the localStorage `sync-origin-id` (and its cookie), so
each window suppresses the others' write broadcasts as its own echo (see
`lib/items-sync.ts`). Making the origin per-window doesn't work because the
origin travels as a cookie, which the windows also share.

Instead, `components/local-sync-watcher.tsx` (mounted in `__root.tsx`)
mirrors React Query **invalidation events** over a BroadcastChannel
(`lib/local-sync.ts`): every mutation already encodes which caches it
affects via its `invalidateQueries` calls, so re-broadcasting those events —
filtered to the shared top-level keys, coalesced 100ms — covers all current
and future mutations with zero per-mutation wiring. Receivers run the same
`invalidateQueries`; a synchronous re-entrancy flag stops remote-applied
invalidations from re-broadcasting (no ping-pong). Realtime keeps handling
cross-device.

Settings sync separately: they never invalidate (`setQueryData` +
`staleTime: Infinity`), but `use-settings` writes every change to
localStorage, and the browser fires `storage` in every other same-origin
window automatically — the watcher adopts the parsed value via
`setQueryData`, so toggles (theme, density…) apply live without a refetch
and without write-back loops (only `setSetting` ever persists).

Gotchas learned while building:

- Placeholder navigation must use **absolute URLs** — relative paths don't
  resolve against `about:blank`.
- The review placeholder gets the current theme's background color painted
  onto its blank document so dark mode doesn't flash white.
- Electron zoom is one app-wide factor; `setZoom` now applies it to every
  window (traffic-light repositioning included), and each window re-asserts
  it on `did-finish-load`.
