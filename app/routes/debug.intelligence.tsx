import { createFileRoute, notFound } from "@tanstack/react-router";

import DebugIntelligencePage from "@/app/debug/intelligence/page";

// Dev-only window into the intelligence layer (extraction pipeline status,
// embeddings, semantic search).
export const Route = createFileRoute("/debug/intelligence")({
  beforeLoad: () => {
    if (process.env.NODE_ENV !== "development") throw notFound();
  },
  component: DebugIntelligencePage,
});
