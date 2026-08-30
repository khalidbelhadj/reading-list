import { z } from "zod";

// Stored values keep their historical names (`density: "cozy"` is what the
// UI calls "preview") so existing rows parse without migration; unknown or
// removed values fall back via `.catch`.
const settingsSchema = z.object({
  theme: z.enum(["system", "light", "dark"]).catch("system"),
  density: z.enum(["compact", "cozy"]).catch("cozy"),
  groupBy: z.enum(["none", "day"]).catch("day"),
  sortBy: z
    .enum(["created-desc", "created-asc", "updated-desc", "updated-asc"])
    .catch("created-desc"),
  showRead: z.boolean().catch(false),
  // Desktop only: surface items that are open in a browser tab right now.
  showOpenTabs: z.boolean().catch(true),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  density: "cozy",
  groupBy: "day",
  sortBy: "created-desc",
  showRead: false,
  showOpenTabs: true,
};

// Let zod own the whole decision: every field already `.catch`es to its
// default, and the top-level `.catch` handles anything that isn't a usable
// object at all — null, an array (which is typeof "object", the exact hole a
// hand-rolled guard fell through), a legacy array-wrapped value, a string.
// Malformed input degrades to defaults instead of throwing and taking the
// whole action down.
const totalSettingsSchema = settingsSchema.catch(DEFAULT_SETTINGS);

export const parseSettings = (raw: unknown): Settings =>
  totalSettingsSchema.parse(raw);

export const settingsPatchSchema = settingsSchema.partial();
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

export const SETTINGS_STORAGE_KEY = "settings";
