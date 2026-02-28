# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands use `bun` (not npm/npx):

- `bun dev` — Start dev server with Turbopack
- `bun run build` — Production build
- `bun run start` — Start production server
- `bun run db:push` — Push Drizzle schema to database
- `bun run db:seed` — Seed database with sample data
- `bun x drizzle-kit generate` — Generate Drizzle migrations
- `bun x shadcn@latest add <component>` — Add shadcn/ui components

## Architecture

Single-page reading list app with a Chrome extension for quick saving.

**Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Drizzle ORM + Supabase (PostgreSQL), TanStack React Query, @base-ui/react (headless components)

### Data Flow

- **Server:** `app/page.tsx` fetches items directly via Drizzle (force-dynamic SSR), passes to `ItemsList` client component
- **Client mutations:** Server actions in `app/actions.ts` handle all writes (create, update, delete, reorder, bulk operations), each calls `revalidatePath("/")`
- **API routes** (`app/api/items/`) exist for the Chrome extension — the web app uses server actions instead
- **React Query** wraps everything via `QueryProvider` in root layout; configured with `staleTime: 0`

### Database

- Schema in `db/schema.ts`: three tables — `items`, `tags`, `items_tags` (many-to-many)
- Items have a `type` field ("bookmark" | "reading-list") and a `position` integer for ordering within each type
- Client in `db/index.ts` uses `postgres` (postgres.js) connecting to Supabase via `DATABASE_URL`
- Config in `drizzle.config.ts` (dialect: postgresql)

### UI Components

- `components/ui/` — shadcn-style wrappers around @base-ui/react primitives, styled with CVA + Tailwind
- `components/items-list.tsx` — Main client component: tabs, search, tag filters, drag-and-drop (@dnd-kit), bulk actions
- `components/side-panel.tsx` — Reusable sliding panel for edit/create forms
- Icons: @tabler/icons-react
- Theme: oklch color space with light/dark mode variables in `app/globals.css`
- shadcn config in `components.json` (style: base-mira, icon library: tabler)

### Chrome Extension

`extension/` — Manifest V3 extension that talks to localhost:3000 API routes. Lets users save/edit/remove the current tab as a bookmark or reading list item. Uses `/api/items/lookup` to check existing URLs.

### Middleware

`middleware.ts` adds CORS headers to all `/api/*` routes (needed for the extension).

## Known Issues

None currently.
