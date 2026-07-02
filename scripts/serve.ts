#!/usr/bin/env bun
/**
 * Production server for the built app (`bun run build` first).
 *
 * Serves static client assets from dist/client and hands everything else to
 * the TanStack Start fetch handler in dist/server. Kept as a tiny Bun server
 * instead of `vite preview` because the preview plugin expects a
 * "type": "module" package (it looks for dist/server/server.js), which this
 * package can't be while the Electron build emits CommonJS.
 *
 * Vercel deploys don't use this — the platform builds and hosts the same
 * dist output through its TanStack Start preset.
 */
import { join, normalize } from "node:path";

import entry from "../dist/server/server.mjs";

const clientDir = join(import.meta.dir, "..", "dist", "client");
const port = Number(process.env.PORT ?? 3000);

Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/") {
      // Resolve inside dist/client only — reject anything that normalizes
      // outside it (e.g. ../ traversal).
      const candidate = normalize(
        join(clientDir, decodeURIComponent(url.pathname)),
      );
      if (candidate.startsWith(clientDir)) {
        const file = Bun.file(candidate);
        if (await file.exists()) {
          return new Response(file, {
            headers: url.pathname.startsWith("/assets/")
              ? { "Cache-Control": "public, max-age=31536000, immutable" }
              : {},
          });
        }
      }
    }
    return entry.fetch(request);
  },
});

console.log(`[serve] listening on http://localhost:${port}`);
