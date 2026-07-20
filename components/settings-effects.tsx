// Null-rendering watcher for the global side effects driven by settings:
// applies the theme class to <html> (tracking the system dark media query
// while theme="system") and toggles the full-width class. Mounted once in
// the root route; the theme bootstrap script handles first paint.
import React from "react";

import { useSettings } from "@/lib/use-settings";

type ThemeKey = "system" | "light" | "dark";

const applyTheme = (theme: ThemeKey) => {
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
};

export const SettingsEffects = () => {
  const { settings } = useSettings();
  const { theme, fullWidth } = settings;

  // Apply theme to <html>. Watches both settings.theme and the system dark
  // media query so "system" tracks OS changes without a manual toggle.
  React.useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  React.useEffect(() => {
    document.documentElement.classList.toggle("full-width", fullWidth);
  }, [fullWidth]);

  return null;
};
