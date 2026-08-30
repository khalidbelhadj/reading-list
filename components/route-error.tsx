import { IconCheck, IconClipboard } from "@tabler/icons-react";
import React from "react";

import { Button } from "@/components/system/button";
import { NonIdealState } from "@/components/system/non-ideal-state";
import { Tooltip } from "@/components/system/tooltip";

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
          <Button variant="primary" onClick={reset}>
            Reload
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Go home
          </Button>
          <Tooltip
            side="right"
            content={copied ? "Copied" : "Copy error reference"}
          >
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Copy error reference"
              onClick={handleCopyRef}
              className="text-muted-foreground/60 opacity-0 transition-opacity group-hover/error:opacity-100 focus-visible:opacity-100"
            >
              {copied ? <IconCheck /> : <IconClipboard />}
            </Button>
          </Tooltip>
        </>
      }
    />
  );
};
