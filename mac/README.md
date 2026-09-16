# Reading List for macOS

The native SwiftUI port of the desktop app. The Electron shell in
`electron/` and the web kit in `components/` are the reference; this app is
meant to look the same, built from Liquid Glass (macOS 26 and later).

## Design kit and board

`Sources/ReadingList/DesignKit/` is the port of `components/system` (Base)
and `components/app` (App), one file per component with its demo at the
bottom (`extension Demo { static let button = Demo(...) }`), registered in
`DesignKit/DemoRegistry.swift`. The board window (View > Design board, ⇧⌘D,
or `bun run mac board <name>`) is the counterpart of `/design/components`:
one demo at a time, or everything.

- **Tokens** are `Theme` (`DesignKit/Theme.swift`): every colour from
  `app/globals.css` as OKLCH, converted at runtime and resolved per
  appearance, plus the radii, row heights and motion. `Theme.fg(0.05)` is the
  web's `foreground/[0.05]`.
- **Type** is DM Sans and DM Mono (`DesignKit/Typography.swift`), the
  variable TTFs in `Resources/Fonts` registered at launch; `.textStyle(.body,
  .medium)` is the six-step scale with its line heights.
- **Icons** are Tabler, the web app's set: `bun run mac:icons` regenerates
  `Resources/Icons/*.svg` and `TablerIcon.generated.swift` from every
  `IconX` the web imports. `Icon(.list)` draws one as a template image.
- **Glass, used sparingly**: Liquid Glass is the layer that floats over
  content, never the content itself. Frost surfaces (`.frost()`), the
  sidebar, hover card, notification and palette are glass; buttons have
  `.glass` / `.glassProminent`, and `Input`, `NumberInput`,
  `SegmentedControl`, `ButtonGroup` and `EditorToolbar` take `glass: true`
  for toolbars and floating bars. `FormatBubble` and `RatingBar` are always
  glass. Rows, cards, forms and reading surfaces stay flat. Menus, popovers,
  selects and dialogs (system alerts, with a text field inside when a form
  needs one) are the system's own. The switch, checkbox and slider are the
  native controls with only their tint changed.

## Data

The app is local-first over Supabase (`Sources/ReadingList/Data`):

- **`ItemStore`** (`@Observable`) holds the items in memory and is what views
  read; a JSON snapshot in Application Support is written after every change
  and loaded at launch, so the window opens on the last known state with no
  spinner, then refreshes in the background. Writes are optimistic: the
  change lands in the store first, the request follows, and a failure
  refetches the truth and posts a notification. Text edits coalesce for
  600ms before they are sent; flags go at once.
- **Reads and writes** go through the web app's HTTP API with the Supabase
  access token as a bearer (`ItemsAPI`, over the client in
  `Sources/ReadingListAPI` that swift-openapi-generator builds from
  `openapi.json` on every build; `bun run gen:openapi` regenerates that
  document from `lib/api/contract.ts`). One code path for every client: url
  normalisation, the duplicate check, title fetching and the notes-to-cards
  sync live on the server. Supabase itself is only used for Auth and
  Realtime.
