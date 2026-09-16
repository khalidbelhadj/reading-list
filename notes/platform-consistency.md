# One product, three shells (2026-09-15)

The decision behind the infrastructure: the web app is the product, the
Electron app wraps it, and the native Mac app re-implements it. Anything
added to one is added to the others. This note records what was
inconsistent, what was decided, and where each piece lives.

## What was inconsistent

- Three ways to pick a backend: the web copied a profile over `.env.local`
  (which was production, under Vite's "local" name), Electron took
  `electron:local|prod`, the Mac app `--env=local|prod`.
- Two desktop sign-in flows on two deep-link paths, and two apps claiming
  the same `readinglist://` scheme.
- Two harnesses with different verbs, documented in different places.
- Nothing recorded which feature existed where; only the kit had a parity
  check, and only on the web.
- Shared, ported or hosted was decided case by case; colours and type were
  ported by hand.
- `bun run check` covered web and Electron only; CI ran nothing on push.

## What was decided

- **One profile mechanism** (`scripts/profiles.ts`): `.env.local-stack` and
  `.env.prod`, `--env=local|prod` on every command, local the default.
  `applyBackend()` for in-process readers (Vite's config, drizzle, the db
  scripts), `with-env.ts` for spawned ones.
- **One desktop auth flow**: both desktop apps return on
  `<scheme>://auth/callback?code=…`. Electron goes through the web's
  `/auth/callback` (its renderer holds the verifier); the Mac app is sent
  straight back by Supabase, so its callback urls are in the allowlist.
  Each app and build owns a scheme: Electron `readinglist` /
  `readinglist-dev`, Mac `readinglist-mac` / `readinglist-mac-dev`. The web's return page opens whichever scheme the
  app that started sign-in named. The Mac release keeps its session in the
  Keychain; dev builds in a file (ad-hoc re-signing would otherwise prompt).
- **One check, in CI**: `check:web` + `mac:check`, the latter with token
  drift, the editor bundle, `swift build`, `swift test`, `swift format lint`.
  `.github/workflows/check.yml` runs the halves as two jobs.
- **Parity you can see**: `docs/parity.md`, updated with every feature
  change; the demos test fails when a web kit component has no Mac demo.
- **Generated, ported with fixtures, or hosted** (`docs/dev.md`): the
  contract, icons and tokens are generated; small logic is ported and
  pinned by `gen:fixtures` + `swift test`; the editor is hosted.
- **Settings through the API on the Mac**, one schema that roams.
- **No auth bypass**: `MOCK_USER_ID` is gone. The local stack has one
  standard email/password user (`DEV_USER`), and the web, Electron, the Mac
  app, scripts and agents all sign in as it (`bun run dev:token` for the
  latter).
- **Swift formatted and linted** by swift-format (`mac/.swift-format`).

## What the fixtures caught on day one

The Mac's `timeAgo` had weeks the web never shows; `youtubeVideoID`
accepted hosts and paths the web rejects and skipped the eleven-character
check; the date-group month label followed the machine's time zone rather
than the calendar's; item order compared titles by code point where the
web uses locale order. None of these were visible in the app; all four
would have surfaced as "the Mac shows something different" months later.
