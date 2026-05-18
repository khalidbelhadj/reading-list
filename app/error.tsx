"use client";

import React from "react";
import { Button } from "@/components/ui/button";

const Error = ({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) => {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-dvh flex items-center justify-center px-5">
      <div className="flex flex-col items-start gap-4 max-w-md w-full">
        <div className="flex flex-col gap-1">
          <h1 className="font-content text-lg">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            We hit an unexpected error. Try again, and if it keeps happening let
            us know.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={reset}>
            Try again
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Go home
          </Button>
        </div>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60 font-mono">
            ref: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
};

export default Error;
