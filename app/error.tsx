"use client";

import React from "react";
import { IconCheck, IconClipboard } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const Error = ({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) => {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    console.error(error);
  }, [error]);

  const handleCopyRef = React.useCallback(() => {
    if (!error.digest) return;
    navigator.clipboard.writeText(error.digest);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [error.digest]);

  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      <div className="group/error flex w-full max-w-md flex-col items-start gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-content text-lg">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            We hit an unexpected error. Try again, and if it keeps happening let
            us know.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={reset}>Reload</Button>
          <Button
            variant="ghost"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Go home
          </Button>
          {error.digest && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label="Copy error reference"
                    onClick={handleCopyRef}
                    className="flex size-6 items-center justify-center rounded text-muted-foreground/60 opacity-0 transition-opacity group-hover/error:opacity-100 hover:bg-secondary hover:text-foreground focus-visible:opacity-100"
                  >
                    {copied ? (
                      <IconCheck className="size-3.5" />
                    ) : (
                      <IconClipboard className="size-3.5" />
                    )}
                  </button>
                }
              />
              <TooltipContent side="right">
                {copied ? "Copied" : "Copy error reference"}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
};

export default Error;
