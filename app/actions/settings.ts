"use server";

import { eq, sql } from "drizzle-orm";

import { withUser } from "@/db";
import { userSettings } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { safeAction } from "@/lib/safe-action";
import {
  parseSettings,
  settingsPatchSchema,
  type Settings,
  type SettingsPatch,
} from "@/lib/settings";

export const getSettings = safeAction(
  async function getSettings(): Promise<Settings> {
    const userId = await getCurrentUserId();
    return withUser(userId, async (tx) => {
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
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();
  await withUser(userId, async (tx) => {
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
