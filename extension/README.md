# Reading List — Chrome extension

Save the current page in one click — and when a page is already saved, the same
click takes you straight to its notes. A right-click menu covers links and pages
outside the popup.

## How it works

- The extension POSTs to `/api/extension/items` on your reading-list app.
- Auth rides your **existing Supabase cookie session** — there's no separate
  login. Just be signed in to the app in the same browser. (Requests use
  `credentials: include`; the app's middleware allows the `chrome-extension://`
  origin with credentials.)
- New items can be opened at `/?item=<id>`, which lands on the detail/notes view.

## Build a distributable zip

```
extension/build.sh
```

Produces `reading-list-extension.zip` in the repo root (manifest at the archive
root), ready to drag into `chrome://extensions` or upload to the Chrome Web
Store. The zip is gitignored — rebuild it from source any time.

## Install (unpacked, for development)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this `extension/` folder (or drag in the zip).
3. Sign in to the app in the same browser.

By default the extension talks to **production**
(`https://reading-list.khalidbelhadj.com`). To point it at a local server,
open the extension's **Settings** (popup → gear → Settings), turn on
**Developer mode**, and enter the **App URL** (e.g. `http://localhost:3000`).

## Using it

- **Popup** (toolbar icon): one contextual button.
  - Page not saved yet → **Save to reading list** (or just press ⏎).
  - Page already saved → **Open in reading list →**, which jumps to the item.
  The popup checks on open whether the current page is already in your list.
- **Right-click** a link or page → "Save … to reading list". A notification
  confirms the save and offers an **Open in reading list** button.

## Notes

- Right-clicked links are saved with just their URL; the server fetches the page
  title automatically.
- Duplicate URLs aren't saved twice — the popup shows the page as already saved
  and lets you open the existing item.

## Production vs. dev

The production URL (`https://reading-list.khalidbelhadj.com`) is the built-in
default — the extension is a static bundle and can't read server env vars, so
it's hardcoded in `api.js` (`PRODUCTION_URL`). Developer mode (in Settings)
overrides it with whatever **App URL** you enter.

The middleware already allows any `chrome-extension://` origin with credentials,
so no server env change is needed. To lock it down to a single extension id
instead, pin the extension id (manifest `key`) and gate on it server-side.
