// Failures, grouped by why.
//
// The whole argument for typing the reason lives here: each group says what
// happened in a sentence, and only the groups where retrying can work get a
// retry. A page that has already been established to contain no article does
// not get a button that pretends otherwise.
import { IconRefresh } from "@tabler/icons-react";

import type { FailureGroup } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FAILURE_REASONS } from "@/lib/extract/failure";

export const FailuresPanel = ({
  failures,
  retryingReason,
  onRetryReason,
}: {
  failures: FailureGroup[];
  // The reason currently being requeued, if any.
  retryingReason: string | null;
  onRetryReason: (reason: FailureGroup["reason"]) => void;
}) => {
  if (failures.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {failures.map((group) => {
        const meta = FAILURE_REASONS[group.reason];
        const busy = retryingReason === group.reason;
        return (
          <div
            key={group.reason}
            className="flex items-start gap-3 rounded-lg bg-card p-3"
          >
            <span className="mt-0.5 min-w-8 text-right font-mono text-sm tabular-nums">
              {group.count}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{meta.label}</p>
              <p className="text-xs/relaxed text-muted-foreground">
                {meta.explain}
              </p>
            </div>
            {group.retryable && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => onRetryReason(group.reason)}
              >
                {busy ? <Spinner className="size-3" /> : <IconRefresh />}
                Retry
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
};
