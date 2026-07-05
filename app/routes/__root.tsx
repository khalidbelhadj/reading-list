import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import React from "react";

import { getSettings } from "@/app/actions";
import { AuthWatcher } from "@/components/auth-watcher";
import { DeepLinkItemWatcher } from "@/components/deep-link-item-watcher";
import { DevBanner } from "@/components/dev-banner";
import { ElectronZoomWatcher } from "@/components/electron-zoom-watcher";
import { ItemsSyncWatcher } from "@/components/items-sync-watcher";
import { LocalSyncWatcher } from "@/components/local-sync-watcher";
import { WindowMessageWatcher } from "@/components/window-message-watcher";
import { NotFound } from "@/components/not-found";
import { RouteError } from "@/components/route-error";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TOOLTIP_DELAY_MS } from "@/components/ui/tooltip-config";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme-bootstrap";
import { useDevDevtools } from "@/lib/use-dev-devtools";

// Side-effect import (not ?url): in dev Vite owns the stylesheet through the
// module graph (the SSR-injected dev-styles link is removed after hydration,
// so a bare <link> would go dead after the first client-side navigation); in
// prod the build collects it into the route CSS assets automatically.
import "../globals.css";

const RootDocument = ({ children }: { children: React.ReactNode }) => (
  <html lang="en" suppressHydrationWarning>
    <head>
      <HeadContent />
    </head>
    <body className="bg-background font-sans text-foreground">
      {children}
      <Scripts />
    </body>
  </html>
);

const DevQueryDevtools = () => {
  const [devtoolsEnabled] = useDevDevtools();
  if (process.env.NODE_ENV !== "development" || !devtoolsEnabled) return null;
  return <ReactQueryDevtools initialIsOpen={false} />;
};

const RootComponent = () => {
  // One-shot cleanup for the removed Prompts feature's localStorage entry.
  // Safe to remove once it has shipped to all clients.
  React.useEffect(() => {
    try {
      localStorage.removeItem("copy-prompts");
    } catch {}
  }, []);

  return (
    <>
      <AuthWatcher />
      <DeepLinkItemWatcher />
      <WindowMessageWatcher />
      <ElectronZoomWatcher />
      <ItemsSyncWatcher />
      <LocalSyncWatcher />
      <TooltipProvider delay={TOOLTIP_DELAY_MS}>
        <Outlet />
      </TooltipProvider>
      <Toaster />
      <DevBanner />
      <DevQueryDevtools />
    </>
  );
};

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    // "data-only": the loader (settings prefetch) runs server-side on first
    // load, but the component tree renders client-only like the rest of the
    // app. Child routes inherit defaultSsr: false from the router.
    ssr: "data-only",
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "Reading List" },
      ],
      links: [{ rel: "icon", href: "/favicon.ico" }],
      scripts: [
        // Connects to the standalone React DevTools (`bun x react-devtools`)
        // listening on localhost:8097. Dev-only so it never ships to prod; a
        // synchronous head script loads before React (the body entry is a
        // deferred module script), which is the ordering the hook needs. The
        // framework stamps the CSP nonce on every head asset, so this passes
        // the strict CSP. When DevTools isn't running the request fails fast
        // and is harmless.
        ...(process.env.NODE_ENV === "development"
          ? [{ src: "http://localhost:8097" }]
          : []),
        // Applies theme + full-width from localStorage before paint, so
        // hydration never flashes the wrong theme.
        { children: THEME_BOOTSTRAP_SCRIPT },
      ],
    }),
    // Prefetch settings server-side so density/groupBy/etc. seed the React
    // Query cache at hydration — no skeleton flash once the client mounts.
    loader: ({ context }) =>
      context.queryClient.prefetchQuery({
        queryKey: ["settings"],
        queryFn: () => getSettings(),
      }),
    shellComponent: RootDocument,
    component: RootComponent,
    // Error/404 pages use the big fullPage NonIdealState layout (title,
    // faint description, action buttons) — the same design the old Next
    // error.tsx/not-found.tsx pages had.
    errorComponent: RouteError,
    notFoundComponent: NotFound,
  },
);
