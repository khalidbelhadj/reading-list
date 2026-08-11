# The main process, module by module

`electron/main.ts` used to be one 466-line file. It's now a boot sequence plus
ten single-purpose modules. This note is the map, and — more usefully — the list
of things that break silently if you move them.

## Map

| File | Owns |
| --- | --- |
| `main.ts` | The boot sequence, and nothing else |
| `env.ts` | URLs, `PROTOCOL`, `devPort`, `isDev`, icon + preload paths |
| `cdp.ts` | The dev DevTools-Protocol listener |
| `app-identity.ts` | `setName` / userData dir, protocol client registration |
| `zoom.ts` | **`zoomFactor`**, traffic-light geometry |
| `theme.ts` | `themeBg()`, the `nativeTheme` → renderer broadcast |
| `windows.ts` | **`mainWindow`**, window options, `createMainWindow()` |
| `web-contents.ts` | Navigation guards, webview hardening, zoom re-assert, dev title |
| `deep-links.ts` | **`pendingDeepLink`**, deliver + flush |
| `ipc.ts` | The `ipcMain.handle` handlers |
| `menu.ts` | The application menu |
| `browser-tabs.ts` | Open-browser-tab polling (see below) |

Three pieces of mutable state, three owners. Read them through
`getZoomFactor()` / `getMainWindow()`; never import the binding. `deep-links.ts`
takes the window as a *parameter* rather than importing `windows.ts` — that's
what keeps the graph a DAG instead of a cycle (which, under CommonJS, shows up
as `undefined` at call time rather than a compile error).

## Rules that aren't obvious from the code

**Keep `electron/` flat.** `sharedWebPreferences` and the webview hardening
resolve preloads with `path.join(__dirname, "preload.js")`, and the build
mirrors the source tree. Move a module into a subdirectory and its `__dirname`
gains a segment, the preload fails to load, `window.readingList` is `undefined`,
and the app silently degrades to the web shell — no error anywhere.

**No module does anything on import except define values.** Import order is
whatever `simple-import-sort` decides, so anything order-dependent must be an
explicit call from `main.ts`. This is why `enableCdpListener()` and
`configureAppIdentity()` are functions rather than top-level side effects.

**The four ordering constraints**, each with a distant symptom:

1. `enableCdpListener()` before Chromium starts — `appendSwitch` is a silent
   no-op afterwards.
2. `configureAppIdentity()` before `requestSingleInstanceLock()` — the lock file
   lives *inside* userData, so the wrong order takes the packaged app's lock and
   the dev instance quits silently on launch.
3. `registerWebContentsCreated()` before any window exists — it's the only thing
   that wires the main window (`attachWindowBehavior` is never called on it
   directly). Register it late and the main window loses navigation guards, zoom
   re-assert and the dev title while *child windows keep working*, which reads
   like a main-window-only bug.
4. `watchNativeTheme()` before ready, so an appearance flip during startup isn't
   missed.

**Two different `did-finish-load` handlers.** `windows.ts` has one on the main
window (deep-link flush); `web-contents.ts` has one on every window (zoom
re-assert, because `setZoomFactor` resets to 1 on navigation). They are not
duplicates — don't merge them.

**`window-all-closed` is registered outside the single-instance-lock branch.**
An instance that lost the lock still needs the non-macOS quit behavior.
