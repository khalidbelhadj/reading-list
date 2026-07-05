import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { getGlobalStartContext } from "@tanstack/react-start";

import { makeQueryClient } from "@/lib/query-client";

import { routeTree } from "./routeTree.gen";

// Called once per browser session on the client, and once per request on the
// server (SSR). React Query owns all data; the router only swaps panels.
export const getRouter = () => {
  // The request middleware (app/start.ts → lib/request-guard.ts) generates a
  // per-request CSP nonce; handing it to the router makes every SSR-emitted
  // <script> tag carry it, which the strict CSP requires. Server-side only —
  // on the client there is no start context.
  const cspNonce =
    typeof window === "undefined"
      ? (getGlobalStartContext() as { cspNonce?: string } | undefined)?.cspNonce
      : undefined;

  const queryClient = makeQueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: false,
    ...(cspNonce ? { ssr: { nonce: cspNonce } } : {}),
  });
  setupRouterSsrQueryIntegration({ router, queryClient });
  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
