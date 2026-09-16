import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/system/button";
import { NonIdealState } from "@/components/system/non-ideal-state";

const ReturnToApp = () => {
  const { code, next, scheme } = Route.useSearch();
  const [opened, setOpened] = useState(false);

  // The desktop app's own url scheme (a dev build has its own), on the
  // callback path every desktop client shares.
  const deepLink = useMemo(() => {
    if (!code) return null;
    const url = new URL(`${scheme ?? "readinglist"}://auth/callback`);
    url.searchParams.set("code", code);
    url.searchParams.set("next", next ?? "/");
    return url.toString();
  }, [code, next, scheme]);

  useEffect(() => {
    if (!deepLink) return;
    // Browsers honor a protocol navigation initiated from page JS even when
    // they would block the same redirect coming from an HTTP Location header.
    window.location.href = deepLink;
    setOpened(true);
  }, [deepLink]);

  if (!deepLink) {
    return (
      <NonIdealState
        fullPage
        titleAs="h1"
        title="Something went wrong"
        description="The sign-in callback didn't include an authorization code. Try signing in again from the Reading List app."
      />
    );
  }

  return (
    <NonIdealState
      fullPage
      titleAs="h1"
      title="Signed in"
      description={
        opened
          ? "Return to Reading List to continue. You can close this tab."
          : "Opening Reading List…"
      }
      actions={
        <Button
          variant="primary"
          nativeButton={false}
          render={<a href={deepLink} />}
        >
          Open Reading List
        </Button>
      }
    />
  );
};

export const Route = createFileRoute("/auth/return-to-app")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { code?: string; next?: string; scheme?: string } => ({
    code: typeof search.code === "string" ? search.code : undefined,
    next: typeof search.next === "string" ? search.next : undefined,
    // Only the app's own schemes are ever opened from this page.
    scheme:
      typeof search.scheme === "string" &&
      /^readinglist(-mac)?(-dev)?$/.test(search.scheme)
        ? search.scheme
        : undefined,
  }),
  component: ReturnToApp,
});
