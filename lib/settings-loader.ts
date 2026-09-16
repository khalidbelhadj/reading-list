import { createIsomorphicFn } from "@tanstack/react-start";

import { api } from "@/lib/api/client";
import type { Settings } from "@/lib/settings";

// The root route prefetches settings on the server for the first render and
// on the client afterwards. Server side calls the implementation directly
// (the server would only be calling itself over HTTP); the client goes
// through the API. createIsomorphicFn strips the server branch from the
// client bundle.
export const loadSettings = createIsomorphicFn()
  .server((): Promise<Settings> =>
    import("@/app/actions/settings").then((m) => m.getSettings()),
  )
  .client((): Promise<Settings> => api("getSettings"));
