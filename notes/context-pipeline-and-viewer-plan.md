# Plan: Context/Intelligence Extraction Pipeline + In-App Viewer

Status: **implemented** (2026-07-13). Deviations from the plan below:

- **PDF engine** uses the browser's native PDF renderer in an iframe fed by a
  same-origin, ownership-checked proxy (`/api/proxy-pdf?item=…`) instead of a
  pdfjs canvas viewer — far less code, built-in zoom/search; the trade-off is
  the iframe is opaque (no page/selection observability in PdfSession).
- **Embeddings are dual-provider** (`lib/extract/embed.server.ts`):
  `EMBEDDING_PROVIDER=gemini` (default, gemini-embedding-001 @1536 dims via
  `GOOGLE_GENERATIVE_AI_API_KEY`) or `ollama` (local, default
  `nomic-embed-text`, zero-padded to 1536 — padding preserves cosine). The
  free-tier Gemini quota is easy to exhaust on a backfill; local dev uses
  ollama. Model id is stored per row; the worker re-embeds on model change.
- **YouTube transcripts** currently fail upstream: youtubei.js's
  get_transcript 400s and the timedtext fallback returns empty without a
  po_token. Both paths are wired and best-effort; videos index via
  title+description. Live capture / a po_token minter are future fixes.
- **No `/api/index` cron route** — the queue drains via fire-and-forget after
  createItem, a throttled opportunistic drain on fetchItems, the debug page's
  buttons, and `scripts/backfill-content.ts`.
- Key files: `lib/extract/*` (classify, readability, extractors, chunk, embed,
  worker), `app/actions/intelligence.ts` (+ RPC wrappers in index.ts),
  `components/viewer/*`, `lib/viewer/session.ts` (ViewerSession + registry),
  `electron/viewer-preload.ts` + main.ts webview hardening,
  `/debug/intelligence` dev page, `scripts/apply-intelligence-schema.ts`
  (db:push is broken — additive DDL applied manually; setup.sql carries
  RLS/grants/HNSW/trigger for the new tables).

Two workstreams that share one foundation:
the `item_content` artifact. No agent interaction ships in this plan, but the
viewer exposes a `ViewerSession` API designed so agent tools later become thin
wrappers over it.

Prior discussion decided:

- Extraction must preserve **structure** (markdown with images/headings/code),
  not plain text — the same artifact feeds the reader view and the embedding
  layer.
- The viewer is a per-content-type engine, not a general iframe: YouTube embed,
  pdf.js, Electron `<webview>` for arbitrary web pages, reader-view fallback on
  the web app (arbitrary sites cannot be iframed — `frame-ancestors` blocks it).
- Live capture from the Electron webview is a first-class content *producer*:
  it beats server-side fetch on paywalled/JS-heavy pages because it reads the
  DOM the user's session actually rendered.
- Highlights/captures are "capture, not decoration" — out of scope here, but
  the ViewerSession API (selection, node screenshot, state) is their substrate.

---

## Part 1 — Extraction pipeline

### 1.1 Schema (`db/schema.ts` + `db/setup.sql`)

One row per item in `item_content` (the row doubles as the job — no separate
queue table):

```
item_content
  id               text pk
  user_id          uuid not null
  item_id          text not null, unique, FK items(id) on delete cascade
  status           text: "pending" | "ok" | "failed" | "unsupported"
  source           text: "server" | "live" | "extension"   -- producer of current content
  extractor        text: "web" | "pdf" | "arxiv" | "youtube" | "wikipedia"
  extractor_version integer                                 -- bump to trigger re-extraction
  content_hash     text                                     -- sha256 of markdown
  title            text                                     -- extracted title (may differ from item title)
  markdown         text                                     -- structured content, absolute image/link URLs
  word_count       integer
  lang             text
  error            text                                     -- last failure message
  attempts         integer default 0
  next_retry_at    timestamptz                              -- backoff scheduling
  fetched_at       timestamptz                              -- when content was produced
  created_at / updated_at
```

`setup.sql` additions: RLS policies matching the existing per-user pattern,
index on `(status, next_retry_at)` for the worker claim query, and an entry in
the Realtime sync trigger so an open reader refreshes when live capture or a
re-extract lands (same `items-sync:<userId>` topic pattern).

