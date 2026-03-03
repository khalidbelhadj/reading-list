# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands use `bun` (not npm/npx):

- `bun dev` — Start dev server with Turbopack
- `bun x tsc --noEmit` — Type-check without building. **Use this instead of `bun run build` for verification.** A dev server is typically running in a separate process outside this chat — running a full build will conflict with it.
- `bun run build` — Production build (avoid unless explicitly asked — use `tsc --noEmit` instead)
- `bun run start` — Start production server
- `bun run db:push` — Push Drizzle schema to database
- `bun run db:seed` — Seed database with sample data
- `bun x drizzle-kit generate` — Generate Drizzle migrations
- `bun x shadcn@latest add <component>` — Add shadcn/ui components

If asked to run the dev server, run it in the background and read its output to check for errors.

## Architecture

Single-page reading list app with a Chrome extension for quick saving.

**Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Drizzle ORM + Supabase (PostgreSQL), Zustand, TanStack React Query (SSR hydration only), @base-ui/react (headless components)

### Local-First Store

The app uses a **local-first architecture** built on Zustand (`lib/store/`):

- **Source of truth:** `useStore()` — a Zustand store holding all items in a `Map<string, Item>`, plus mutation queue, undo/redo stacks, and sync state
- **Optimistic mutations:** All user actions (create, delete, reorder, toggle read, bulk ops) update the store immediately, then enqueue a mutation for the server
- **Mutation queue:** `lib/store/queue-processor.ts` sends mutations to server actions sequentially. Retry on failure (up to 3 attempts), then mark failed
- **Undo/Redo:** Snapshot-based. Each mutation saves before/after snapshots of affected items. Undo restores the snapshot and enqueues compensating mutations if the original already reached the server
- **Offline support:** Queue pauses when offline, drains when back online. `StoreHydrator` manages online/offline listeners
- **Persistence:** Store state is persisted to localStorage for instant load. `StoreHydrator` (`components/store-hydrator.tsx`) handles the hydration sequence: localStorage first, then SSR data via React Query, then periodic fullSync every 30s

### Data Flow

- **SSR hydration:** `app/page.tsx` prefetches items via React Query + Drizzle. `StoreHydrator` picks up SSR data and hydrates the Zustand store on mount
- **Client mutations:** All writes go through the Zustand store, which enqueues mutations processed by `lib/store/queue-processor.ts` → server actions in `app/actions.ts`
- **Server actions** (`app/actions.ts`) handle all writes (create, update, delete, reorder, bulk operations), each calls `revalidatePath("/")`
- **API routes** (`app/api/items/`) exist for the Chrome extension and for `fullSync` — the web app uses server actions for mutations
- **Periodic sync:** `fullSync` fetches from `/api/items` every 30s and on window focus, overwriting local state only when the mutation queue is idle

### Database

- Schema in `db/schema.ts`: three tables — `items`, `tags`, `items_tags` (many-to-many)
- Items have a `type` field ("bookmark" | "reading-list") and a `position` integer for ordering within each type
- Client in `db/index.ts` uses `postgres` (postgres.js) connecting to Supabase via `DATABASE_URL`
- Config in `drizzle.config.ts` (dialect: postgresql)

### UI Components

- `components/ui/` — shadcn-style wrappers around @base-ui/react primitives, styled with CVA + Tailwind
- `components/items-list.tsx` — Main client component: tabs, search, tag filters, drag-and-drop (@dnd-kit), bulk actions
- `components/items-list/use-keyboard-navigation.ts` — Vim-style keyboard navigation (j/k, gg/G, x to toggle read, d to delete, v for visual/bulk mode, etc.)
- `components/side-panel.tsx` — Reusable sliding panel for edit/create forms
- `components/debug-panel.tsx` — Dev-only debug widgets (enabled via `?debug=true`): store inspector, mutation queue, undo/redo stacks, sync info, font picker
- Icons: @tabler/icons-react
- Theme: oklch color space with light/dark mode variables in `app/globals.css`
- shadcn config in `components.json` (style: base-mira, icon library: tabler)

### Chrome Extension

`extension/` — Manifest V3 extension that talks to localhost:3000 API routes. Lets users save/edit/remove the current tab as a bookmark or reading list item. Uses `/api/items/lookup` to check existing URLs.

### Middleware

`middleware.ts` adds CORS headers to all `/api/*` routes (needed for the extension).

## Notes

`notes/` contains documentation of past bugs, implementation decisions, and architectural notes. Search this directory when investigating issues that may have been encountered before — it may contain relevant root cause analysis or context on why things are built a certain way.

## Known Issues

None currently.
