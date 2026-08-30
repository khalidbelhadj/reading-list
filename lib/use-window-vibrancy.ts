import React from "react";

import { isElectron } from "@/lib/platform";
import { useSettings } from "@/lib/use-settings";

// Turn the desktop window translucent for the life of the calling layout:
// flags the document (`html.app-shell`, which clears the body background)
// and asks the main process for macOS vibrancy. Both are undone on unmount.
// No-op on the web.
//
// The appearance pin must come from the theme SETTING, never the resolved
// `.dark` class: the vibrancy material follows nativeTheme.themeSource, and
// in Electron so does matchMedia(prefers-color-scheme) — the very thing the
// "system" theme resolves through. Pinning the resolved value would freeze
// matchMedia at the previous theme and deadlock "system" (switching dark →
// system would stay dark). A forced light/dark pins the material to match;
// "system" releases the pin so the OS drives the material and the page
// together.
export const useWindowVibrancy = () => {
  const { settings } = useSettings();
  const theme = settings.theme;

  React.useEffect(() => {
    if (!isElectron()) return;
    const root = document.documentElement;
    root.classList.add("app-shell");
    return () => {
      root.classList.remove("app-shell");
      void window.readingList?.setVibrancy(false);
    };
  }, []);

  React.useEffect(() => {
    if (!isElectron()) return;
    void window.readingList?.setVibrancy(
      true,
      theme === "system" ? undefined : theme,
    );
  }, [theme]);
};
