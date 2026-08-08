// The pause switch for the indexer.
//
// Persisted rather than in-process: the loop runs wherever the server runs, so
// a pause only one process knew about would not be a pause. There is no
// companion "cancel" — a pass is a handful of items and finishes in seconds,
// so pausing is the only control that needs to exist.
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { appSettings } from "@/db/schema";

const PIPELINE_SETTINGS_ID = "pipeline";

// Short enough that a pause takes effect while the user is still looking at
// the button, long enough that the claim path isn't a read-per-item.
const CACHE_TTL_MS = 3_000;

let cached: { paused: boolean; at: number } | null = null;

export const isPaused = async (): Promise<boolean> => {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.paused;
  let paused = false;
  try {
    const [row] = await db
      .select({ data: appSettings.data })
      .from(appSettings)
      .where(eq(appSettings.id, PIPELINE_SETTINGS_ID))
      .limit(1);
    paused = (row?.data as { paused?: boolean } | undefined)?.paused === true;
  } catch (error) {
    // A missing table must not wedge the pipeline shut — an unreadable switch
    // means "not paused", the same as a fresh install.
    console.warn("[extract] could not read pipeline control", error);
  }
  cached = { paused, at: Date.now() };
  return paused;
};

export const setPaused = async (paused: boolean): Promise<void> => {
  const now = new Date().toISOString();
  await db
    .insert(appSettings)
    .values({ id: PIPELINE_SETTINGS_ID, data: { paused }, updatedAt: now })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: { data: { paused }, updatedAt: now },
    });
  // Write through rather than invalidate: the click that paused the indexer
  // should not be followed by up to CACHE_TTL_MS of it still running here.
  cached = { paused, at: Date.now() };
};
