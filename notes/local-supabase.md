# Local Supabase

Run the whole stack (Postgres + Auth + Realtime + Storage + Studio) locally
instead of against the hosted project. Auth uses a real email/password user — no
mock-user shim, no auth/RLS bypass.

## Prerequisites

- Docker running (OrbStack or Docker Desktop). `docker info` should succeed.
- The Supabase CLI is a dev dependency, so use `bunx supabase …`.

## One-time setup

```bash
bunx supabase start          # boots the local stack (first run pulls images)
bun run env:local            # point .env.local at the local stack
bun run db:push              # create tables from db/schema.ts
bun run db:setup             # RLS, policies, grants, sync trigger, storage bucket
bun run db:setup-local       # create the confirmed dev user
SEED_USER_ID=<printed-id> bun run db:seed   # optional sample data
```

- `db:setup` runs `db/setup.sql` — the shared post-schema DDL (also used for
  prod). It now includes the private `note-images` storage bucket + owner
  policy.
- `db:setup-local` (scripts/setup-local-supabase.ts) creates a confirmed GoTrue
  user **dev@reading.local / devpassword123** (override via `DEV_USER_EMAIL` /
  `DEV_USER_PASSWORD`). Local-only; it just calls the admin API.

## Local vs prod

Connection config lives in two gitignored profile files:

- `.env.localdev` — local stack (uses `localhost`, see CSP note below)
- `.env.hosted` — hosted/production project

### Launch an Electron window against either backend

The `.claude/launch.json` configs **local** and **prod** each spin up their own
Electron dev window:

```bash
bun run electron:local   # local stack window
bun run electron:prod    # prod window (warns: writes hit PRODUCTION data)
```

These inject the chosen profile's env into the process (not into `.env.local`),
so a local window and a prod window can run **at the same time** — Vite/Start
lets process.env win, and electron-dev.ts isolates each window by port
(userData dir + single-instance lock). Launcher: scripts/dev-electron.ts.

### Switch the CLI / plain `bun dev`

CLI tools (`db:push`, `db:setup`, `db:seed`) and a plain `bun dev` read
`.env.local`. Swap which backend that points at with:

```bash
bun run env:local              # → local stack
bun run env:prod               # → hosted/prod
bun run scripts/use-supabase.ts   # print the current target
```

The swap script (scripts/use-supabase.ts) `cp`s the chosen profile over
`.env.local`. Restart the process after switching — env is read at start.

## Sign in

Google OAuth is not wired up locally — sign in with the email/password form on
`/login` using the dev credentials above. A real Supabase session cookie
(`sb-localhost-auth-token`) is set; everything downstream (`getCurrentUserId`,
`withUser`, RLS) runs exactly as in production.

## CSP note

`lib/request-guard.ts` `buildCsp` already allows `http://localhost:*` and
`ws://localhost:*` in development (for Vite HMR + React DevTools). The local
profile therefore uses `http://localhost:54321` (not `127.0.0.1`) so the auth
fetch and Realtime WebSocket pass CSP with no code change. The stack binds
`0.0.0.0`, so `localhost` resolves.

## Handy URLs

- App (dev): http://localhost:3000
- Studio: http://localhost:54323
- Inbucket/Mailpit (local email): http://localhost:54324
- Stop everything: `bunx supabase stop`
