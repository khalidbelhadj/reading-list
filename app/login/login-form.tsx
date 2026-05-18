"use client";

import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useCallback, useState } from "react";

export const LoginForm = ({
  error,
  redirectTo,
}: {
  error: boolean;
  redirectTo?: string;
}) => {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const callback = new URL("/auth/callback", window.location.origin);
    if (redirectTo) callback.searchParams.set("next", redirectTo);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });
  }, [redirectTo]);

  return (
    <div className="flex flex-col items-start gap-4 max-w-md w-full">
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
          disabled={loading}
        >
          {loading ? (
            <Spinner className="size-3.5" />
          ) : (
            <Image
              src="/google.svg"
              alt=""
              width={14}
              height={14}
              className="size-3.5"
            />
          )}
          Continue with Google
        </Button>
      </div>
      {error && (
        <p className="text-xs text-destructive">Authentication failed.</p>
      )}
    </div>
  );
};