**Source precedence** (enforced in the write path, not the DB):
`live > extension > server`. A server re-extract never overwrites live-captured
content; a live capture always may overwrite. Same-source overwrites allowed
when `content_hash` differs or `extractor_version` is newer.

### 1.2 Extractor ladder (`lib/extract/*.server.ts`)

Port of `analysis/fetch_content.py`'s strategy ladder. Entry point
`extractForUrl(url)` classifies then dispatches:

| Classifier | Strategy | Notes |
|---|---|---|
| YouTube (`lib/url.ts` already parses) | oEmbed for title/channel (reliable); transcript via `youtubei.js` | Transcript is **best-effort** — flaky upstream; `status: ok` with metadata-only markdown is acceptable |
| arXiv (`lib/pdf-preview.ts` already rewrites abs→pdf) | arXiv API abstract + metadata; then full PDF text via the PDF path | Abstract alone is a valid fallback tier |
| PDF (magic-number probe exists in `pdf-preview.ts`) | fetch bytes → `pdfjs-dist` `getTextContent()` per page → markdown with page markers | `pdfjs-dist` is already a dependency |
| Wikipedia | REST API (`/api/rest_v1/page/…`) | Mirrors the Python pipeline |
| Everything else | fetch → `linkedom` + `@mozilla/readability` → `turndown` → markdown | Keep absolute image URLs and links; strip scripts/tracking params |

Cross-cutting rules:

- **Every fetch goes through the SSRF guard in `lib/url.server.ts`** — resolve
  and validate the IP, and re-validate on each redirect hop. This pipeline
  fetches arbitrary user-saved URLs server-side; the guard is non-negotiable.
- Timeouts (~15s), response size cap (~5MB HTML / ~30MB PDF), honest UA string.
- Each extractor exports an `EXTRACTOR_VERSION` const; the worker re-runs rows
  whose stored version is older.
- New deps: `@mozilla/readability`, `linkedom`, `turndown`, `youtubei.js`.

### 1.3 Pipeline mechanics

- **Enqueue:** `createItem` and any URL-change update upsert a `pending` row
  (existing content kept until new extraction succeeds — swap on success, not
  on enqueue).
- **Worker:** server-only `processPendingContent(limit)` in
  `lib/extract/worker.server.ts` — claims rows with
  `FOR UPDATE SKIP LOCKED WHERE status='pending' AND (next_retry_at IS NULL OR next_retry_at < now())`,
  runs the ladder, writes result. Max 3 attempts, exponential `next_retry_at`
  (1h / 6h / fail).
- **Triggers:** (a) fire-and-forget after `createItem` responds (don't block
  the save); (b) `/api/index` server route (auth-guarded) that drains a batch —
  cron-able via Supabase pg_cron HTTP or a scheduled task; (c) manual
  `reextractItem(itemId)` server fn for a future "re-extract" affordance.
- **Backfill:** `scripts/backfill-content.ts` — enqueues all items missing an
  `ok` row, then drains in batches. **Run deliberately: dev hits the real
  Supabase DB.** Validate on the MOCK_USER_ID test user first.
- RPC wrappers follow the existing pattern: impls in server-only modules,
  `createServerFn` wrappers in `app/actions/index.ts` with dynamic import.

### 1.4 Live-capture ingestion (server side of Part 2)

Server fn `submitLiveContent({ itemId, url, html, title })`:

- Client (webview preload / future extension) sends the rendered
  `document.documentElement.outerHTML` — **extraction runs server-side**
  (Readability + turndown on the submitted DOM), so sanitization and the
  markdown shape stay in one place and the client stays dumb.
- Writes with `source: "live"`, respecting precedence; size-capped; auth'd as
  the current user; only accepted when the submitted URL matches the item's URL
  (normalized).
- The extension later reuses this via an `/api/extension` route — out of scope
  now, but the signature is designed for it.

### 1.5 Embeddings (separable phase — ships after or in parallel with viewer)

