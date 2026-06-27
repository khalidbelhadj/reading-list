"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { NonIdealState } from "@/components/ui/non-ideal-state";

const ReturnToApp = () => {
  const params = useSearchParams();
  const [opened, setOpened] = useState(false);

  const deepLink = useMemo(() => {
    const code = params.get("code");
    if (!code) return null;
    const next = params.get("next") ?? "/";
    const url = new URL("readinglist://auth/complete");
    url.searchParams.set("code", code);
    url.searchParams.set("next", next);
    return url.toString();
  }, [params]);

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
        <Button nativeButton={false} render={<a href={deepLink} />}>
          Open Reading List
        </Button>
      }
    />
  );
};

export default ReturnToApp;
