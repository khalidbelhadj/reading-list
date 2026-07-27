import { type FormEvent, useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import Image from "@/components/ui/image";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";

const IS_LOCAL_BACKEND = /localhost|127\.0\.0\.1/.test(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
);

export const LoginForm = ({
  error,
  redirectTo,
}: {
  error: boolean;
  redirectTo?: string;
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [electronError, setElectronError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isEmailLoading, setIsEmailLoading] = useState(false);

  const handleEmailLogin = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setIsEmailLoading(true);
      setEmailError(null);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setIsEmailLoading(false);
        setEmailError(error.message);
        return;
      }
      window.location.href = redirectTo ?? "/";
    },
    [email, password, redirectTo],
  );

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
      <div className="flex w-full items-center gap-2">
        <Button
          variant="outline"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full"
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
      {IS_LOCAL_BACKEND && (
        <>
          <div className="flex w-full items-center gap-4 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span>or log in with email</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <form
            onSubmit={handleEmailLogin}
            className="flex w-full flex-col gap-2"
          >
            <label className="flex flex-col gap-1 text-sm font-medium">
              Email (required)
              <Input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                required
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Password
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                required
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <Button
              type="submit"
              variant="outline"
              disabled={isEmailLoading || !email || !password}
              className="w-full"
            >
              {isEmailLoading ? <Spinner className="size-3.5" /> : "Continue"}
            </Button>
            {emailError && (
              <p className="text-xs text-destructive">{emailError}</p>
            )}
          </form>
        </>
      )}
      {(error || electronError) && (
        <p className="text-xs text-destructive">
          {electronError ?? "Authentication failed."}
        </p>
      )}
    </div>
  );
};
