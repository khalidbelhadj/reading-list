"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

export const LoginForm = ({
  error,
  redirectTo,
}: {
  error: boolean;
  redirectTo?: string;
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [electronError, setElectronError] = useState<string | null>(null);

  const handleGoogleLogin = useCallback(async () => {
    setIsLoading(true);
    setElectronError(null);
    const supabase = createClient();
    const callback = new URL("/auth/callback", window.location.origin);
    if (redirectTo) callback.searchParams.set("next", redirectTo);

    const isElectron = window.readingList?.platform === "electron";

    if (isElectron && window.readingList) {
      // Get the OAuth URL but don't navigate the Electron renderer to it —
      // Google blocks embedded browser flows. The /auth/callback route detects
      // ?from=electron and bounces back to a readinglist:// deep link so the
      // renderer (which already owns the PKCE verifier) can complete the
      // exchange itself.
      callback.searchParams.set("from", "electron");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callback.toString(),
          skipBrowserRedirect: true,
        },
      });
      if (error || !data.url) {
        setIsLoading(false);
        setElectronError(error?.message ?? "Could not start sign-in");
        return;
      }
      await window.readingList.openExternal(data.url);
      // Loading state remains until the deep-link arrives and the
      // exchange-handler completes (see useEffect below).
      return;
    }

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });
  }, [redirectTo]);

  const handleCancel = useCallback(() => {
    setIsLoading(false);
    setElectronError(null);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.readingList) return;
    return window.readingList.onDeepLink(async (url) => {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return;
      }
      // Expect readinglist://auth/complete?code=...&next=...
      if (parsed.hostname !== "auth" || parsed.pathname !== "/complete") return;
      const code = parsed.searchParams.get("code");
      const next = parsed.searchParams.get("next") ?? "/";
      if (!code) return;
      const supabase = createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setIsLoading(false);
        setElectronError(error.message);
        return;
      }
      window.location.href = next;
    });
  }, []);

  return (
    <div className="flex w-full max-w-md flex-col items-start gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-content text-lg">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to save items, sync across your devices, and review
          flashcards.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={handleGoogleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <Spinner className="size-3.5" />
          ) : (
            <Image
              src="/google.svg"
              alt=""
              width={14}
              height={14}
              unoptimized
              className="size-3.5"
            />
          )}
          Continue with Google
        </Button>
        {isLoading && (
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
        )}
      </div>
      {(error || electronError) && (
        <p className="text-xs text-destructive">
          {electronError ?? "Authentication failed."}
        </p>
      )}
    </div>
  );
};
