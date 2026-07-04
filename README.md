# Reading list application with spaced repetition

https://reading-list.khalidbelhadj.com/

An application to track bookmarks and reading list items, take notes, and create spaced-repetition cards. The main form of interaction is through the UI, but a fully integrated MCP server is available. The intent is to use this app as a source of truth for knowledge gathered from reading online material and chatting with an LLM about it.

```sh
bun install
bun run db:push    # tables/columns from db/schema.ts
bun run db:setup   # RLS, policies, search indexes, sync trigger (db/setup.sql)
bun dev            # needs DATABASE_URL in .env.local
```

`db:push` reconciles the schema (tables and columns) against a Supabase
Postgres. `db:setup` then applies everything push does not manage — row-level
security, per-user policies, `pg_trgm` search indexes, and the cross-device
Realtime sync trigger. Both are idempotent; run `db:setup` again after any
schema change to re-assert the security and sync layer. See
[`db/setup.sql`](db/setup.sql).

<img width="1295" height="1100" alt="Screenshot 2026-06-07 at 1 44 23 am" src="https://github.com/user-attachments/assets/8a477903-a5b9-4a39-9d11-f64ecc1b5c31" />
