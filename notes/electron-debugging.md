# Debugging the Electron app (including from Claude Code)

The browser preview can only ever show the *web* build in a tab. Everything
that makes the desktop app different lives outside that: secondary item and
review windows (`window.open` → real `BrowserWindow`s, see
[multi-window.md](multi-window.md)), the viewer `<webview>` guests,
traffic-light clearance, app-wide zoom, `nativeTheme`, `readinglist://` deep
links. Those only reproduce in the real app.

The bridge is Chromium's DevTools Protocol. Every webContents Electron creates
— main window, each child window, each webview guest — is its own CDP target,
so one listener exposes the whole window tree.

## Turning it on

Nothing to turn on: `electron/main.ts` opens the listener automatically in dev
(never when packaged) and prints the port:

```
[electron] CDP listening on http://127.0.0.1:9222
```

The port is derived from the dev port exactly like `userData` and the
single-instance lock are — `9222 + (devPort - 3000)` — so parallel instances
never collide (`:3007` → `9229`). `ELECTRON_CDP_PORT=<n>` pins one,
`ELECTRON_CDP_PORT=off` disables the listener.

Enabling it also sets `--disable-renderer-backgrounding` and
`--disable-backgrounding-occluded-windows`: anything driving the app over CDP
never focuses the window, and a backgrounded renderer throttles (then freezes)
rAF and timers, which reads as a hang. The trade-off is that background
throttling bugs won't reproduce while the listener is on.

## Driving it

`scripts/electron-cdp.ts` (`bun run cdp <command>`) is the client. It finds the
listener by scanning 9222-9231, so no port bookkeeping in the common case.

```bash
bun run cdp list                       # every window + webview, with an index
bun run cdp screenshot --all --out /tmp/shots
bun run cdp eval 'document.title'
bun run cdp eval --target review 'location.href'
bun run cdp console --ms 15000         # console + errors + Log entries
bun run cdp click '[data-slot="input"]'
bun run cdp text main
```

`list` labels targets by what the URL says they are (list window / item window
/ review window / viewer webview), and any of `--target=<substring>`,
`--index=<n>`, `--id=<targetId>` selects one. `click`/`type`/`key` dispatch
real trusted input via `Input.*` rather than `el.click()`, so focus, hover and
the app's own handlers behave as they do for a person at the keyboard.

Screenshots are the fastest way to answer "does this actually look right in the
window?" — `--all` captures every open window in one go, which is the point
when a change affects the item or review window rather than the list.

## Humans

The View menu has Toggle DevTools (⌥⌘I) per window, which is still the better
tool for interactive poking. `chrome://inspect` also works — the listener
allowlists the `devtools://devtools` origin so the frontend can attach.

## Main process

The listener covers renderers only. Window creation, `setWindowOpenHandler`,
IPC and zoom logic live in the main process; its `console.log` goes to the
terminal running the dev command. For a debugger there, launch Electron with
`--inspect=9230` directly rather than through `electron:dev`.

## Gotchas

- A `location.href` navigation (or a reload) wipes anything injected via
  `Runtime.evaluate` — re-install instrumentation after every navigation.
- Each dev instance has its own `userData`, so a freshly launched instance is
  signed out even when another one is signed in.
- The dev app is pointed at the **real** Supabase project unless launched with
  `electron:local`. Treat CDP evaluation as read-only there.
