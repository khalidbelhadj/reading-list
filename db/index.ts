import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema";
import { perfLog } from "@/lib/perf";
import "@/lib/env";

const client = postgres(process.env.DATABASE_URL!, { prepare: false });

export const db = drizzle(client, { schema });

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
  label?: string,
): Promise<T> {
  const txStart = performance.now();
  return db.transaction(async (tx) => {
    const setupStart = performance.now();
    // Combined into a single SELECT so RLS context is set with one round trip
    // instead of two — saves ~25ms per transaction against Supabase.
    await tx.execute(
      sql`SELECT set_config('role', 'authenticated', true), set_config('request.jwt.claims', ${JSON.stringify(
        { sub: userId, role: "authenticated" },
      )}, true)`,
    );
    const setupMs = performance.now() - setupStart;

    const queryStart = performance.now();
    const result = await fn(tx);
    const queryMs = performance.now() - queryStart;

    const totalMs = performance.now() - txStart;
    perfLog(`withUser${label ? `:${label}` : ""}`, totalMs, {
      setup: setupMs.toFixed(1),
      query: queryMs.toFixed(1),
    });

    return result;
  });
}
