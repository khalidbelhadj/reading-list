# Local-first architecture

Design notes for making the app work offline — reads *and* writes — with the
desktop (Electron) app as the primary offline target.

Goal: no loading states in the common path, and a fully usable app with no
network. Actions apply instantly and drain to the server in the background.

## Where we're starting from

More is in place than it looks:

- **Optimistic mutations already exist.** `use-item-mutations.ts`,
  `use-bulk-mutations.ts` and `use-tag-mutations.ts` all do
  `onMutate` → `setQueryData` → rollback on error. Toggling read, pinning,
  deleting and editing already apply instantly.
- **Cross-device sync exists.** A Postgres trigger broadcasts on the per-user
  Realtime topic (`lib/items-sync.ts`), and `items-sync-watcher.tsx`
  invalidates the affected caches.
- **Cross-window sync exists.** BroadcastChannel mirroring in
  `lib/local-sync.ts`.
- **The logic that has to run client-side is already pure.** `lib/srs.ts` has
  zero imports; `card-parse.ts` and `normalizeUrl` are pure. None of them are
  behind the `.server` fence.

What is missing is durability, in three layers: the app shell, the read cache,
and the write queue. Each is independent of the others.

## 1. The shell: service worker, not a custom protocol

Today `electron/main.ts` does `loadURL(PROD_URL)`. With no network, the window
is blank — the desktop app is exactly as dead offline as the web app.

The obvious fix is to bundle the client build and serve it from `app://` or
`file://`. **Don't.** Moving the renderer off the app's real origin breaks
three things at once:

- Supabase cookie sessions are origin-scoped.
- `createCsrfMiddleware` rejects cross-site server-function calls by design.
- `createServerFn` posts to relative URLs, which would resolve against the
  custom protocol.

Instead: keep `loadURL(PROD_URL)` and add a **service worker** that caches the
app shell and static assets. Electron is Chromium, so this is the same
mechanism as the web. Origin is unchanged, so cookies, CSRF and server
functions all keep working untouched — and the web app gets offline support
for free from the same code.

Rules for the SW:

- Cache-first for the document shell and hashed assets.
- **Never cache the RPC POSTs.** Server functions are `method: "POST"` to
  `/_serverFn/*`; those must always hit the network and fail cleanly offline
  so the outbox can pick them up.
- TanStack Start's SPA mode (`_shell.html`) is the natural thing to cache,
  given `defaultSsr: false` already renders routes client-only.

### CSP gotcha

`lib/request-guard.ts` sets `script-src 'self' 'nonce-<per-request>'
'strict-dynamic'` and the framework stamps that nonce onto the head scripts.
A cached shell replays a *stale* nonce.

This works as long as the SW caches the whole `Response` (headers included)
via the Cache API — the cached CSP header and the cached HTML then agree with
each other, which is all the browser checks. Worth verifying explicitly on the
first offline boot, because the failure mode is silent: the inline theme
bootstrap gets blocked and the app flashes the wrong theme or doesn't mount.

Note the mild security tradeoff: a locally cached nonce is a fixed nonce for
as long as the shell is cached.

## 2. Auth: a local identity, separate from a live token

This is the subtlest part and the easiest to get wrong.

Supabase access tokens are short-lived (minutes to an hour) and refresh
requires the network. Offline for longer than the token's life, the client
session goes null, `onAuthStateChange` emits `SIGNED_OUT`, and the app bounces
to `/login` — a login page that cannot possibly work offline. The user is
locked out of their own local data.

So we need to split two concepts that are currently one:

- **"Who is this?"** — a locally persisted user id, durable across restarts,
  used to scope the local cache and stamp outbox entries.
- **"Can we talk to the server right now?"** — a live, unexpired JWT.

Offline boot uses the first and tolerates the absence of the second. Only an
explicit sign-out, or a refresh that the server actively *rejects* (as opposed
to one that failed to send), clears the local identity. A failed refresh with
no network is not a logout.

The login redirect in `lib/request-guard.ts` is server-side, so a
SW-served shell never hits it. The client-side redirect is the one to fix.

## 3. Reads: persist the query cache

