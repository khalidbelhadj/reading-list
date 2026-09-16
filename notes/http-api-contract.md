# The HTTP API contract (2026-09-08)

The TanStack Start server functions (`createServerFn`, the generated
`app/actions/index.ts` barrel) were replaced by one HTTP API so the native
apps and the web shell share a single, typed surface. This note keeps the
parts of that migration that the code doesn't explain.

## Shape

- `lib/api/contract.ts` is the source of truth: zod schemas plus a route
  table (method, path, params, input, output). Client-safe; zod only.
- `lib/api/client.ts` is the web's typed client. `RouteArgs<K>` makes the
  second argument mandatory exactly when a route has params or a body: the
  route helper casts each definition to a type where `params`/`input` are
  present keys, not optional ones (an optional key never satisfies
  `extends { params: z.ZodType }`, which silently made every call unary).
- `app/api/dispatch.server.ts` matches by method and path (static segments
  outrank parameters), validates with the route's schemas, and maps
  `UnauthorizedError` to 401 and `ActionError` to a 500 with its message.
- `scripts/gen-openapi.ts` derives `openapi/openapi.json`, and a copy in
  `mac/Sources/ReadingListAPI/`, where swift-openapi-generator turns it
  into `Client` + `Components` + `Operations` at build time. `bun run check`
  fails on drift.
- The root route's settings prefetch is the one non-HTTP call left
  (`lib/settings-loader.ts`, `createIsomorphicFn`): on the server it calls
  the implementation directly, since the server calling itself over HTTP
  during SSR is pointless.

## What the generator has to undo in zod's JSON Schema

- `additionalProperties: false` on every object. A generated client would
  reject a response the moment the server adds a field, and the server
  strips unknown request keys rather than rejecting them, so the looser
  document is the accurate one.
- `enum: [true]` for `z.literal(true)`. Code generators only know string
  and integer enums, and a boolean can't be an OpenAPI discriminator; the
  members of `CreateItemResult` are told apart by their required fields.
- `discriminator` blocks, for the same reason.
- Root `$schema`/`$id`/`id`. Strip these at the root only: a naive
  recursive strip of `id` deletes every property named `id`.
- Named components: zod only emits `$ref`s for schemas registered with an
  `id`. Registering the same schema under two ids (a named resource that is
  also a route's output) breaks the refs, so each route schema is converted
  on its own with the named registry as `metadata`, and a route whose
  schema *is* a named one gets a plain `$ref`.
- A component called `Error` becomes `_Error` in Swift; call it
  `ErrorResponse`.

## Timestamps on the wire

Drizzle's `mode: "string"` timestamps pass Postgres' text through:
`2026-09-07 23:02:24.341+00`, a space instead of the `T` and a two-digit
zone. PostgREST had returned proper ISO 8601, so the Swift app's parser
silently rejected every row (the `compactMap` made the list empty with no
error). `Timestamps.parse` now accepts both forms. Anything else consuming
the API (a phone app) needs the same tolerance, or the API should normalise
to ISO 8601 at the edge.
