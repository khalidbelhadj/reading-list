import { createServerFn } from "@tanstack/react-start";

import type * as impl from "./queries.server";

// RPC layer over lib/queries.server.ts — same pattern as app/actions/index.ts.

const fetchItemPreviewsFn = createServerFn({ method: "POST" }).handler(() =>
  import("./queries.server").then((m) => m.fetchItemPreviews()),
);
export const fetchItemPreviews: typeof impl.fetchItemPreviews = () =>
  fetchItemPreviewsFn();

const fetchItemsFn = createServerFn({ method: "POST" }).handler(() =>
  import("./queries.server").then((m) => m.fetchItems()),
);
export const fetchItems: typeof impl.fetchItems = () => fetchItemsFn();
