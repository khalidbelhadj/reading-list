// One-off additive DDL for the intelligence layer (item_content, item_chunks).
// Exists because `bun run db:push` is unusable against the live DB (drizzle-kit
// crashes parsing an existing CHECK constraint) — and these statements are
// purely additive, so hand-applying them is safe. Mirrors db/schema.ts exactly;
// grants/RLS/indexes/triggers land separately via `bun run db:setup`.
//
//   bun x tsx scripts/apply-intelligence-schema.ts   (or: bun scripts/...)
//
// Idempotent and safe to re-run.
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required (set it in .env.local).");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });

try {
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  await sql`
    CREATE TABLE IF NOT EXISTS public.item_content (
      item_id            text PRIMARY KEY REFERENCES public.items(id) ON DELETE CASCADE,
      user_id            uuid NOT NULL,
      status             text NOT NULL DEFAULT 'pending',
      source             text,
      extractor          text,
      extractor_version  integer NOT NULL DEFAULT 0,
      content_hash       text,
      title              text,
      markdown           text,
      word_count         integer,
      error              text,
      attempts           integer NOT NULL DEFAULT 0,
      next_retry_at      timestamptz,
      embedding          vector(1536),
      embedding_model    text,
      embedding_error    text,
      fetched_at         timestamptz,
      created_at         timestamptz NOT NULL,
      updated_at         timestamptz NOT NULL
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS item_content_user_idx
      ON public.item_content (user_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS item_content_claim_idx
      ON public.item_content (status, next_retry_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS public.item_chunks (
      id           text PRIMARY KEY,
      user_id      uuid NOT NULL,
      item_id      text NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
      chunk_index  integer NOT NULL,
      text         text NOT NULL,
      embedding    vector(1536) NOT NULL,
      model        text NOT NULL,
      created_at   timestamptz NOT NULL,
      CONSTRAINT item_chunks_item_idx_unique UNIQUE (item_id, chunk_index)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS item_chunks_user_idx
      ON public.item_chunks (user_id)
  `;

  // App-global settings (currently the active embedding model). No grants and
  // no RLS: reached only through the owner connection, so `authenticated`
  // having no access is the intended state, not an oversight.
  await sql`
    CREATE TABLE IF NOT EXISTS public.app_settings (
      id         text PRIMARY KEY,
      data       jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  // A chunk's model decides which corpus it belongs to, and every search
  // filters on it — index it alongside the owner so that filter isn't a scan.
  await sql`
    CREATE INDEX IF NOT EXISTS item_chunks_user_model_idx
      ON public.item_chunks (user_id, model)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS item_content_model_idx
      ON public.item_content (user_id, embedding_model)
  `;

  console.log(
    "✓ intelligence schema applied (item_content, item_chunks, app_settings)",
  );
} catch (error) {
  console.error("✗ Failed to apply intelligence schema:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