- `CREATE EXTENSION IF NOT EXISTS vector;` in `setup.sql`.
- `item_chunks` table: `id, user_id, item_id (FK cascade), chunk_index, text,
  embedding vector(<dim>), model text` + HNSW index (`vector_cosine_ops`) + RLS.
  Item-level mean vector stored as `item_content.embedding`.
- Worker step after successful extraction: heading-aware chunking (~1000
  tokens), embed via a hosted API (provider/model behind
  `EMBEDDING_MODEL` env — decide at build time; corpus-scale cost is pennies),
  L2-normalize, store; mean-pool for the item vector. `model` stored per row —
  never compare vectors across models.
- Consumers (hybrid search, MCP tools, "read next", taste vector) are
  **explicitly out of scope for this plan** — this phase only guarantees the
  vectors exist and stay fresh (re-embed when `content_hash` changes).

---

## Part 2 — In-app viewer

### 2.1 Route + shell

- New route `app/routes/read.$itemId.tsx` (client-only, like the rest) — a
  full-page takeover, not a detail-panel cram. Back returns to the list
  (`app-windows.ts` message pattern already routes item-opens between windows).
- `components/viewer/viewer-shell.tsx` classifies the item (same classifier as
  the extractor ladder) and mounts one engine:
  - `youtube` → YouTubePlayer
  - `pdf` → PdfViewer
  - `web` → Electron: WebEmbed; web app: ReaderView (if `item_content` is `ok`)
    else a NonIdealState with "Open in browser"
- Chrome stays minimal per the design language: back, item title
  (`font-content`), open-external, mark-read. Nothing else until asked.
- Entry points: row action + keyboard shortcut in the list ("Read in app"),
  shown when the item is viewable.

### 2.2 Engines

- **ReaderView** — renders `item_content.markdown` through the existing
  markdown/lowlight pipeline; `font-content` typography, comfortable measure,
  images constrained. This is also the universal fallback engine.
- **YouTubePlayer** — official IFrame Player API wrapper (load the API script,
  wrap ready/state/time in a ref-based controller). Transcript pane beside the
  player when the extractor got one (best-effort). The controller feeds
  `ViewerState.media`.
- **PdfViewer** — `pdfjs-dist` render-to-canvas with a page list; bytes fetched
  through a small auth-guarded proxy route (`app/routes/api.proxy-pdf.ts`,
  SSRF-guarded, streaming) so CORS never blocks and range requests work.
