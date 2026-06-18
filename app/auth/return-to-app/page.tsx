"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

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
      <div className="flex min-h-dvh items-center justify-center px-5">
        <div className="flex w-full max-w-md flex-col items-start gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="font-content text-lg">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              The sign-in callback didn&apos;t include an authorization code.
              Try signing in again from the Reading List app.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      <div className="flex w-full max-w-md flex-col items-start gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-content text-lg">Signed in</h1>
          <p className="text-sm text-muted-foreground">
            {opened
              ? "Return to Reading List to continue. You can close this tab."
              : "Opening Reading List…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button nativeButton={false} render={<a href={deepLink} />}>
            Open Reading List
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReturnToApp;
