import { createServerFn } from "@tanstack/react-start";

import type * as impl from "./actions-storage.server";

// RPC layer over actions-storage.server.ts — same pattern as app/actions.

const requestImageUploadFn = createServerFn({ method: "POST" })
  .validator((args: Parameters<typeof impl.requestImageUpload>) => args)
  .handler(({ data }) =>
    import("./actions-storage.server").then((m) =>
      m.requestImageUpload(...data),
    ),
  );
export const requestImageUpload: typeof impl.requestImageUpload = (...args) =>
  requestImageUploadFn({ data: args });
