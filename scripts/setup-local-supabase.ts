/**
 * Create a confirmed email/password dev user in a LOCAL Supabase stack, so you
 * can sign in at /login without Google OAuth. Idempotent.
 *
 * Full local setup:
 *   bunx supabase start          # boots local Postgres/Auth/Realtime/Storage
 *   bun run env:local            # point .env.local at the local stack
 *   bun run db:push              # create tables from db/schema.ts
 *   bun run db:setup             # RLS, policies, grants, sync trigger, bucket
 *   bun run scripts/setup-local-supabase.ts        # <- this: create dev user
 *   SEED_USER_ID=<printed id> bun run db:seed       # optional sample data
 *
 * The DB/RLS/storage DDL is owned by db/setup.sql (shared with prod); this
 * script only handles the local-only auth user via the GoTrue admin API.
 */
import postgres from "postgres";

// Standard `supabase start` defaults (stable across machines; local-only).
const API_URL = "http://localhost:54321";
const DB_URL = "postgresql://postgres:postgres@localhost:54322/postgres";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const DEV_EMAIL = process.env.DEV_USER_EMAIL ?? "dev@reading.local";
const DEV_PASSWORD = process.env.DEV_USER_PASSWORD ?? "devpassword123";

const createDevUser = async (): Promise<string> => {
  const res = await fetch(`${API_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: DEV_EMAIL,
      password: DEV_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Dev User" },
    }),
  });
  const body = (await res.json()) as { id?: string; msg?: string };
  if (res.ok && body.id) return body.id;

  // Already exists — look the id up so the script stays idempotent.
  if (res.status === 422 || /already.*registered/i.test(body.msg ?? "")) {
    const sql = postgres(DB_URL, { prepare: false });
    try {
      const rows = await sql<{ id: string }[]>`
        SELECT id FROM auth.users WHERE email = ${DEV_EMAIL} LIMIT 1
      `;
      if (rows[0]) return rows[0].id;
    } finally {
      await sql.end();
    }
  }
  throw new Error(`Could not create or find dev user: ${JSON.stringify(body)}`);
};

const main = async () => {
  const userId = await createDevUser();
  console.log("Dev user ready.");
  console.log(`  Sign in:  ${DEV_EMAIL} / ${DEV_PASSWORD}`);
  console.log(`  User id:  ${userId}`);
  console.log(`\nSeed sample data (optional):`);
  console.log(`  SEED_USER_ID=${userId} bun run db:seed`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
