import { z } from "zod";

// Reading panel state. The reading surface slides in on the right of the
// main layout; notes are the regular item panel, docked to its left. The
// panel width is remembered so the panel never asks twice. (Values stored
// under the old `readerNotes` key, and extra keys from the removed
// floating-notes mode, reset harmlessly via the .catch defaults.)
const READING_PANEL_DEFAULTS = {
  panelWidth: 640,
};

const readingPanelSchema = z
  .object({
    panelWidth: z.number().catch(READING_PANEL_DEFAULTS.panelWidth),
  })
  .catch(READING_PANEL_DEFAULTS);

export const settingsSchema = z.object({
  theme: z.enum(["system", "light", "dark"]).catch("system"),
  density: z.enum(["compact", "cozy"]).catch("cozy"),
  fullWidth: z.boolean().catch(true),
  groupBy: z.enum(["none", "tag", "day"]).catch("day"),
  sortBy: z
    .enum(["created-desc", "created-asc", "updated-desc", "updated-asc"])
    .catch("created-desc"),
  showRead: z.boolean().catch(false),
  showSuggestions: z.boolean().catch(false),
  tagsOpen: z.boolean().catch(false),
  reviewsInNewWindow: z.boolean().catch(true),
  readingPanel: readingPanelSchema,
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  density: "cozy",
  fullWidth: true,
  groupBy: "day",
  sortBy: "created-desc",
  showRead: false,
  showSuggestions: false,
  tagsOpen: false,
  reviewsInNewWindow: true,
  readingPanel: readingPanelSchema.parse(undefined),
};

export const parseSettings = (raw: unknown): Settings => {
  if (!raw || typeof raw !== "object") return DEFAULT_SETTINGS;
  return settingsSchema.parse(raw);
};

export const settingsPatchSchema = settingsSchema.partial();
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

export const SETTINGS_STORAGE_KEY = "settings";
