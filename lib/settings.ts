import { z } from "zod";

export const settingsSchema = z.object({
  theme: z.enum(["system", "light", "dark"]).catch("system"),
  density: z.enum(["compact", "cozy"]).catch("cozy"),
  fullWidth: z.boolean().catch(false),
  groupBy: z.enum(["none", "tag", "day"]).catch("day"),
  sortBy: z
    .enum(["created-desc", "created-asc", "updated-desc", "updated-asc"])
    .catch("created-desc"),
  showRead: z.boolean().catch(false),
  tagsOpen: z.boolean().catch(false),
  activeTab: z.enum(["reading-list", "cards"]).catch("reading-list"),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  density: "cozy",
  fullWidth: false,
  groupBy: "day",
  sortBy: "created-desc",
  showRead: false,
  tagsOpen: false,
  activeTab: "reading-list",
};

export const parseSettings = (raw: unknown): Settings => {
  if (!raw || typeof raw !== "object") return DEFAULT_SETTINGS;
  return settingsSchema.parse(raw);
};

export const settingsPatchSchema = settingsSchema.partial();
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

export const SETTINGS_STORAGE_KEY = "settings";