- **WebEmbed (Electron only)** — `<webview>` tag:
  - `electron/windows.ts`: enable `webviewTag: true` only for app windows, and
    harden with a `will-attach-webview` handler (strip `nodeIntegration`,
    enforce our preload path, `sandbox: true`, `contextIsolation: true`,
    `partition: "persist:viewer"`).
  - `electron/viewer-preload.ts`: the guest-side bridge (see 2.3). Messaging is
    `webview.send()` / `ipc-message` — renderer↔guest directly, no main-process
    relay needed. Node screenshots use `webview.capturePage(rect)`.
  - Navigation policy: same-webview navigation allowed (it's a browser pane);
    `window.open`/popups → `shell.openExternal`.
  - Platform switch via the existing `use-is-electron`.
  - Chose `<webview>` over `WebContentsView` deliberately: it's a DOM element,
    so it participates in React layout with zero bounds-syncing IPC. If
    Electron ever removes it, migration to `WebContentsView` is contained to
    this one component.

### 2.3 `ViewerSession` — the agent-ready API surface

`lib/viewer/session.ts` — the contract every engine implements. This is the
primitive future agent interactions build on; nothing else in the app may
reach into engine internals.

```ts
export type ViewerSelection = {
  text: string;
  prefix: string;  // ~200 chars before — anchor context (W3C-annotation style)
  suffix: string;  // ~200 chars after
};

export type ViewerState = {
  kind: "web" | "reader" | "youtube" | "pdf";
  url: string;
  title: string;
  scroll?: { y: number; max: number };                       // web/reader
  media?: { currentTime: number; duration: number; paused: boolean }; // youtube
  page?: { current: number; total: number };                 // pdf
  selection: ViewerSelection | null;
};

export type ViewerEvent =
  | { type: "state"; state: ViewerState }        // throttled scroll/time/nav
  | { type: "selection"; selection: ViewerSelection | null }
  | { type: "navigate"; url: string; title: string };

export interface ViewerSession {
  readonly kind: ViewerState["kind"];
  getState(): Promise<ViewerState>;
  getVisibleText(): Promise<string>;             // what's on screen right now
  getSelection(): Promise<ViewerSelection | null>;
  captureNode(): Promise<Blob | null>;           // element picker → PNG; null if cancelled/unsupported
  extractContent(): Promise<{ html: string; url: string; title: string } | null>; // live-capture feed
  on(listener: (event: ViewerEvent) => void): () => void;    // returns unsubscribe
  // Future (agent write-side) — additive, do not build now:
  // scrollTo(y), seekTo(seconds), goToPage(n), highlightQuote(selection)
}
```

Implementations: `WebviewSession` (preload RPC over `ipc-message`),
`ReaderSession` (owns the DOM — trivial), `YouTubeSession` (player API;
`getVisibleText` = transcript window around `currentTime`; `captureNode` =
frame grab in Electron, null on web), `PdfSession` (text layer of current
page; `captureNode` = page-rect render).

`ViewerSessionProvider` (React context) exposes the active session; a
module-level registry (`getActiveViewerSession()`) exists so a future
agent/MCP bridge can reach it without touching React. **The future agent tool
set — `get_reading_session`, `get_selection`, `capture_node` — is a thin
serialization layer over this interface; that is the design constraint that
matters now.**

`viewer-preload.ts` implements the guest half for web pages: selection
tracking (`selectionchange` → text + prefix/suffix), throttled scroll/nav
state events, `getVisibleText` via viewport-intersection walk, dev-tools-style
element picker (hover overlay → rect back to host for `capturePage`), and
`extractContent` returning `outerHTML`. Guest page JS must never gain access
to app APIs beyond this bridge (contextIsolation + explicit channel allowlist).

### 2.4 Live capture wiring

In WebEmbed: on `dom-ready` + a settle delay (and on SPA `did-navigate-in-page`
to the item's URL), call `session.extractContent()` → `submitLiveContent`.
Debounced, once per URL per session, skipped when the submitted hash matches
the stored one. Result: opening a paywalled/JS-heavy item in the Electron
viewer silently upgrades its indexed content — the human act of reading feeds
the machine layer.

---

## Sequencing (each lands independently)

1. **PR 1 — pipeline foundation:** schema + `setup.sql` (RLS, indexes, sync
   trigger) + extractor ladder + worker + enqueue hooks + backfill script.
   Server-only; verify via MCP/`get_item` or a debug route before any UI.
2. **PR 2 — viewer shell (web-app-safe):** `/read/$itemId` + ReaderView +
   PdfViewer (+ proxy route) + YouTubePlayer + list entry points +
   `ViewerSession` for those three engines.
3. **PR 3 — Electron WebEmbed:** webview hardening in `main.ts`,
   `viewer-preload.ts`, `WebviewSession`, live-capture wiring.
4. **PR 4 — embeddings:** pgvector, chunks, embed step in the worker,
   backfill. (Can run parallel to PRs 2–3.)
5. **Later, separate plans:** captures table + gestures (uses
   `getSelection`/`captureNode`), MCP exposure of content + session, hybrid
   search, recommendation upgrades.

## Verification notes

- `bun run check` per PR; unit tests for URL classification and the
  readability→markdown shape (fixture HTML), mirroring `card-parse.test.ts`
  style.
- Dev/preview hits the **real** Supabase DB: exercise extraction and backfill
  against the MOCK_USER_ID test user; treat bulk backfill of real items as a
  deliberate, user-approved step.
- Extraction quality gate for PR 1: run the ladder over a sample of real saved
  URLs (the `analysis/data/content_cache` corpus identifies which strategies
  matter) and eyeball the markdown before building the reader on top.

## Open decisions (decide at build time, flagged early)

- Embedding provider/model + dimension (affects the `vector(n)` column; pick
  before PR 4, store model per row regardless).
- Whether ReaderView should also be offered in Electron as a toggle over the
  live page (cheap once both exist; default: live page in Electron).
- Transcript library resilience (`youtubei.js` vs alternatives) — isolate
  behind the youtube extractor so swaps are local.
