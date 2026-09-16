# Login spinner hangs forever in the packaged desktop app

_2026-09-16_

## Symptom

The installed `/Applications` Reading List app (Electron) infinite-loads on the
login screen: "Continue with Google" spins and never resolves. The web app and a
freshly built desktop app were both fine.

## Cause: native/web version skew

The packaged app loads the **deployed** web bundle
(`https://reading-list.khalidbelhadj.com`), but its own native half (main.js /
preload.js baked into `app.asar`) is frozen at whatever commit built the `.app`.
These two halves version-skew.

Commit `08e2e14` added a new preload bridge method, `getProtocol()`, and made the
web's `handleGoogleLogin` call it:

```js
callback.searchParams.set("scheme", await window.readingList.getProtocol());
```

An older installed binary still exposes `window.readingList` with
`platform: "electron"` (so `isElectron()` is true and the desktop branch runs)
but has **no** `getProtocol`. `await window.readingList.getProtocol()` throws
`TypeError: ... is not a function`. The handler had already done
`setIsLoading(true)` and had no `try/catch`, so the rejection was unhandled and
nothing reset the spinner → infinite loading.

Verified by extracting the installed `app.asar`
(`bun x @electron/asar extract`): its `dist-electron/preload.js` has no
`getProtocol` and `channels.js` has no `protocol` channel, while still
registering the `readinglist` protocol and `platform: "electron"`.

## Fix

`app/login/login-form.tsx` + `types/electron-bridge.d.ts`:

- Type `getProtocol` as optional and call it as `getProtocol?.()`. When absent,
  omit the `scheme` search param; `/auth/return-to-app` already defaults to
  `scheme ?? "readinglist"`, which is the scheme a packaged build registers, so
  the deep-link round trip still completes.
- Wrap `handleGoogleLogin` in `try/catch` that resets `isLoading` and surfaces
  the error, so no throw on this path can ever hang the button again.

The fix ships in the web bundle, so it reaches existing installs on the next
**deploy** — no reinstall needed.

## What generalises

Anything the web calls on `window.readingList` is a **cross-version contract**
with binaries already in the wild: the packaged app pulls the live web bundle,
so a new bridge method can be `undefined` on old installs. Treat every bridge
method as optional from the web side, and never leave an async auth handler
without a `try/catch` that clears its loading state — an unhandled rejection
there reads to the user as a permanent hang.
