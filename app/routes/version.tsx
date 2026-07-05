import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import VersionPage from "@/app/version/page";

const getVersionInfoFn = createServerFn({ method: "GET" }).handler(() =>
  import("@/lib/version").then((m) => m.getVersionInfo()),
);

const VersionRoute = () => {
  const info = Route.useLoaderData();
  return <VersionPage info={info} />;
};

// Build/deploy info. Auth-gated like any other page (the request guard
// redirects logged-out visitors to /login); the unauthenticated,
// public-safe variant is /version.json.
export const Route = createFileRoute("/version")({
  ssr: "data-only",
  loader: () => getVersionInfoFn(),
  component: VersionRoute,
});
