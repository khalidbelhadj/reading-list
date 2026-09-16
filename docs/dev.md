# Developing the three shells

The product is one thing: the web app, the Electron wrapper around it, and
the native Mac app. This is how to run each against a backend and drive it.

## Backends

Two profile files, one flag. `local` is the default for every command;
production is always an explicit `--env=prod`.

| Backend | File | What it is |
| --- | --- | --- |
| `local` | `.env.local-stack` | the local Supabase stack (`bunx supabase start`) |
| `prod` | `.env.prod` | the hosted project: real data |

`scripts/profiles.ts` is the one place that knows the files. The dev
banner (web) and dev bar (Mac) colour themselves by backend: blue for
local, amber for production.

## Signing in

There is no auth bypass anywhere. The local stack has one standard user,
`dev@reading.local` / `devpassword123` (`DEV_USER` in `scripts/profiles.ts`,
created by `bun run db:setup-local`), and every shell signs in as it the
same way it would sign in a real user:

| Shell | How |
| --- | --- |
| Web, Electron | the login page's email and password form (shown on the local stack only) |
| Mac | `bun run mac signin` (the same form in the app) |
| Scripts, curl, agents | `bun run --silent dev:token` prints a bearer token for the API |

Production has only Google sign-in. Both desktop apps sign in through the
system browser and come back on `<scheme>://auth/callback?code=…`, holding
the PKCE verifier themselves. Electron returns through the web's
`/auth/callback`, which opens `readinglist://` or `readinglist-dev://`; the
Mac app is sent straight back by Supabase to `readinglist-mac://` or
`readinglist-mac-dev://`, so those two callback urls must be in the
project's redirect allowlist.

## Run

| Shell | Command | Notes |
| --- | --- | --- |
| Web | `bun run dev [--env=prod]` | Vite on :3000; the app at http://localhost:3000 |
| Electron | `bun run electron [--env=prod]` | its own Vite on a free port, isolated userData per window |
| Mac | `bun run mac run [--env=prod]` | builds (`swift build` + the editor bundle), assembles `mac/build/ReadingList.app`, launches |

The Mac app talks to the web app's API, so it needs the web dev server on
:3000 for `local` (production uses the deployed site).

Database commands take the same flag: `bun run db:push --env=prod`,
`bun run db:setup`, `bun run db:seed`.

## Drive

Both harnesses share their verbs so a session reads the same either way.

| Verb | Electron `bun run cdp …` | Mac `bun run mac …` |
| --- | --- | --- |
| windows | `list` | `list` |
| capture | `screenshot [file] [--all]` | `screenshot [file] [--window=…]` |
| read | `text [selector]`, `html`, `find <text>` | `text`, `tree`, `find <text>` |
| point | `click <x> <y>`, `type <text>`, `key <spec>` | `click <x> <y>|<text>`, `hover`, `scroll`, `type <text>`, `key <spec>` |
| run code | `eval <js>`, `console` | `blur`, `dev <state>`, `board <name>` |
| navigate | `navigate <url>`, `reload` | `open [id]`, `review [id]` |
| data | | `items`, `item <id>`, `cards`, `create`, `patch`, `delete`, `refresh` |

Give anything an agent must reach a stable handle: `data-testid` /
`aria-label` on the web, `.accessibilityIdentifier` on the Mac.

## Check

`bun run check` is the whole thing: `check:web` (OpenAPI and fixture drift,
`tsc`, `eslint`, `bun test`, `knip`) then `mac:check` (token drift, the
editor bundle, `swift build`, `swift test`, `swift format lint`). CI runs
the two halves as separate jobs (`.github/workflows/check.yml`).

## Shared, ported, hosted

What a shell needs from the product is one of three things, and never
re-derived by hand:

- **Generated** from a single source: the HTTP contract (`lib/api/contract.ts`
  → `openapi/openapi.json` → the Swift client), icons (`bun run mac:icons`),
  design tokens (`bun run mac:tokens`).
- **Ported with a fixture test**: the scheduler, the review order, the
  notes rewrite, date groups, relative time, YouTube ids, item order.
  `bun run gen:fixtures` runs the TypeScript originals; `swift test` replays
  the fixtures through the ports.
- **Hosted** when porting is a project of its own: the markdown editor
  (`editor-host/`, built into the Mac app and shown in a web view).

Feature status across shells lives in [parity.md](parity.md).
