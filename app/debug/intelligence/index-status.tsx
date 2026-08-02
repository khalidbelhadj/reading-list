// The header line: how much of the library search can actually find.
//
// One sentence, one bar, and a chip per problem that exists. The counts
// partition the library exactly, so the numbers visibly add up — which the
// previous row of a dozen badges (mixing table stats, queue depth, and the
// result of the last button click) could not manage.
import { IconPlayerPauseFilled } from "@tabler/icons-react";

import type { IndexSummary } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const Chip = ({
  count,
  label,
  tooltip,
  tone = "secondary",
}: {
  count: number;
  label: string;
  tooltip: string;
  tone?: React.ComponentProps<typeof Badge>["variant"];
}) => (
  <Tooltip>
    <TooltipTrigger render={<Badge variant={tone} className="gap-1" />}>
      <span className="tabular-nums">{count}</span>
      <span className="font-normal opacity-70">{label}</span>
    </TooltipTrigger>
    <TooltipContent className="max-w-64">{tooltip}</TooltipContent>
  </Tooltip>
);

export const IndexStatus = ({ summary }: { summary: IndexSummary | null }) => {
  if (!summary) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  const { ready, totalItems, working, running, failed, notIndexed } = summary;
  const percent = totalItems === 0 ? 0 : (ready / totalItems) * 100;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="shrink-0 text-sm whitespace-nowrap">
        <span className="tabular-nums">{ready}</span>
        <span className="text-muted-foreground">
          {" of "}
          <span className="tabular-nums">{totalItems}</span> indexed
        </span>
      </span>

      <Tooltip>
        <TooltipTrigger
          render={
            <span className="h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-muted" />
          }
        >
          <span
            className="block h-full bg-primary"
            style={{ width: `${percent}%` }}
          />
        </TooltipTrigger>
        <TooltipContent>
          {Math.round(percent)}% of your library can be found by search.
        </TooltipContent>
      </Tooltip>

      {working > 0 && (
        <Chip
          count={working}
          label={running > 0 ? `working (${running} now)` : "waiting"}
          tooltip={
            running > 0
              ? `${running} being indexed right now, ${working - running} queued behind them.`
              : "Queued for the indexer's next pass."
          }
        />
      )}
      {failed > 0 && (
        <Chip
          count={failed}
          label="failed"
          tone="destructive"
          tooltip="Grouped by reason below, with a retry for the ones retrying can fix."
        />
      )}
      {notIndexed > 0 && (
        <Chip
          count={notIndexed}
          label="never queued"
          tone="outline"
          tooltip="No content row at all. Index everything picks these up."
        />
      )}
      {summary.staleModel > 0 && (
        <Chip
          count={summary.staleModel}
          label="on an old model"
          tone="outline"
          tooltip={`Indexed with a previous embedding model, so search (which filters to ${summary.activeModel}) can't see them yet. Re-embed queues them.`}
        />
      )}
      {summary.paused && (
        <Badge variant="destructive" className="gap-1">
          <IconPlayerPauseFilled className="size-3" />
          Paused
        </Badge>
      )}
    </div>
  );
};
