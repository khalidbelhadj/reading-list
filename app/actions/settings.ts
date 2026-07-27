// Server-only implementations — see ./index.ts for the RPC layer.
import { eq, sql } from "drizzle-orm";

import { userSettings } from "@/db/schema";
import { withCurrentUser } from "@/lib/db-helpers.server";
import { safeAction } from "@/lib/safe-action";
import {
  parseSettings,
  type Settings,
  type SettingsPatch,
  settingsPatchSchema,
} from "@/lib/settings";

export const getSettings = safeAction(
  async function getSettings(): Promise<Settings> {
    return withCurrentUser(async (tx, userId) => {
      const [row] = await tx
        .select({ data: userSettings.data })
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);
      return parseSettings(row?.data);
    });
  },
  "Could not load settings.",
);

export const updateSettings = safeAction(async function updateSettings(
  patch: SettingsPatch,
) {
  const parsed = settingsPatchSchema.parse(patch);
  const keys = Object.keys(parsed);
  if (keys.length === 0) return;
  const now = new Date().toISOString();
  await withCurrentUser(async (tx, userId) => {
    await tx
      .insert(userSettings)
      .values({ userId, data: parsed, updatedAt: now })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          data: sql`${userSettings.data} || ${JSON.stringify(parsed)}::jsonb`,
          updatedAt: now,
        },
      });
  });
}, "Could not save settings.");
