import { useCallback, useEffect, useState } from "react";
import { IconSun, IconMoon } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

export const ThemeToggle = () => {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("theme");
    if (
      stored === "dark" ||
      (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      setDark(true);
      document.documentElement.classList.add("dark");
    }

    // Apply a system-theme change only when the user hasn't pinned a manual
    // preference. Shared by the browser matchMedia and Electron nativeTheme
    // paths below.
    const applySystem = (matches: boolean) => {
      if (localStorage.getItem("theme")) return;
      setDark(matches);
      document.documentElement.classList.toggle("dark", matches);
    };

    // Browser: matchMedia.change.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const mqHandler = (e: MediaQueryListEvent) => applySystem(e.matches);
    mq.addEventListener("change", mqHandler);

    // Electron: matchMedia.change is unreliable when macOS appearance flips
    // mid-session, so subscribe to the authoritative nativeTheme signal and
    // re-sync the current value once on mount.
    let unsubscribeElectron: (() => void) | undefined;
    const bridge = window.readingList;
    // Feature-detect: an older installed desktop shell may expose `readingList`
    // without the nativeTheme methods added in a later release.
    if (
      bridge &&
      typeof bridge.onNativeThemeChange === "function" &&
      typeof bridge.getNativeTheme === "function"
    ) {
      unsubscribeElectron = bridge.onNativeThemeChange((d) => applySystem(d));
      bridge
        .getNativeTheme()
        .then((d) => applySystem(d))
        .catch(() => {});
    }

    return () => {
      mq.removeEventListener("change", mqHandler);
      unsubscribeElectron?.();
    };
  }, []);

  const toggle = useCallback(() => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  if (!mounted) return null;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className="text-muted-foreground"
          />
        }
      >
        {dark ? <IconSun /> : <IconMoon />}
      </TooltipTrigger>
      <TooltipContent>{dark ? "Light mode" : "Dark mode"}</TooltipContent>
    </Tooltip>
  );
};
