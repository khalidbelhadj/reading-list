import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from "@tanstack/react-start";

// Server functions are same-origin RPC endpoints — reject cross-site calls.
// (Providing our own requestMiddleware replaces Start's built-in default, so
// the CSRF middleware must be listed explicitly.)
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// Port of the old Next.js middleware.ts + next.config.ts headers: CORS and
// auth for /api/*, session refresh + login redirect for pages, per-request
// CSP nonce, static security headers. The implementation is dynamically
// imported so supabase/env code never enters the client bundle.
const requestGuard = createMiddleware({ type: "request" }).server(
  async ({ request, pathname, next, handlerType }) => {
    const { guardRequest } = await import("@/lib/request-guard");
    return guardRequest({ request, pathname, handlerType, next });
  },
);

export const startInstance = createStart(() => ({
  // Route components stay client-rendered — parity with the previous
  // ssr:false SPA shell under Next. The root route opts into "data-only" SSR
  // so the settings prefetch still happens server-side.
  defaultSsr: false,
  requestMiddleware: [csrfMiddleware, requestGuard],
}));
