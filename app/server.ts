// Custom server entry: identical to Start's default, plus the MOCK_USER_ID
// environment guard, which must trip at startup — before any request is
// served (it used to ride along with middleware.ts) — and the indexer loop.
import "@/lib/env";

import defaultEntry from "@tanstack/react-start/server-entry";

import { startIndexer } from "@/lib/extract/worker.server";

// The indexer is a background loop owned by the server process, started here
// because this is the only place that runs once per process. Previously
// indexing only advanced when a request happened to trigger it, which meant a
// queue that drained at the speed of someone opening the app.
startIndexer();

export default defaultEntry;
