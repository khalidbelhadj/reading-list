"use client";

import dynamic from "next/dynamic";

// The TanStack router reads window/history at module load (browser history) and
// has no meaningful server render — the Next catch-all already streamed the
// shell. ssr:false keeps the whole route tree out of the server bundle and out
// of hydration, so there's no SSR/client route mismatch.
const RouterRoot = dynamic(
  () => import("./route-tree").then((m) => m.RouterRoot),
  { ssr: false },
);

export const AppRouter = () => <RouterRoot />;
