import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema";
import { perfLog } from "@/lib/perf";
import "@/lib/env";

const client = postgres(process.env.DATABASE_URL!, { prepare: false });

// Dev-only query trace: logs every SQL statement with the time elapsed since
// the previous one, making sequential round-trip chains visible in the server
// log. drizzle's logger fires as each query is dispatched, so the delta on
// line N+1 approximates the round-trip time of line N.
let lastQueryAt = 0;
const queryTraceLogger = {
  logQuery(query: string) {
    const now = performance.now();
    const delta = lastQueryAt ? (now - lastQueryAt).toFixed(1) : "-";
    lastQueryAt = now;
    console.log(
      `[sql] +${delta}ms ${query.replace(/\s+/g, " ").slice(0, 110)}`,
    );
  },
};

export const db = drizzle(client, {
  schema,
  ...(process.env.SQL_TRACE === "1" ? { logger: queryTraceLogger } : {}),
});

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// The originating client's sync id (see components/items-sync-watcher.tsx):
// forwarded into the transaction as `app.sync_origin` so the items_sync_notify
// trigger can stamp broadcasts with it and the sender can skip its own echo.
// Read from the request cookie via a dynamic import so this module stays
// importable outside a Next request context (seed/setup scripts, MCP route
// without the cookie) — any failure just means "no origin", which disables
// suppression for that write.
const SYNC_ORIGIN_PATTERN = /^[a-zA-Z0-9-]{1,64}$/;
const getSyncOrigin = async (): Promise<string> => {
  try {
    const { cookies } = await import("next/headers");
    const value = (await cookies()).get("sync-origin")?.value ?? "";
    return SYNC_ORIGIN_PATTERN.test(value) ? value : "";
  } catch {
    return "";
  }
};

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
  const syncOrigin = await getSyncOrigin();
  return db.transaction(async (tx) => {
    const setupStart = performance.now();
    // Combined into a single SELECT so RLS context is set with one round trip
    // instead of two — saves ~25ms per transaction against Supabase.
    await tx.execute(
      sql`SELECT set_config('role', 'authenticated', true), set_config('request.jwt.claims', ${JSON.stringify(
        { sub: userId, role: "authenticated" },
      )}, true), set_config('app.sync_origin', ${syncOrigin}, true)`,
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
