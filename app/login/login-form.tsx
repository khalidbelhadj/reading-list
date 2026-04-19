"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useCallback, useState } from "react";

export const LoginForm = ({ error }: { error: boolean }) => {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }, []);

  return (
    <div className="flex w-full max-w-xs flex-col gap-4">
      <h1 className="text-lg font-medium">Reading List</h1>
      <Button onClick={handleGoogleLogin} disabled={loading}>
        {loading ? <Spinner className="mx-auto size-4" /> : "Sign in with Google"}
      </Button>
      {error && <p className="text-sm text-destructive">Authentication failed.</p>}
    </div>
  );
};
