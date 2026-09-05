import { z } from "zod";

import { DURATIONS, OPERATIONS } from "@/lib/mental-maths";

// How many Mental maths runs the blob keeps; the oldest fall off.
export const MATHS_RUNS_LIMIT = 300;

const mathsRunSchema = z.object({
  at: z.string(),
  settings: z.object({
    digits: z.number().int().min(1).max(4),
    operations: z.array(z.enum(OPERATIONS)),
    durationSeconds: z.union([
      z.literal(DURATIONS[0]),
      z.literal(DURATIONS[1]),
      z.literal(DURATIONS[2]),
      z.literal(DURATIONS[3]),
    ]),
  }),
  solved: z.number().int().min(0),
  attempts: z.number().int().min(0),
  averageMs: z.number().min(0),
});

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
  // The UI sounds (lib/sounds.ts).
  sounds: z.boolean().catch(true),
  // The Mental maths place in the sidebar.
  showMentalMaths: z.boolean().catch(true),
  // Finished Mental maths runs, oldest first (components/shell/mental-maths-pane.tsx).
  mathsRuns: z.array(mathsRunSchema).max(MATHS_RUNS_LIMIT).catch([]),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  density: "cozy",
  groupBy: "day",
  sortBy: "created-desc",
  showRead: false,
  showOpenTabs: true,
  sounds: true,
  showMentalMaths: true,
  mathsRuns: [],
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
