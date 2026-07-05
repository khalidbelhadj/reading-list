# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands use `bun` (not npm/npx):

- `bun dev` — Start the Vite dev server (TanStack Start; regenerates `app/routeTree.gen.ts` on route file changes)
- `bun run check` — **Run this before declaring any code change done.** Runs `tsc --noEmit` followed by `eslint . --max-warnings 0`. Both must pass with zero errors *and* zero warnings. Warnings are not optional — fix them or `_`-prefix the identifier; do not ignore output.
- `bun run typecheck` / `bun run lint` — Individual halves of `check`, if you need to isolate a failure.
- `bun run build` — Production build via `vite build` (avoid unless explicitly asked — use `bun run check` instead)
- `bun run start` — Serve the production build locally (nitro's node server in `.output/`, requires `bun run build` first)
- `bun run db:push` — Push Drizzle schema to database
- `bun run db:seed` — Seed database with sample data
- `bun x drizzle-kit generate` — Generate Drizzle migrations
- `bun x shadcn@latest add <component>` — Add shadcn/ui components

If asked to run the dev server, run it in the background and read its output to check for errors.

## Code Conventions

- Use `useQuery`/`useMutation` from React Query for all server interactions — never bare `await` on server actions in components
- Use shadcn `Button` for all buttons, never raw `<button>`. Raw `<input>` and `<textarea>` are fine for unstyled inline form fields.
- Export components and hooks as `const X = () =>`, not `function X()`
- Use `useCallback` for functions passed as props
- Component ordering: data/queries → UI state → refs → helpers → hooks → mutations/callbacks → effects → derived state → render
- No `eslint-disable` comments — fix the underlying issue instead
- Full variable names (`searchQuery` not `q`). Single-letter vars only in `.map()/.filter()` chains.
- Extract complex inline JSX logic into `const` or `useMemo` above the return
- Prefer inline arrow: `items.map((item) => (<X />))` not `items.map((item) => { return (<X />) })`

## Design Language

- Minimal UI — no borders, title bars, or close buttons unless explicitly requested
- Cards use `bg-card` with `rounded-lg`, no border
- When in doubt, build less chrome — the user will ask for more if needed
- Icons: @tabler/icons-react
- Theme: oklch color space with light/dark mode variables in `app/globals.css`
- shadcn config in `components.json` (style: base-mira, icon library: tabler)

## Colors

- Match chroma and hue angle to the nearest existing token (background uses hue 85, chroma 0.005)
- Always show both light and dark mode values for confirmation
- Existing custom tokens: `--badge` / `--badge-foreground` for badge backgrounds, `--font-content` for serif font

## Architecture

Single-page reading list app with an MCP server for AI integrations.

**Stack:** TanStack Start (Vite, file-based routes in `app/routes/`), TanStack Router, React 19, TypeScript, Tailwind CSS v4, Drizzle ORM + Supabase (PostgreSQL), TanStack React Query, @base-ui/react (headless components)

### Framework layout

- `vite.config.mts` — Vite + `tanstackStart({ srcDirectory: "app" })` + Tailwind. Client-visible env vars (`NEXT_PUBLIC_*`) are inlined via `define`; `.env.local` is loaded into `process.env` for server code.
- `app/router.tsx` — `getRouter()`: creates the router + QueryClient per request/session, wires `setupRouterSsrQueryIntegration`, and passes the middleware's CSP nonce to SSR.
- `app/routes/` — file-based routes; `app/routeTree.gen.ts` is generated (do not edit). `__root.tsx` is the document shell (theme bootstrap script, watchers, Toaster, dev banner).
- `app/start.ts` — Start instance: `defaultSsr: false` (route components render client-only; the root route uses `ssr: "data-only"` for the settings prefetch), CSRF middleware, and the request guard.
- `app/server.ts` — custom server entry; imports `lib/env` so the MOCK_USER_ID guard trips at startup.
- **Server functions:** implementations live in plain server-only modules (`app/actions/*.ts`, `lib/queries.server.ts`, `app/actions-storage.server.ts`); the RPC layer (`app/actions/index.ts`, `lib/queries.ts`, `app/actions-storage.ts`) wraps each in `createServerFn` whose handler dynamically imports the impl — that keeps db/pdf code out of the client bundle while preserving call signatures. Add new actions in both places, following the existing pattern.
- **Server routes:** raw HTTP endpoints are route files with `server.handlers` (e.g. `app/routes/api.mcp.ts`); their implementations sit next to the old paths (`app/api/mcp/server.ts`, `app/api/extension/items.server.ts`, `app/api/storage/server.ts`, `app/auth/callback.server.ts`).

### Data Flow

- **Fetching:** React Query with `queryKey: ["items"]`. Settings are prefetched server-side in the root route loader (`app/routes/__root.tsx`) and dehydrated automatically by the router/query SSR integration.
- **Mutations:** Server functions (exported from `app/actions`) called via `useMutation` → `invalidateQueries(["items"])` on success. Error messages thrown server-side (ActionError/UnauthorizedError) serialize across the wire; the mutation cache redirects to /login on "Unauthorized".
- **Cross-device sync:** DB triggers (the `items_sync_notify` trigger in `db/setup.sql`) broadcast on the per-user Realtime topic `items-sync:<userId>`; `components/items-sync-watcher.tsx` (mounted in the root route) invalidates the affected query caches. Items queries use the provider's default 30s `staleTime` + refetch-on-focus — do not set `staleTime: Infinity` on `["items"]`.
- **No local state for items** — React Query is the cache. Component state only for UI (selection, editing, search).
- **No undo/redo, no offline queue, no localStorage persistence.**

### Database

- Schema in `db/schema.ts`: four tables — `items`, `tags`, `items_tags` (many-to-many), `flashcards` (linked to items)
- Items have a `position` integer for ordering
- Flashcards have `front`/`back` text, linked to items via `itemId` (nullable FK)
- Client in `db/index.ts` uses `postgres` (postgres.js) connecting to Supabase via `DATABASE_URL`
- Config in `drizzle.config.ts` (dialect: postgresql)
- MCP search uses the `pg_trgm` extension + trigram similarity in `lib/trigram.ts`

### UI Components

- `components/ui/` — shadcn-style wrappers around @base-ui/react primitives, styled with CVA + Tailwind
- `components/items-list.tsx` — Main client component: tabs, tag filters, drag-and-drop (@dnd-kit)
- `components/items-list/detail-panel.tsx` — Fixed right-side panel showing item edit form + flashcards when an item is selected
- `components/items-list/use-keyboard-navigation.ts` — Keyboard navigation (Ctrl+N/P, Enter, Escape, Cmd+V paste, etc.)
- `components/items-list/tag-input.tsx` — Inline tag input with badges
- `components/items-list/use-filters.ts` — Client-side filtering by read state and tags
- `components/items-list/use-mutations.ts` — React Query mutation wrappers for item CRUD

### Fonts

- Default body font is Inter (`--font-sans`)
- Content font (titles, flashcards, tabs) uses `font-content` Tailwind class (`--font-content: DM Sans Variable`)
- Do not use inline `style={{ fontFamily }}` — always use the `font-content` class

### MCP Server

`app/api/mcp/server.ts` (served by the `app/routes/api.mcp.ts` server route) — Remote MCP server using `@modelcontextprotocol/sdk`. Exposes tools for reading list + flashcard CRUD. Auth via Supabase OAuth (Bearer JWT or cookie session). Used by Claude Desktop, Claude Code, and Claude mobile.

### Auth

Supabase Auth with Google OAuth. All authentication flows through Supabase — no static API keys or passwords.

- **Web UI**: Google OAuth → Supabase cookie session
- **MCP/API clients**: Supabase OAuth 2.1 Bearer token (verified via `getUser()`)
- **OAuth consent**: `/oauth/consent` page for MCP client authorization
- **Resource metadata**: `/.well-known/oauth-protected-resource` points to Supabase as the authorization server

### Request middleware

`app/start.ts` registers a global request middleware whose implementation is `lib/request-guard.ts` (dynamically imported, server-only): Supabase auth (OAuth Bearer token or cookie session) + CORS for `/api/*`, session refresh + login redirect for pages, per-request CSP nonce (handed to the router in `app/router.tsx`), and the static security headers. Server-function calls skip the guard — each function authenticates itself via `getCurrentUserId`, and `createCsrfMiddleware` rejects cross-site calls.

## Notes

`notes/` contains documentation of past bugs, implementation decisions, and architectural notes. Search this directory when investigating issues that may have been encountered before.

## Known Issues

- Hydration mismatch on tag filter button: the button is always rendered with `disabled={allTags.length === 0}` to avoid SSR/client DOM mismatch. Do not conditionally render toolbar buttons based on client-only state.
- Auto-save in the detail panel uses refs (`lastSavedRef`, `liveRef`, `onSaveRef`) to avoid stale closures: `lastSavedRef` is the dirty-tracking baseline (updated after every save *and* every adopted server change), `liveRef` mirrors the latest field values for the unmount flush, `onSaveRef` holds the latest save callback. The panel remounts per item (`key={item.id}` in `sliding-item-panel.tsx`), so switching items reseeds the fields via `useState` initializers — the single adopt effect only reconciles cross-device changes to the *currently open* item, per field (untouched fields refresh; in-progress edits win and flush on the next save). When modifying save logic, pass explicit IDs rather than relying on closure-captured values.
