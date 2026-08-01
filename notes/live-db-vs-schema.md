# The live DB is the source of truth, not the schema chain (2026-06)

The Supabase database is managed by `bun run db:push` (tables and columns from
`db/schema.ts`) plus `db/setup.sql` (RLS, policies, indexes, the sync trigger).
There is no migration chain to replay — the `drizzle/` folder that once held
generated `*.sql` files is gone, and it was never what produced the live
schema anyway.

**The trap.** While those files existed they described a canonical history that
had already diverged from production. Migration `0005` set
`flashcards.item_id` to `ON DELETE set null`; the live DB sat at `NO ACTION`
until June 2026. Object names diverged the same way: live constraints carry
Postgres auto-names (`flashcards_item_id_fkey`), while the drizzle chain named
them `flashcards_item_id_items_id_fk`. A `DROP CONSTRAINT "<drizzle_name>"`
copied from a migration file fails against live with *constraint does not
exist*.

**How to change live schema.** Resolve the *actual* object name first — query
`information_schema` — and `ALTER` by that name. For one-off DDL, a small
postgres.js script is fine; run it with `NODE_ENV=development`, since the
`@/lib/env` guard rejects a set `MOCK_USER_ID` otherwise.

**Known breakage (as of 2026-06):** `db:push` crashed inside drizzle-kit while
parsing an existing CHECK constraint (`Cannot read properties of undefined
(reading 'replace')`). Verify before relying on it; if it still crashes, apply
DDL by hand as above and keep `db/schema.ts` in step.

Rule of thumb: verify against the live database before trusting anything
generated, and snapshot before a destructive change.