- **The deck** (`FlashcardStore`): every card with its scheduling state,
  snapshot on disk like the items. Review is local-first and sessionless,
  as on the web: the pane freezes its queue from these cards on entry
  (`ReviewQueues`: due or new, hidden items excluded, dealt round-robin
  across items), rating a card moves its schedule here at once with the
  same scheduler the server runs (`SRS`, a port of lib/srs.ts that
  `swift test` checks against the TypeScript one's answers), and the
  write follows. Editing a card rewrites its `<card>` block in the item's
  notes (`CardNotes`), the source of truth; orphan cards update their row.
- **Previews** (`ItemPreviews`): the stored first-page renders by item id,
  fetched the first time a sidebar row is hovered and generated lazily for
  an item that has never been checked, exactly as the web's hover card does.
  The card itself is `HoverPreviewCard` in the shell: one glass card over
  both columns that glides between rows.
- **Sync in** (`SyncWatcher`): the `items_sync_notify` trigger's broadcast
  on `items-sync:<userId>`; pings from other clients refetch (own writes
  carry the client's sync origin and are ignored), plus a refetch on app
  activation and every five minutes.
- **Session** (`SessionController`): Google through the system web session
  (`readinglist://auth/callback` must be in the project's redirect list),
  or email and password against the local stack. Dev builds keep the session
  in a file under Application Support rather than the Keychain, because
  every ad-hoc re-signed build would otherwise prompt for it.

`bun run mac run --env=local` (default) points at the local stack and the
web dev server on :3000; `--env=prod` at the hosted project and the deployed
web app, where writes hit real data. `bun run mac signin` signs in as the
local dev user. The store is scriptable: `items`, `item <id>`, `refresh`,
`create [url]`, `patch <id> --title=… --notes=…`, `delete <id>`, `open [id]`,
`review [itemId]`, `cards`, `settings [--density=… --showRead=…]`, `dev <state>`
(the dev bar's previews), `close` (a window) and `blur` (give up the first
responder, which ends an in-place edit). `find` echoes its own command line first: filter
that out before counting matches.

## Conventions that keep it in step with the web

- Colours, radii and row heights are generated from `app/globals.css`
  (`bun run mac:tokens` → `DesignKit/Theme.generated.swift`); Theme.swift
  keeps only what has no CSS token.
- Small logic ported from TypeScript (the scheduler, review order, the
  notes rewrite, date groups, relative time, YouTube ids, item order) is
  pinned by fixtures: `bun run gen:fixtures` runs the originals,
  `swift test` replays them through the ports.
- The source is formatted and linted by swift-format (`.swift-format` in
  this directory; `bun run mac:check` runs the lint).
- Dev builds register `readinglist-mac-dev://` and keep the session in a
  file; a release build (`sh scripts/bundle.sh release`) registers
  `readinglist-mac://` and uses the Keychain. Google sign-in opens the
  system browser and Supabase returns straight to
  `<scheme>://auth/callback?code=…`, so both `readinglist-mac://auth/callback`
  and `readinglist-mac-dev://auth/callback` must be in the project's
  redirect allowlist; `bundle.sh` registers the bundle with LaunchServices
  so the link reaches this build.

## The markdown editor

The notes editor is not a native text view: it is the web app's tiptap
editor (`components/system/markdown-editor.tsx`, with the flashcard node),
built as a standalone page from `editor-host/` by `bun run build:editor`
into `Sources/ReadingList/Resources/Editor/` (git-ignored; `bundle.sh`
runs the build first) and hosted in a `WKWebView` by
`DesignKit/Base/MarkdownEditor.swift`. That gives the Mac exactly the
web's editing: headings, lists and checklists, code blocks with
highlighting, inline and block math through KaTeX, links, cards, images.

- The page is served over the app's own `editor://` scheme from the
  bundle (module scripts never load from a `file://` url), styled by the
  same `globals.css`, so colours and fonts are the web's. The page is
  transparent; the app paints the background.
- The bridge: the app calls `window.editorHost` (value, placeholder,
  editable, toolbar, theme, focus, `run(action)`), the page posts back on
  the `editor` message handler (`ready`, `change`, `height`, `selection`,
  `upload`, `error`). The view sizes itself to the page's height.
- The formatting bubble over a selection is the kit's glass `FormatBubble`,
  floated natively over the web view where the page reports the selection;
  its actions run back inside the page. The page's own bubble is off.
- Images cross the bridge as base64 and upload through the API
  (`ItemsAPI.uploadImage`), the way the web's do.

## The dev bar

Debug builds show a bar along the bottom of the window, the web's dev
banner: the backend (blue for the local stack, amber for production), the
API host, where the shell is, and a "Go to" menu that previews UI states in
place of the real one (sign in, loading, error page, no backend
configured). `bun run mac dev <state>` does the same from the harness.

## Layout

- `Package.swift` — SwiftPM, one executable target. There is no Xcode
  project; `xed mac` opens the package in Xcode when you want previews.
- `Sources/ReadingList/` — the app. `Shell/` is the app shell (sidebar,
  reading list, item view), `Data/` the store, session and sync,
  `DesignKit/` the kit and its demos, `Board/` the design board window,
  `Debug/` the dev-only control socket described below (compiled out of
  release builds).
- `Info.plist` and `scripts/bundle.sh` — how the `.app` in `mac/build/` is
  assembled (`swift build`, copy the binary and resource bundles, ad-hoc
  sign). `mac/build/` and `mac/.build/` are ignored by git.

## Build and run

```bash
bun run mac run     # swift build, bundle, relaunch, wait until the socket answers
bun run mac build   # build only
bun run mac stop    # quit the running app
bun run mac log     # the app's stdout/stderr (mac/build/app.log)
```

`run` replaces any running instance and brings the app to the front.

## Driving it

Debug builds listen on `127.0.0.1:9400` (`RL_DEBUG_PORT` to change it).
`scripts/mac.ts` (`bun run mac …`) is the client, the counterpart of
`bun run cdp` for the Electron app. This is how an agent sees and works the
app: screenshots, the accessibility tree, and synthetic input.

```bash
bun run mac list                     # windows with their ids
bun run mac screenshot               # 1x PNG (pixels are window points)
bun run mac screenshot --retina      # 2x, for judging rendering detail
bun run mac screenshot --screen      # the composited screen region under the window
bun run mac tree                     # accessibility tree with frames
bun run mac find Review              # nodes whose label / value / id contains it
bun run mac text                     # every visible label and value
bun run mac click "Reading list"     # click a node by label or identifier
bun run mac click 120 64             # or a point
bun run mac click Review --right     # context menu; --double, --cmd, --shift, --alt, --ctrl
bun run mac hover "The Bitter Lesson"
bun run mac scroll 100 300 200       # scroll the scroll view under (100,300) by 200 points
bun run mac type hello world         # into whatever has focus
bun run mac key cmd+k                # return | escape | tab | up | down | cmd+shift+[ …
bun run mac appearance dark          # light | dark | system
bun run mac board button             # open the design board on one demo (or everything)
bun run mac screenshot --window design
bun run mac resize 900 700
bun run mac move 40 60               # top-left corner, screen points
bun run mac activate
```

The loop that works: `screenshot`, read the PNG, `tree` or `find` for the
coordinates and names, act, `screenshot` again. Coordinates everywhere are
window points with the origin at the window's top-left corner, which is
exactly the pixel grid of a 1x screenshot.

Things worth knowing:

- **Menus and popovers are their own windows**, so `screenshot --screen`
  (the composited region under the window) is the way to capture them open;
  `-l` window capture leaves them out.
- **Identifiers are the stable handles.** Give anything an agent may need to
  reach an `.accessibilityIdentifier("pane.search")`; it shows up as
  `#pane.search` in `tree` and `find` matches on it. Labels work too but
  change with copy. Never put an identifier on a container: SwiftUI hands it
  to every element inside, overriding their own.
- **Input needs the app in front.** AppKit drops the first click on an
  inactive window and sends keys to the key window only, so `click`, `type`,
  `key`, `hover` and `scroll` activate the app first (through LaunchServices;
  `NSApp.activate()` is refused for a process nobody clicked on). That steals
  focus from whatever the person is doing, and macOS may refuse it while they
  are busy in another app; the client says so when that happens.
  `--no-activate` skips it.
- **Screenshots come from `screencapture -l`**, which captures the window as
  the window server composites it, glass and vibrancy included. The
  terminal or app running the command needs Screen Recording permission
  (the app itself needs none). An inactive window captures with its
  inactive look; `activate` first when that matters.
- **A synthetic click selects but does not focus a list.** Clicking a
  sidebar row changes the selection, yet keyboard focus stays where it was
  (a real click would hand it to the list). `key tab` moves focus into the
  list; arrow keys work from there. Text fields do take focus on click.
- **`hover` moves the real cursor.** Hover states follow the window server's
  cursor, not synthetic events, so the command warps the mouse there.
- **`--json` on `tree`** prints the raw dump when the rendered tree hides
  something (unnamed groups are collapsed, invisible nodes dropped; `--all`
  keeps them).

### Protocol

Newline-delimited JSON, one request per connection is fine:

```
{"id": 1, "cmd": "click", "args": {"window": 16033, "x": 120, "y": 64}}
{"id": 1, "ok": true, "result": {"x": 120, "y": 64}}
```

Commands: `ping`, `windows`, `tree`, `click`, `hover`, `scroll`, `type`,
`key`, `activate`, `resize`, `move`, `appearance`, `quit`. See
`Sources/ReadingList/Debug/DebugCommands.swift`.
