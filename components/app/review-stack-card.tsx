import { Badge } from "@/components/system/badge";
import { Button } from "@/components/system/button";
import { Surface } from "@/components/system/surface";

import { Favicon } from "./favicon";
import { ListRow } from "./list-row";

export type ReviewStackSource = {
  id: string;
  title: string;
  url: string;
  faviconUrl?: string | null;
  // Cards of this item in the stack; zero means the source is on-topic but
  // has nothing to review yet.
  cardCount: number;
};

export type ReviewStackStats = {
  cards: number;
  // Split of the cards by what a rating will do: due and new cards are
  // scheduled, the rest is a cram pass.
  due: number;
  fresh: number;
  cram: number;
};

const Stat = ({ value, label }: { value: number; label: string }) => (
  <div className="flex flex-col">
    <span className="font-content text-heading tabular-nums">{value}</span>
    <span className="text-micro text-muted-foreground">{label}</span>
  </div>
);

// A compiled review stack, presented before it starts: what it covers, how
// many cards and of what kind, and the sources they come from. Sources with
// no cards are listed too, because that is where cards are missing.
export const ReviewStackCard = ({
  title,
  summary,
  stats,
  sources,
  onOpenSource,
  onStart,
}: {
  title: string;
  summary: string;
  stats: ReviewStackStats;
  sources: ReviewStackSource[];
  onOpenSource?: (id: string) => void;
  // Absent when there is nothing to start.
  onStart?: () => void;
}) => (
  <Surface padding="md" className="flex flex-col gap-4">
    <div className="flex flex-col gap-1">
      <h2 className="font-content text-title font-medium">{title}</h2>
      {summary && <p className="text-small text-muted-foreground">{summary}</p>}
    </div>

    <div className="flex gap-6">
      <Stat value={stats.cards} label="cards" />
      <Stat value={sources.length} label="sources" />
      <Stat value={stats.due} label="due" />
      <Stat value={stats.fresh} label="new" />
      <Stat value={stats.cram} label="cram" />
    </div>

    {sources.length > 0 && (
      <div className="-mx-2 flex flex-col gap-0.5">
        {sources.map((source) => (
          <ListRow
            key={source.id}
            leading={<Favicon item={source} size={14} />}
            title={source.title || "Untitled"}
            meta={
              source.cardCount > 0
                ? `${source.cardCount} card${source.cardCount === 1 ? "" : "s"}`
                : undefined
            }
            trailing={
              source.cardCount === 0 ? (
                <Badge variant="outline">no cards</Badge>
              ) : undefined
            }
            muted={source.cardCount === 0}
            render={
              onOpenSource ? (
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => onOpenSource(source.id)}
                />
              ) : undefined
            }
          />
        ))}
      </div>
    )}

    <div className="flex items-center justify-between gap-3">
      <p className="text-micro text-muted-foreground">
        {stats.cards > 0
          ? "Due and new cards are scheduled; the rest is a cram pass."
          : sources.length > 0
            ? "These sources are on topic, but none of them have flashcards yet."
            : "Nothing in the deck matches this yet."}
      </p>
      {onStart && (
        <Button variant="primary" onClick={onStart}>
          Review {stats.cards} card{stats.cards === 1 ? "" : "s"}
        </Button>
      )}
    </div>
  </Surface>
);
