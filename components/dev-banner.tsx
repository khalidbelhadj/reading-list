"use client";

import {
  IconChevronRight,
  IconCornerDownLeft,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useDevDevtools } from "@/lib/use-dev-devtools";
import { useIsElectron } from "@/lib/use-is-electron";
import { cn } from "@/lib/utils";

// Static list of navigable page routes (no API/route handlers). Dynamic routes
// expose a template so you can fill in the param. Keep in sync with app/.
const ROUTES: { href: string; title: string }[] = [
  { href: "/", title: "Reading list (home)" },
  { href: "/login", title: "Login" },
  { href: "/oauth/consent", title: "OAuth consent" },
  { href: "/auth/return-to-app", title: "Return to app" },
  { href: "/dev-error", title: "Dev error page" },
  { href: "/review/", title: "Review session (append :sessionId)" },
  { href: "/debug", title: "Debug index" },
  { href: "/debug/code-block", title: "Debug - Code block" },
  { href: "/debug/design-system", title: "Debug - Design system" },
  { href: "/debug/empty-states", title: "Debug - Empty states" },
  { href: "/debug/kbd", title: "Debug - Kbd styles" },
  { href: "/debug/review-count-animations", title: "Debug - Count animations" },
  { href: "/debug/review-dialogs", title: "Debug - Review dialogs" },
  { href: "/debug/review-summary-preview", title: "Debug - Review summary" },
  { href: "/debug/spinners", title: "Debug - Spinners" },
  { href: "/debug/suggested-cards", title: "Debug - Suggested cards" },
  { href: "/debug/toasts", title: "Debug - Toasts" },
  { href: "/debug/version", title: "Debug - Version & build info" },
];

const COLLAPSED_KEY = "dev-banner-collapsed";

const DevBannerInner = () => {
  const router = useRouter();
  const pathname = usePathname();
  const isElectron = useIsElectron();

  const [devtoolsEnabled, setDevtoolsEnabled] = useDevDevtools();
  const [collapsed, setCollapsed] = useState(false);
  const [host, setHost] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHost(window.location.host);
    setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return ROUTES;
    return ROUTES.filter(
      ({ href, title }) =>
        href.toLowerCase().includes(trimmed) ||
        title.toLowerCase().includes(trimmed),
    );
  }, [query]);

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
    },
    [router],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setOpen(true);
        setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        const target = filtered[activeIndex];
        // Allow typing an arbitrary path and pressing Enter to go straight there.
        const raw = query.trim();
        if (target) navigate(target.href);
        else if (raw) navigate(raw.startsWith("/") ? raw : `/${raw}`);
      } else if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    },
    [filtered, activeIndex, query, navigate],
  );

  // Reset the highlighted row whenever the result set changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Close the results popover on any outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (collapsed) {
    return (
      <Button
        variant="ghost"
        onClick={toggleCollapsed}
        aria-label="Show dev banner"
        className="fixed bottom-0 left-0 z-[9999] h-5 gap-1.5 rounded-none rounded-tr-sm bg-amber-400 px-2.5 font-mono text-[10px] leading-none font-semibold text-amber-950 shadow-[0_-1px_8px_rgba(0,0,0,0.12)] hover:bg-amber-300 hover:text-amber-950"
      >
        <span className="rounded-xs bg-amber-950 px-1 py-px text-amber-50">
          DEV
        </span>
        <IconChevronRight className="size-2.5" />
      </Button>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[9999] flex h-5 items-center gap-2.5 bg-amber-400 px-2.5 font-mono text-[10px] leading-none text-amber-950 shadow-[0_-1px_8px_rgba(0,0,0,0.12)] ring-1 ring-amber-500/40">
      <span className="flex items-center gap-1.5 font-semibold whitespace-nowrap">
        <span className="rounded-xs bg-amber-950 px-1 py-px text-amber-50">
          DEV
        </span>
        <span>{isElectron ? "Electron" : "Browser"}</span>
      </span>

      <span className="hidden whitespace-nowrap opacity-80 sm:inline">
        {host ? `http://${host}` : "…"}
      </span>

      <span className="hidden items-center gap-1 truncate opacity-80 md:flex">
        <IconChevronRight className="size-2.5 shrink-0" />
        <span className="truncate">{pathname}</span>
      </span>

      <label className="ml-auto flex shrink-0 cursor-pointer items-center gap-1.5 font-semibold whitespace-nowrap select-none">
        <span>RQ Devtools</span>
        <Switch
          size="sm"
          checked={devtoolsEnabled}
          onCheckedChange={setDevtoolsEnabled}
          className="data-checked:bg-amber-950"
        />
      </label>

      <div ref={containerRef} className="relative w-64 max-w-[45vw]">
        {open && filtered.length > 0 && (
          // Anchored to the input's right edge but free to grow leftward
          // (w-max) so full route titles are visible without truncation.
          <ul className="absolute right-0 bottom-full mb-1.5 max-h-72 w-max max-w-[80vw] min-w-full overflow-y-auto rounded-md bg-popover py-0.5 text-popover-foreground shadow-lg ring-1 ring-black/10">
            {filtered.map((route, index) => (
              <li key={route.href}>
                <Button
                  variant="ghost"
                  // onMouseDown (not onClick) fires before the input's blur,
                  // so the navigation isn't cancelled by the popover closing.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    navigate(route.href);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    "h-auto w-full justify-between gap-2 rounded-none px-2 py-0.5 text-left text-[10px] leading-none font-normal",
                    index === activeIndex && "bg-accent text-accent-foreground",
                  )}
                >
                  <span className="text-foreground">{route.title}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {route.href}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-1.5 rounded bg-amber-950/10 px-1.5 py-0.5 ring-1 ring-amber-950/20 focus-within:ring-amber-950/50">
          <IconSearch className="size-2.5 shrink-0 opacity-70" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Go to route…"
            spellCheck={false}
            autoComplete="off"
            className="w-full bg-transparent text-[10px] leading-none text-amber-950 outline-none placeholder:text-amber-950/50"
          />
          <IconCornerDownLeft className="size-2.5 shrink-0 opacity-50" />
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon-xs"
        onClick={toggleCollapsed}
        aria-label="Hide dev banner"
        className="size-4 shrink-0 text-amber-950 hover:bg-amber-950/10 hover:text-amber-950"
      >
        <IconX className="size-3" />
      </Button>
    </div>
  );
};

// Dev-only, and opt-out via `NEXT_PUBLIC_DEV_BANNER=off` (see the `dev:nobanner`
// script). Both guards are literal compile-time constants, so the whole
// component tree-shakes out of production builds.
export const DevBanner = () => {
  if (process.env.NODE_ENV !== "development") return null;
  if (process.env.NEXT_PUBLIC_DEV_BANNER === "off") return null;
  return <DevBannerInner />;
};
