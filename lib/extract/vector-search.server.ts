// pgvector query tuning for the semantic-search path.
//
// The HNSW index (db/setup.sql) covers `embedding` alone, so the `user_id`
// filter — and the RLS predicate behind it — is applied *after* the index
// hands back its candidate set. With the default ef_search that set is ~40
// rows across the whole table, so on a multi-user table a search can return
// fewer rows than its LIMIT, or none, without raising anything.
//
// pgvector 0.8 added iterative index scans, which keep pulling candidates
// until the LIMIT is satisfied or the index is exhausted. That is exactly the
// fix, but setting an unrecognized `hnsw.*` GUC against an older pgvector
// raises and aborts the surrounding transaction — so probe the version once
// per process and skip the setting when it wouldn't be understood.
import { sql } from "drizzle-orm";

import { db, type Tx } from "@/db";

const parseVersion = (raw: string): [number, number] => {
  const [major, minor] = raw
    .split(".")
    .map((part) => Number.parseInt(part, 10));
  return [
    Number.isFinite(major) ? (major ?? 0) : 0,
    Number.isFinite(minor) ? (minor ?? 0) : 0,
  ];
};

const probeIterativeScan = async (): Promise<boolean> => {
  try {
    const rows = await db.execute(
      sql`SELECT extversion FROM pg_extension WHERE extname = 'vector'`,
    );
    const version = (Array.from(rows)[0] as { extversion?: string } | undefined)
      ?.extversion;
    if (!version) return false;
    const [major, minor] = parseVersion(version);
    return major > 0 || minor >= 8;
  } catch {
    // Can't tell — assume not supported rather than risk aborting searches.
    return false;
  }
};

// Cached as a promise so concurrent first-callers share the single probe.
let iterativeScanSupported: Promise<boolean> | null = null;

// Call inside the search transaction, before the ANN query. No-op when the
// installed pgvector predates iterative scans.
export const tuneAnnScan = async (tx: Tx): Promise<void> => {
  iterativeScanSupported ??= probeIterativeScan();
  if (!(await iterativeScanSupported)) return;
  await tx.execute(sql`SET LOCAL hnsw.iterative_scan = 'relaxed_order'`);
};
