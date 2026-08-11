# Seeing which reading-list items are open in a browser tab

The desktop app surfaces items you already have open in a browser tab in an
"Open in browser" section at the top of the list, so you can click straight
into notes for what you're reading. Supported: Chrome, Brave, Edge, Chromium
(one shared Chromium script pair) and Safari (its own pair).

## Shape

`electron/browser-tabs.ts` (main) → IPC → `lib/open-tabs.ts` (renderer store) →
`components/items-list/use-filters.ts` partitions the list →
`components/items-list/open-tabs-section.tsx` renders it.

Matching is `urlMatchKey` in `lib/url.ts` — deliberately more aggressive than
the neighbouring `normalizeUrl`, which stays conservative because it feeds
duplicate detection on save. Tests in `lib/url.test.ts` pin both directions:
what must collapse (tracking params, `www.`, trailing slash, YouTube's five URL
shapes) and what must not (`?v=`, distinct paths).

Right-clicking an item that's open in a tab offers "Go to <browser> tab", which
raises that exact tab. It addresses the tab by an opaque per-browser handle,
never by window/tab position — positions shift the moment you open, close or
drag a tab, and a positional ref raises the wrong page. Chromium browsers have
a stable tab `id`; Safari has none (only a read-only `index`), so Safari uses
the URL, which for this feature is the identity anyway. Either way the focus
script walks every tab to find its target.

Safari also has no private-browsing flag, so unlike Chrome's `mode of w` there
is nothing to filter its private windows on.

## The three things that bite

**`tell application "Google Chrome"` LAUNCHES Chrome.** An unguarded poll would
boot every browser in the table on app startup, forever. We `pgrep -x` for the
exact process name first. Using `pgrep` rather than System Events' `exists
process` also avoids a *second* automation permission prompt.

**Automation denial is permanent-ish.** A declined TCC prompt makes `osascript`
fail with `-1743` on every call, and each retry re-prompts. Denied apps go into
a set and are dropped for the life of the process.

**Polling is gated on window focus, not just on subscribers.** The list is only
on screen when the app is in front, so `browser-window-focus` / `blur` start and
stop the 2s timer. Consequence for debugging: driving the app over CDP while it
is *not* frontmost produces no tab pushes at all, and it looks broken. Call
`window.readingList.focusWindow()` first.

**AppleScript can "succeed" while doing nothing.** Matching a Chrome tab by id
cost an hour because the script exited 0 every time. Two separate traps, either
of which silently makes the comparison always-false:

```applescript
if (id of t) is 40334440 then        -- WRONG: builds a bulk reference
set tid to id of t
if tid is 40334440 then              -- WRONG: a tab id is not a plain integer
set tid to (id of t) as text
if tid is "40334440" then            -- correct
```

The first evaluates `id of t` against the whole collection (the error text, if
you force one, reads `id of item 1 of every «class CrTb» of ...`). The second
looks right and passes an `as integer` comparison, but fails the bare one.
Generalises: when an osascript exits 0 and nothing happened, suspect the
comparison, not the action — and bind + coerce every property you compare.

Related: because non-permission errors used to be swallowed here, the failure
produced no output at all. The catch now logs anything that isn't a TCC denial.

Subscription is what turns the whole feature on: the renderer store subscribes
lazily, the preload's subscribe/unsubscribe invokes drive the main-process
subscriber set, and the `showOpenTabs` setting simply doesn't subscribe. Off
means no listener, no IPC, no `osascript` — not a hidden UI.

## Deliberate non-goals

Tab data never leaves the machine: it goes main → renderer and is matched
against the React Query cache in the client. Nothing is sent to the server,
persisted, or logged. Incognito windows are filtered out in the AppleScript
(`mode of w`).

Firefox and its forks (Zen) can never work this way: `sdef /Applications/
Firefox.app` returns only the stock Cocoa suites — no `tab` class, no `URL`
property anywhere — so the query fails to *compile* (`-2740`), long before any
permission is consulted. `count of windows` succeeds, which is how you can tell
this apart from a TCC denial. Arc is scriptable (`tab` with `URL`/`id`, plus
`active tab` and a `select` command) and could be added as a third script pair.

Windows/Linux get nothing — there is no equivalent to AppleScript there. The
cross-platform version of this would be a push from the existing Chrome
extension (which already holds the `tabs` permission) to a localhost server in
the main process; that was considered and rejected as too much machinery for a
feature that only matters while the app is focused on the same Mac.
