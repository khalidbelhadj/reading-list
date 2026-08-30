import { useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";

import { getSettings, updateSettings } from "@/app/actions";
import {
  DEFAULT_SETTINGS,
  parseSettings,
  type Settings,
  SETTINGS_STORAGE_KEY,
  type SettingsPatch,
} from "@/lib/settings";

const SETTINGS_QUERY_KEY = ["settings"] as const;

const writeCache = (settings: Settings) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {}
};

// Read settings from localStorage, migrating from the legacy per-key entries
// on first run. Synchronous so React Query has a value on the first client
// render and no consumer ever sees a loading state.
const readCache = (): Settings => {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) return parseSettings(JSON.parse(raw));

    const legacy: SettingsPatch = {};
    const theme = localStorage.getItem("theme");
    if (theme === "light" || theme === "dark") legacy.theme = theme;
    const density = localStorage.getItem("view-mode");
    if (density === "compact" || density === "cozy") legacy.density = density;
    const groupBy = localStorage.getItem("groupBy");
    if (groupBy === "none" || groupBy === "day") legacy.groupBy = groupBy;
    const showRead = localStorage.getItem("showRead");
    if (showRead === "true" || showRead === "false") {
      legacy.showRead = showRead === "true";
    }

    const parsed = parseSettings(legacy);
    writeCache(parsed);
    return parsed;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const useSettings = () => {
  const queryClient = useQueryClient();

  const { data } = useQuery<Settings>({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: async () => {
      const fromServer = await getSettings();
      writeCache(fromServer);
      return fromServer;
    },
    initialData: readCache,
    // initialData gives us a synchronous value (no loading state). Server
    // values arrive via the root route's SSR loader prefetch on every full
    // page load, so no per-mount refetch is needed — "always" here made
    // every navigation re-run getSettings (~140ms + a DB transaction each).
    // Trade-off: settings changed on another device mid-session apply on the
    // next page load rather than the next navigation.
    staleTime: Infinity,
  });

  const settings = data ?? DEFAULT_SETTINGS;

  const pendingRef = React.useRef<SettingsPatch>({});
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const patch = pendingRef.current;
    pendingRef.current = {};
    if (Object.keys(patch).length === 0) return;
    void updateSettings(patch).catch(() => {});
  }, []);

  React.useEffect(() => () => flush(), [flush]);

  const setSetting = React.useCallback(
    <K extends keyof Settings>(
      key: K,
      next: Settings[K] | ((prev: Settings[K]) => Settings[K]),
    ) => {
      let resolved!: Settings[K];
      queryClient.setQueryData<Settings>(SETTINGS_QUERY_KEY, (prev) => {
        const current = prev ?? DEFAULT_SETTINGS;
        resolved =
          typeof next === "function"
            ? (next as (p: Settings[K]) => Settings[K])(current[key])
            : next;
        const updated = { ...current, [key]: resolved };
        writeCache(updated);
        return updated;
      });
      pendingRef.current = { ...pendingRef.current, [key]: resolved };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, 400);
    },
    [queryClient, flush],
  );

  return { settings, setSetting, flushSettings: flush };
};
