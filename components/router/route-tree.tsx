"use client";

import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";

import { PanelLayout } from "@/components/panel-layout";
import { PageEmptyState } from "@/components/items-list/page-empty-state";
import { SecondaryPage } from "@/components/items-list/secondary-page";
import { ReviewSession } from "@/components/review/review-session";

import { createNextCompatHistory } from "./next-compat-history";

// Code-based route tree (no file-based codegen — that needs a Vite plugin we
// don't run under Next). The whole tree is client-only: it mounts inside a
// Next catch-all route via a dynamic ssr:false import, so none of this runs on
// the server. The browser history keeps the address bar in sync, so deep links
// and refreshes resolve server-side to the same shell and re-enter here.

const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: () => (
    <SecondaryPage>
      <PageEmptyState message="This page doesn't exist." />
    </SecondaryPage>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: PanelLayout,
});

const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/review",
  component: () => (
    <SecondaryPage>
      <PageEmptyState message="Your review activity and stats will live here." />
    </SecondaryPage>
  ),
});

const reviewSessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/review/$sessionId",
  component: function ReviewSessionRoute() {
    const { sessionId } = reviewSessionRoute.useParams();
    return <ReviewSession sessionId={sessionId} />;
  },
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: () => (
    <SecondaryPage>
      <PageEmptyState message="App preferences will live here." />
    </SecondaryPage>
  ),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  reviewRoute,
  reviewSessionRoute,
  settingsRoute,
]);

export const router = createRouter({
  routeTree,
  history: createNextCompatHistory(),
  // React Query owns all data; the router only swaps panels. Scroll restoration
  // is handled per-panel, so leave the router's default off.
  defaultPreload: false,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Mounted by app-router.tsx via dynamic ssr:false, so this only renders on the
// client where window/history exist.
export const RouterRoot = () => <RouterProvider router={router} />;
