import { Favicon } from "@/components/app/favicon";
import { TextLink } from "@/components/system/link";
import { Select } from "@/components/system/select";

export type ReviewMode = "due" | "new" | "topic";

// The page furniture pinned to the pane's corners: the Due/New/Topic switch
// (or the cram label when item-scoped) with the count top-left, the deck
// door top-right.
export const ReviewHeader = ({
  itemId,
  scopeItem,
  showCount,
  remaining,
  mode,
  onModeChange,
  stackTitle,
  scopedMode,
  onScopedModeChange,
  onOpenDeck,
}: {
  itemId?: string;
  scopeItem: { title: string; url: string; faviconUrl?: string | null } | null;
  showCount: boolean;
  remaining: number;
  mode: ReviewMode;
  onModeChange: (mode: ReviewMode) => void;
  // The running stack's name, shown next to the count in Topic mode.
  stackTitle: string | null;
  scopedMode: "due" | "all" | null;
  onScopedModeChange: (mode: "due" | "all") => void;
  onOpenDeck: () => void;
}) => (
  <>
    <div className="app-no-drag absolute top-3 left-4 z-20 flex items-center gap-3 text-small text-muted-foreground select-none">
      {itemId ? (
        <>
          <Select
            value={scopedMode ?? "due"}
            onValueChange={onScopedModeChange}
            aria-label="Item review queue"
            className="w-20"
            items={[
              {
                value: "due",
                label: "Due",
                description: "This item's cards scheduled for now",
              },
              {
                value: "all",
                label: "All",
                description: "Every card, scheduling untouched",
              },
            ]}
          />
          {showCount && <span className="tabular-nums">{remaining} left</span>}
          {/* The item wears the same inline favicon + title as the card's
              context line below. */}
          <span className="flex min-w-0 items-center gap-1">
            {scopedMode === "all" ? "Cramming" : "Due in"}
            {scopeItem && (
              <>
                <Favicon item={scopeItem} size={12} />
                <span className="max-w-56 truncate">
                  {scopeItem.title || "Untitled"}
                </span>
              </>
            )}
            {scopedMode === "all" && ", scheduling untouched"}
          </span>
        </>
      ) : (
        <>
          <Select
            value={mode}
            onValueChange={onModeChange}
            aria-label="Review queue"
            className="w-20"
            items={[
              {
                value: "due",
                label: "Due",
                description: "Cards scheduled for now",
              },
              {
                value: "new",
                label: "New",
                description: "Cards you haven't learned yet",
              },
              {
                value: "topic",
                label: "Topic",
                description: "Ask for a stack on anything you've read",
              },
            ]}
          />
          {showCount && <span className="tabular-nums">{remaining} left</span>}
          {stackTitle && (
            <span className="max-w-72 truncate">{stackTitle}</span>
          )}
        </>
      )}
    </div>
    <TextLink
      variant="quiet"
      href="#"
      className="app-no-drag absolute top-4 right-4 z-20 text-micro font-medium select-none"
      onClick={(event) => {
        event.preventDefault();
        onOpenDeck();
      }}
    >
      All cards
    </TextLink>
  </>
);
