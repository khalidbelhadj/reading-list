# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands use `bun` (not npm/npx):

- `bun dev` — Start the Vite dev server (TanStack Start; regenerates `app/routeTree.gen.ts` on route file changes)
- `bun run check` — **Run this before declaring any code change done.** Runs the gen-rpc drift check, `tsc --noEmit` (web + electron), `eslint . --max-warnings 0`, `bun test`, and `knip`. Everything must pass with zero errors *and* zero warnings — fix them, don't ignore output.
- `bun run typecheck` / `bun run lint` — Individual halves, if you need to isolate a failure.
- `bun run build` — Production build via `vite build` (avoid unless explicitly asked — use `bun run check` instead)
- `bun run start` — Serve the production build locally (nitro's node server in `.output/`, requires `bun run build` first)
- `bun run db:push` — Push Drizzle schema to database (then ALWAYS `bun run db:setup` — push drops RLS/policies/indexes it doesn't manage)
- `bun run db:setup` — Apply `db/setup.sql` (RLS, policies, grants, trgm indexes, Realtime sync trigger, storage bucket)
- `bun run db:seed` — Seed database with sample data (`SEED_USER_ID=<uuid>` required)
- `bun x shadcn@latest add <component>` — Reference only; the kit lives in `components/system` and new controls are hand-built there with a demo
- `bun run electron:local` / `electron:prod` — Electron dev window against the local / hosted Supabase (`PORT=<n>` to pin a port; each instance is fully isolated)
- `bun run cdp <command>` — Attach to the running dev Electron app over CDP

If asked to run the dev server, run it in the background and read its output to check for errors.

**Verifying anything Electron-specific — traffic-light clearance, vibrancy,
zoom, deep links, open-in-browser tabs — means driving the real app, not the
browser preview.** `electron/main.ts` opens a CDP listener in dev (port
`9222 + (devPort - 3000)`, printed at startup), and `bun run cdp` attaches to
it: `list` enumerates windows, `screenshot --all` captures them, and `eval` /
`click` / `console` drive and read one (`--target=<substring>` picks it; flags
go AFTER the command). See [notes/electron-debugging.md](notes/electron-debugging.md).

## Code Conventions

- Use `useQuery`/`useMutation` from React Query for all server interactions — never bare `await` on server actions in components
- **Always prefer the shared component over a hand-rolled one.** The kit is
  `components/system` (base primitives) + `components/app` (app-shaped
  compositions). Never hand-roll a styled `<button>`, `<input>`, or a
  chip/pill: that's `Button`, `Input`, and `Badge`. If a kit component is
  close but not exact, extend it (a variant, a `className`) rather than
  writing a parallel one.
- Raw `<input>`/`<textarea>` are acceptable *only* for genuinely unstyled
  inline fields (an in-place title edit that must inherit its surroundings),
  never for a standalone form control that should look like the rest of the app.
- **Platform gating goes through `lib/platform.ts`** — `isElectron()` in
  imperative code, `useIsElectron()` in components. Never read
  `window.readingList` directly for gating; CSS is the one exception and gates
  on `html.electron`.
- Export components and hooks as `const X = () =>`, not `function X()`
- Use `useCallback` for functions passed as props
- Component ordering: data/queries → UI state → refs → helpers → hooks → mutations/callbacks → effects → derived state → render
- No `eslint-disable` comments — fix the underlying issue instead
- Full variable names (`searchQuery` not `q`). Single-letter vars only in `.map()/.filter()` chains.
- Extract complex inline JSX logic into `const` or `useMemo` above the return
- Prefer inline arrow: `items.map((item) => (<X />))` not `items.map((item) => { return (<X />) })`

## Design system

`DESIGN.md` is the contract; `/design` renders it. The kit has two layers,
both presentation only (lint-enforced):

- `components/system/` — **base** primitives (Button, Input, Menu, Dialog,
  Notification…). No app knowledge; may not import `components/app`.
- `components/app/` — **app** compositions (ListRow, SidebarItem, ItemMenu,
  Flashcard…). Built from base; take data as props.

`components/shell/` is the app itself — the shell, sidebar, panes, and the
hooks that wire the kit to `@/app/actions` and `@/lib/queries`.

Rules:

- **Every new shared component goes in system/ or app/ with a sibling
  `<name>.demo.tsx`** exporting a `Demo` (see `components/system/demo.ts`).
  `/design/components` collects demos automatically (Base and App sections)
  and `components/app/demos.test.ts` fails `bun run check` when one is missing.
- Use the foundation utilities, never raw values: `rounded-control` /
  `rounded-surface`, `shadow-surface`, `h-row`, `text-small` … `text-display`,
  `glass`. If a value is not a token, it is probably wrong.
- Kit-consuming code (`components/shell`, demos, the design board) may not
  render raw `<button>`/`<input>`/`<textarea>`/`<select>` (lint-enforced);
  add the control to the kit instead.

## Design Language

- Minimal UI — no borders, title bars, or close buttons unless explicitly requested
- When in doubt, build less chrome — the user will ask for more if needed
- Icons: @tabler/icons-react
- Theme: oklch color space with light/dark mode variables in `app/globals.css`
- **Electron traffic lights:** any surface that reaches the top-left of the
  window must reserve clearance for the macOS window buttons. Add
  `electron-top-bar-inset panel-toolbar` to its top bar: that pair resolves to
  `padding-left: var(--traffic-clearance)` under `html.electron` and is a
  no-op on web (see `app/globals.css`). `electron-top-bar-inset` also makes
  the bar a window drag region, which is what you want for a top bar.
- **Vibrancy:** the desktop shell is translucent (`html.electron.app-shell`
  clears the body background; `lib/use-window-vibrancy.ts` +
  `electron/main.ts` own it). Any `backdrop-filter` kills vibrancy — Electron
  popups are solid `var(--surface)` instead of blurred.

## Colors

- Match chroma and hue angle to the nearest existing token (background uses hue 85, chroma 0.005)
- Always show both light and dark mode values for confirmation
- Existing custom tokens: `--badge` / `--badge-foreground` for badges, `--starred` for the star gold, `--link` for links, `--font-content` for the content font

## Architecture

Single-page reading list app with an MCP server for AI integrations.

**Stack:** TanStack Start (Vite, file-based routes in `app/routes/`), TanStack Router, React 19, TypeScript, Tailwind CSS v4, Drizzle ORM + Supabase (PostgreSQL), TanStack React Query, @base-ui/react (headless components)

### Framework layout

- `vite.config.mts` — Vite + `tanstackStart({ srcDirectory: "app" })` + Tailwind. Client-visible env vars (`NEXT_PUBLIC_*`) are inlined via `define`; `.env.local` is loaded into `process.env` for server code.
- `app/router.tsx` — `getRouter()`: creates the router + QueryClient per request/session, wires `setupRouterSsrQueryIntegration`, and passes the middleware's CSP nonce to SSR.
- `app/routes/` — file-based routes; `app/routeTree.gen.ts` is generated (do not edit). `/` is the app: `components/shell/shell.tsx` (`AppShell`) owns the one view (Reading list, Review, or a single item) as in-memory state with its own back/forward stack — the URL carries no view state. The legacy `?item=<id>` param (browser extension, old deep links) is consumed as the initial view. `/design*` is the design board. `__root.tsx` is the document shell (theme bootstrap script, watchers, Toaster, dev banner).
- `app/start.ts` — Start instance: `defaultSsr: false` (route components render client-only; the root route uses `ssr: "data-only"` for the settings prefetch), CSRF middleware, and the request guard.
- `app/server.ts` — custom server entry; imports `lib/env` so the MOCK_USER_ID guard trips at startup.
- **Server functions:** implementations live in plain server-only modules (`app/actions/*.ts`, `lib/queries.server.ts`, `app/actions-storage.server.ts`); the RPC layer (`app/actions/index.ts`, `lib/queries.ts`, `app/actions-storage.ts`) wraps each in `createServerFn` whose handler dynamically imports the impl. `app/actions/index.ts` is GENERATED — never edit it by hand. New action: implement it in the impl module, add a manifest entry in `scripts/gen-rpc.ts`, then `bun run gen:rpc` (`bun run check` fails on drift).
- **Server routes:** raw HTTP endpoints are route files with `server.handlers` (e.g. `app/routes/api.mcp.ts`); their implementations sit next to the old paths (`app/api/mcp/server.ts`, `app/api/ask/server.ts`, `app/api/extension/items.server.ts`, `app/api/storage/server.ts`, `app/auth/callback.server.ts`).

### Data Flow

- **Fetching:** React Query. Keys: `["items"]`, `["all-flashcards"]`, `["item-previews"]`, `["settings"]`. Settings are prefetched server-side in the root route loader and dehydrated automatically.
- **Mutations:** Server functions (exported from `app/actions`) called via `useMutation` with optimistic cache writes → `invalidateQueries` on settle. Error messages thrown server-side (ActionError/UnauthorizedError) serialize across the wire; the mutation cache redirects to /login on "Unauthorized".
- **Cross-device sync:** DB triggers (the `items_sync_notify` trigger in `db/setup.sql`, on `items` and `flashcards`) broadcast on the per-user Realtime topic `items-sync:<userId>`; `components/items-sync-watcher.tsx` (mounted in the root route) invalidates the affected query caches. Same-machine windows mirror invalidations over a BroadcastChannel (`components/local-sync-watcher.tsx`). Do not set `staleTime: Infinity` on `["items"]`.
- **Review is local-first and sessionless:** the queue is derived client-side from the `["all-flashcards"]` cache (`components/shell/review-queues.ts` — also the sidebar's due count); rating a card is one `rateCard` action that updates the card's SRS fields directly (`app/actions/review.ts`), mirrored optimistically in the cache via the same `lib/srs.ts` scheduler. Cram runs pass `affectsSchedule: false`.
- **Flashcards live in the notes:** `<card>` blocks in an item's notes are the source of truth; every notes write goes through `updateItemWithCardSync` (`lib/items.server.ts`), which reconciles the `flashcards` table (`lib/flashcard-sync.server.ts`, parser in `lib/card-parse.ts`).
- **No local state for items** — React Query is the cache. Component state only for UI (selection, editing, search).
- **No undo/redo, no offline queue, no localStorage persistence.**

### Database

Three core tables in `db/schema.ts` — deliberately simple — plus two disposable index tables:

- `items` — the list (title, url, notes, starred/read/hidden flags, favicon + preview image)
- `flashcards` — cards with their SRS scheduling state inline (state, due, interval, easeFactor, reps, lapses); linked to items via nullable `itemId`
- `user_settings` — one jsonb blob per user (validated by `lib/settings.ts`)
- `item_content` / `chunks` — the search index (extracted markdown + the extraction job; pgvector embeddings of content, notes, and cards). Best effort, droppable. See `notes/index-and-review-agent.md`.

Client in `db/index.ts` uses `postgres` (postgres.js) connecting to Supabase via `DATABASE_URL`. Config in `drizzle.config.ts`. `db/setup.sql` owns everything push doesn't (RLS, policies, trgm indexes, sync trigger, storage bucket) — run it after every push. `db/drop-legacy.sql` is the one-shot migration that removed the pre-2026-08-30 tables (tags, review bookkeeping, extraction/embeddings).

### UI Components

- `components/system/` + `components/app/` — the design kit (see Design system above)
- `components/shell/` — the app: `shell.tsx` (view state, history, palette, paste-to-create, deep links), `app-sidebar.tsx`, `all-items.tsx`, `item-view.tsx`, `review-pane.tsx` + `review-deck.tsx`, the `use-*` hooks (optimistic mutations, search, Ask, create), and `view.ts` (the View union + cross-tree command dispatcher)
- `components/system/markdown-editor.tsx` — the kit's tiptap markdown editor (bubble menu, link popover, math, code blocks, image upload via `onUploadImage`); the flashcard `<card>` node is `components/app/flashcard-node.tsx`, passed in via `extensions`

### Fonts

- Default body font is Inter (`--font-sans`)
- Content font (titles, flashcards) uses `font-content` Tailwind class (`--font-content: DM Sans Variable`)
- Do not use inline `style={{ fontFamily }}` — always use the `font-content` class

### Index and agents

The search index is built in the client by a Web Worker (`lib/index-worker/`: loop, extractor ladder, transformers.js embeddings on WebGPU/wasm), started once from the shell via `lib/index-client.ts` and kicked by every successful mutation and every sync ping. The server is storage only: `app/api/index/server.ts` (reconcile, lease jobs, store content and embeddings) and the SSRF-guarded fetch proxy `app/api/fetch/server.ts`; `lib/index/indexer.server.ts` holds the SQL. Nothing schedules on the server. `lib/semantic-search.server.ts` ranks chunks for a query vector the worker produced. `/api/ask` serves two agent modes over the same tools (regex, semantic, flashcards, read_item): `search` (the Ask box) and `review` (the Topic composer in the review pane, which turns the agent's `present_review` into a `ReviewStack`). `semantic_search` is a client-executed tool (`components/shell/use-ask.ts`) because only the worker has the model. Models: `ASK_MODEL` / `REVIEW_MODEL` env, default `gemini-3.1-flash-lite`. See `notes/index-and-review-agent.md`.

### MCP Server

`app/api/mcp/server.ts` (served by the `app/routes/api.mcp.ts` server route) — Remote MCP server using `@modelcontextprotocol/sdk`. Tools: get/search/create/update/delete items, get/search flashcards. Auth via Supabase OAuth (Bearer JWT or cookie session). Used by Claude Desktop, Claude Code, and Claude mobile. Item search is shared with the in-app Ask agent (`app/api/ask/server.ts` → `app/api/mcp/search.ts` → `lib/search.server.ts`, regex/ILIKE — no embeddings).

### Auth

Supabase Auth with Google OAuth. All authentication flows through Supabase — no static API keys or passwords.

- **Web UI**: Google OAuth → Supabase cookie session
- **MCP/API clients**: Supabase OAuth 2.1 Bearer token (verified via `getUser()`)
- **OAuth consent**: `/oauth/consent` page for MCP client authorization
- **Resource metadata**: `/.well-known/oauth-protected-resource` points to Supabase as the authorization server
- **Desktop deep links**: `readinglist://auth/complete` finishes the OAuth round trip; `readinglist://item/<id>` opens an item (handled inside the shell)

### Request middleware

`app/start.ts` registers a global request middleware whose implementation is `lib/request-guard.ts` (dynamically imported, server-only): Supabase auth (OAuth Bearer token or cookie session) + CORS for `/api/*`, session refresh + login redirect for pages, per-request CSP nonce (handed to the router in `app/router.tsx`), and the static security headers. Server-function calls skip the guard — each function authenticates itself via `getCurrentUserId`, and `createCsrfMiddleware` rejects cross-site calls.

## Notes

`notes/` is this repo's memory of *why* — past bugs and their root causes,
implementation decisions, architectural notes. It is the historical record;
consult it before re-deriving anything.

**Read it first.** When investigating a bug, a performance problem, or any
"why is it built this way", search `notes/` before searching the code. Several
of these took days to diagnose and the symptom never points at the cause.

**Write it back.** After fixing a non-obvious bug — one where the symptom and
the cause were far apart, where the obvious fix was wrong, or where you'd have
saved hours by knowing something up front — add a note. Symptom, cause, fix,
and what generalises. A note that only restates the diff is not worth adding;
the value is in the part that isn't recoverable from the code.

## Structural rules

- Server-only modules end in `.server.ts`; client code (components/, app/routes/, app/*.tsx) imports only `@/app/actions` and `@/lib/queries` — lint-enforced via `no-restricted-imports`.
- Size budgets (lint-enforced): 500 lines per file, 250 per function, complexity 25. Split the file, don't raise the limit; never grow the grandfather list in `eslint.config.mjs`.
- Imports are auto-sorted (`simple-import-sort`) — run `bun x eslint . --fix`, don't hand-order them.
- Cross-tree commands go through the dispatcher in `components/shell/view.ts`; subtree state via context; everything else props.
