import { IconCheck, IconClipboard } from "@tabler/icons-react";
import React from "react";

import { Button } from "@/components/ui/button";
import { NonIdealState } from "@/components/ui/non-ideal-state";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Router-level error boundary (root route errorComponent). `reset` re-renders
// the failed route; the copy button shares the error message for bug reports.
export const RouteError = ({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) => {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    console.error(error);
  }, [error]);

  const handleCopyRef = React.useCallback(() => {
    navigator.clipboard.writeText(error.message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [error.message]);

  return (
    <NonIdealState
      fullPage
      titleAs="h1"
      className="group/error"
      title="Something went wrong"
      description="We hit an unexpected error. Try again, and if it keeps happening let us know."
      actions={
        <>
          <Button onClick={reset}>Reload</Button>
          <Button
            variant="ghost"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Go home
          </Button>
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
        </>
      }
    />
  );
};