Persist React Query to IndexedDB (`@tanstack/react-query-persist-client` +
an IndexedDB persister — localStorage's ~5MB ceiling is too tight).

Exclusions matter more than inclusions:

- `item-previews` — a ~2.4MB base64 payload, already deliberately split out of
  `fetchItems` for this reason.
- Anything content- or embedding-shaped (`item_content`, `item_chunks`).
  Server-owned, worker-produced, and large. These never replicate locally.

That exclusion list is a clean architectural line: **items, tags and
flashcards replicate; extracted content and vectors do not.**

### The extraction-drain collision

`fetchItems` calls `maybeDrainInBackground()` — the intelligence pipeline has
no cron and piggybacks on the items refetch as its heartbeat.

Local-first deliberately removes that heartbeat. Serve items from IndexedDB on
cold start and extraction retries quietly stop running. This must be
decoupled *before* the cache is persisted — move the drain to a scheduled
trigger, or give it its own ping. Tying a server-side job queue to a client
cache-miss doesn't survive this change.

## 4. Writes: an outbox

Use `@tanstack/offline-transactions` (currently 1.0.42): outbox pattern with
persist-before-dispatch, IndexedDB with localStorage fallback, exponential
backoff with jitter, FIFO sequential processing, and multi-tab leader election.
That last one matters here — this app already runs multiple windows.

It layers over the existing server functions, so `app/actions/` is not
rewritten.

The current `onSettled: invalidate()` pattern has to change regardless: offline
it fires a refetch that fails and can clobber optimistic state. Invalidation
needs to be conditional on connectivity, or replaced by the collection layer.

### Optimistic create

`use-create-item.ts` has no `onMutate` — it round-trips because the server
mints the id and runs the duplicate-URL check. It is the one action the app
exists for, and the only one that makes you wait.

Both blockers are already solved elsewhere in the codebase:

- `createItems` accepts a caller-supplied `id`, so the client can mint the
  UUID.
- The duplicate check is a URL comparison that can run against the cached list
  using the same pure `normalizeUrl`.

### Offline review

The flagship offline use case (reviewing on a plane) is very achievable:

- `schedule()` in `lib/srs.ts` is pure, so the client can compute the next SRS
  state itself.
- `rateCard` reads the card's current state, calls `schedule()`, then writes
  the flashcard row plus a `card_reviews` row. The client has all of that
  cached.
- `review_sessions` and `card_reviews` use text ids — client-mintable.

### Offline note edits

Notes are the source of truth for inline flashcards, and reconciliation
(`diffCards`) currently runs server-side. It's a pure function, but it now
lives in `lib/flashcard-sync.server.ts`, behind the lint fence. Split the pure
half into `lib/flashcard-diff.ts` so the client can run it and keep flashcard
counts correct offline.

## 5. Schema prerequisites

Two id columns block offline writes:

- **`tags.id` is `serial`.** A client can't mint tag ids. Item edits dodge this
  today by passing `tagNames` and faking negative ids in the optimistic path
  (`use-item-mutations.ts`), but `renameTag`/`deleteTag` take real ids. Migrate
  to a text UUID and the hack goes away with it.
- **`review_events.id` is `bigserial`.** These are analytics events. Either
  make them client-mintable too, or accept that they batch and only flush
  online — losing some offline telemetry is an acceptable trade if that's
  cheaper.

## 6. Reconciliation

Last-write-wins on `updatedAt`, which every table already has. Single user,
few devices, low contention — LWW is genuinely sufficient and anything more is
premature.

The exception is **notes**. They're long-lived text, and naive LWW eats
paragraphs. The detail panel already implements per-field adopt logic for
exactly this (the `lastSavedRef` / `liveRef` / `onSaveRef` dance): untouched
fields refresh from the server, in-progress edits win and flush on the next
save. Extend that rather than reaching for CRDTs — a Yjs/Automerge layer is a
much larger commitment than the problem currently warrants.

## 7. Online-only surfaces

These can't work offline and should degrade *visibly* rather than fail:

`fetchPageTitle`, `generateItemPreview`, semantic search, the Ask features,
and the whole extraction/embedding pipeline.

Full-text search needs a client-side fallback over the cached list, since
server search is server-only either way.

## Phasing

Each phase is independently shippable.

**Phase 0 — prerequisites.** Decouple the extraction drain from `fetchItems`.
Split `lib/flashcard-diff.ts` out of the `.server` module. Migrate `tags.id` to
a UUID. Decide the `review_events` question.

**Phase 1 — offline reads.** Service worker + shell caching. Persist the query
cache to IndexedDB with the exclusion list. Local identity separated from live
token. Connectivity indicator in the UI.

**Phase 2 — offline writes.** Outbox. Optimistic create. Client-side flashcard
diff on notes save. Client-side SRS for offline review sessions. Conditional
invalidation.

**Phase 3 — TanStack DB (optional).** Collections + live queries, replacing the
client-side filtering in `use-filters.ts` and the hand-rolled `onMutate`
blocks. Worth doing only if phases 1–2 leave real pain; it's a pre-1.0
dependency (`@tanstack/react-db` is 0.1.x) and the outbox — the part we
actually need — is usable standalone.

## Constraints to build within

- Size budgets are lint-enforced (500 lines/file, 250/function, complexity 25),
  so the sync layer must be several small modules from the start, not one
  `lib/sync.ts`.
- `app/actions/index.ts` is generated: new actions need an impl module, a
  manifest entry in `scripts/gen-rpc.ts`, then `bun run gen:rpc`. The dynamic
  `import()` must stay inline in each `.handler()` or server code leaks into
  the client bundle.
- Client code cannot import `@/db`, `drizzle-orm`, `postgres`, or `**/*.server`.
- `CLAUDE.md` currently states "no localStorage persistence" and "no offline
  queue" — both need updating as part of this work.
