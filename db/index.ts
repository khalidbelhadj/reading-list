import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!, { prepare: false });

export const db = drizzle(client, { schema });

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Runs `fn` inside a transaction that impersonates `userId` at the Postgres
 * level: `SET LOCAL role authenticated` and `SET LOCAL request.jwt.claims`
 * cause Supabase's `auth.uid()` to return `userId`, which is what the RLS
 * policies filter on.
 *
 * This is the suspenders of the belt-and-suspenders design — every query
 * should also include `eq(table.userId, userId)` at the application layer.
 */
export async function withUser<T>(
  userId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('role', 'authenticated', true)`);
    await tx.execute(
      sql`SELECT set_config('request.jwt.claims', ${JSON.stringify({
        sub: userId,
        role: "authenticated",
      })}, true)`,
    );
    return fn(tx);
  });
}
