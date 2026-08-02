# Auth round trips: getUser → getClaims

_2026-08-02_

## The problem

Every authenticated operation paid a network hop to Supabase Auth.
`supabase.auth.getUser()` does not decode the JWT locally — it POSTs to
`/auth/v1/user` so the auth server can validate it. We called it from 9 places
backing 46 `getCurrentUserId` / `withCurrentUser` call sites, with no
memoisation anywhere.

Worse, the guard resolved the user and then discarded it: server functions skip
the guard by design (`lib/request-guard.ts`, the `handlerType === "serverFn"`
early return), so each one re-resolved from scratch.

A cold load of `/` cost roughly five auth HTTP calls:

| Step | auth HTTP |
| --- | --- |
| `GET /` HTML → guard | 1 |
| root loader → `getSettings` | 1 |
| `["items"]` | 1 |
| `["review-status"]` (toolbar) | 1 |
| `["item-previews"]` (thumbnails) | 1 |

## The fix

Swapped `getUser()` for `getClaims()` in `lib/auth.ts` and
`lib/request-guard.ts`. `getClaims()` verifies the token signature locally with
WebCrypto against a JWKS cached per server instance — no network — **provided
the Supabase project signs with asymmetric keys**.

On a legacy HS256 symmetric-secret project, `getClaims()` falls back to exactly
the same remote call it replaced — so the code change would be inert until the
project rotated to asymmetric signing keys.

**This project was already rotated.** Verified 2026-08-02 on the dashboard's
JWT Keys screen: current key `1BCA4833-A9BE-4ADC-811B-8FF6DDD273BC`, type ECC
(P-256), matching the sole `kid` advertised at `/auth/v1/.well-known/jwks.json`.
Two entries sit under "Previously used keys" — the legacy HS256 shared secret
and an older ECC key — so the project has rotated twice.

The consequence: `getUser()` was paying a network hop to Supabase Auth on every
request for a token the server could already have verified locally. The code
change is the entire fix, with no dashboard step and no rotation risk.

Note the JWKS advertises only the *current* key. Tokens signed by the older ECC
key can no longer be verified, but those expired long ago (access token TTL is
an hour), so it's inert.

Tradeoff accepted: local verification cannot see a session revoked mid-lifetime
until its access token expires. Standard JWT tradeoff; shorten the access token
TTL if it ever matters.

`getClaims()` still refreshes a near-expiry session before validating, so the
guard's `Set-Cookie` session-refresh behaviour is unchanged.

## The trap: dev round-trip costs do not transfer to prod

`notes/performance-profile-2026-07-02.md` measured ~17ms per DB round trip,
which makes `withUser`'s ceremony (BEGIN + `set_config` + COMMIT = 3 round trips
on top of the real query) look like ~50ms of pure waste per query.

**That number was measured from a laptop against the Supabase pooler.** In
production, Vercel runs in `dub1` (Dublin, per `vercel.json`) and the Supabase
pooler is in `eu-west-1` (Ireland) — co-located, so round trips are more like
1–3ms and the same ceremony costs perhaps 5–10ms.

So "collapse `withUser` into a single flight" is a much smaller win in prod than
the dev profile suggests, and it is not free:

- A CTE wrapping `set_config` + the query is **unsafe**: Postgres does not
  guarantee CTE side-effect ordering relative to the outer query's RLS checks,
  so the policy could evaluate before the role is set.
- The simple-protocol multi-statement flight (the ~18ms floor in the perf note)
  cannot carry bind parameters, so it can't back a general helper.
- Which leaves only: drop RLS impersonation for those reads and rely on the
  app-level `eq(userId)` filter alone.

That last option is defensible — RLS policies must stay in the database
regardless, because the browser holds the anon key and talks to Supabase
directly for Realtime sync, so they still guard that surface. But it trades a
real safety layer for single-digit milliseconds. **Decide it on prod numbers,
not the dev profile.**

## Getting the prod numbers

The guard now emits a `Server-Timing: auth;dur=…, handler;dur=…` header on
every page and `/api/*` response. `auth` is session resolution, `handler` is
everything the route does (including all DB work). Visible in any browser
network panel, and in the extension's.

This is the only view of what auth actually costs against a real project — dev
`perfLog` output only covers server functions, and `MOCK_USER_ID` skips auth
entirely there.

## Follow-on that became unnecessary

Memoising the resolved user per request (AsyncLocalStorage) was on the list to
collapse the guard + loader double-resolve. With local verification that saves
microseconds. Dropped.
