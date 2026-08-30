# The old frontend rip-out (2026-08-30)

The classic UI (PanelLayout at `/`, components/items-list, components/ui,
components/editor, components/viewer, components/review) was deleted wholesale
and the new shell (then `components/experimental`, now `components/shell`)
became the app at `/`. The backend was simplified to match: tags, the
extraction/embedding pipeline, and all review bookkeeping were removed.

## What was deliberately dropped (not lost by accident)

- **Reader/viewer** (webview/iframe/YouTube engines, the pdf.js stack,
  `?read=`, `/api/proxy-pdf`, `electron/viewer-preload.ts`, `webviewTag`).
  Items open in the system browser. If a reader returns, it is a rebuild, not
  a restore — the security surface (webview hardening) went with it.
- **Multi-window** (`?window=1` item windows, tear-off drag, reviews in a
  window, cross-window postMessage, the `focusWindow` IPC). The shell is a
  single window with an in-memory view stack.
- **Tags**, end to end: tables (`tags`, `items_tags`), actions, MCP tools and
  the `tagNames`/`tag` params, the Ask filter, the CSV column. ~51 items had
  tags when the tables were dropped.
- **Review bookkeeping**: `review_sessions`, `card_reviews`, `review_events`,
  the session lifecycle actions (start/get/rate-with-session/skip/end), event
  logging, and the summary screen. Review history data was deleted; SRS
  scheduling state survives on `flashcards` itself.
- **Embeddings/intelligence**: `item_content`, `item_chunks`, `lib/extract/`,
  the indexer loop (started from app/server.ts and request-guard), semantic
  search, `/debug/intelligence`, and the pgvector dependency. **Agentic
  search (Ask) never used embeddings** — it is regex/ILIKE over
  items/notes/flashcards via `lib/search.server.ts` — so it survived intact.
- Old-UI-only settings fields (`fullWidth`, `showSuggestions`, `tagsOpen`,
  `reviewsInNewWindow`, `openOnSingleClick`, `groupBy:"tag"`) — stored values
  degrade to defaults via the zod `.catch`es, no data migration needed.
- All `/debug/*` pages and legacy scripts.

## What was ported, and where it went

- **The `?item=<id>` contract.** The shipped browser extension (and old deep
  links) open `/?item=<id>`. The new `/` route validates the param and the
  shell takes it as `initialItemId` (stack `[review, item]` so back works).
  `readinglist://item/<id>` is handled by `useDeepLinkedItem` inside
  `components/shell/shell.tsx`; the old DeepLinkItemWatcher/
  WindowMessageWatcher in `__root` are gone.
- **Review became sessionless.** `rateCard({flashcardId, rating,
  affectsSchedule})` in `app/actions/review.ts` updates the card row using
  `lib/srs.ts` directly; the pane mirrors the same scheduler into the
  `["all-flashcards"]` cache optimistically, and the sidebar's due count is
  derived client-side (`components/shell/review-queues.ts`) — the
  `getReviewStatus` action is gone. `getAllFlashcards` now returns the SRS
  fields so the client scheduler has inputs.
- **Image uploads** were wired into the kit editor (`onUploadImage` →
  `lib/image-upload.ts` → `/api/storage`); the storage route stays because
  existing notes embed `/api/storage/...` URLs.
- Survivor helpers were extracted before deleting `lib/extract/`:
  `getPdfUrl`/`getArxivId` → `lib/pdf-url.ts` (page titles + PDF thumbnails
  both need them); the HTML-entity helpers were inlined into
  `lib/page-title.server.ts`.
- `NonIdealState` and a `TooltipProvider` were ported into
  `components/system` so login/oauth/error/404 pages could leave
  `components/ui` before it was deleted.

## Database migration

Fresh environments: `db:push` + `db:setup` as always. Existing databases run
`db/drop-legacy.sql` once, FIRST — `drizzle-kit push` cannot drop the legacy
tables itself (it trips over their RLS policies), and the drop script also
removes their sync triggers. Then push, then `db:setup` (whose trigger
function no longer has the items_tags branch).

## Gotchas discovered on the way

- `bun run cdp` flags go AFTER the command (`cdp eval "…" --port=9227`), or
  use `ELECTRON_CDP_PORT`. With two dev instances up, an explicit port is
  required.
- The realtime sync path can be tested single-machine by overwriting the
  `sync-origin` cookie before a write: the broadcast comes back with a
  foreign origin and the watcher treats it as another device's write.
- knip's `components/ui/**` ignore had been hiding dead code for months
  (`youtubei.js`, unused lib hooks). It's removed — don't re-add blanket
  ignores.
