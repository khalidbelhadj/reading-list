import { z } from "zod";

// The reading surface used to own a persisted width (`readingPanel`), back
// when it was a third column docked to the right. It now stands in for the
// items list and takes its size from the item panel's own width, so there is
// nothing left to remember here — stored values for the old key are dropped
// on the next write, like the `readerNotes` key before it.
const settingsSchema = z.object({
  theme: z.enum(["system", "light", "dark"]).catch("system"),
  density: z.enum(["compact", "cozy"]).catch("cozy"),
  fullWidth: z.boolean().catch(true),
  groupBy: z.enum(["none", "tag", "day"]).catch("day"),
  sortBy: z
    .enum(["created-desc", "created-asc", "updated-desc", "updated-asc"])
    .catch("created-desc"),
  showRead: z.boolean().catch(false),
  showSuggestions: z.boolean().catch(false),
  // Desktop only: surface items that are open in a browser tab right now.
  showOpenTabs: z.boolean().catch(true),
  tagsOpen: z.boolean().catch(false),
  reviewsInNewWindow: z.boolean().catch(true),
  // When false, a plain row click only selects the row and the panel opens on
  // double-click instead.
  openOnSingleClick: z.boolean().catch(true),
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
  showOpenTabs: true,
  tagsOpen: false,
  reviewsInNewWindow: true,
  openOnSingleClick: true,
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
