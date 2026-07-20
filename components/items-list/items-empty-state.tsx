// Empty-state derivation + render for the items list body: picks the right
// message (no items yet / read hidden / no search hits / no filter matches)
// and renders the embedded NonIdealState with its action button.
import React from "react";

import { Button } from "@/components/ui/button";
import { NonIdealState } from "@/components/ui/non-ideal-state";

export const ItemsEmptyState = ({
  filteredCount,
  totalCount,
  hiddenReadCount,
  searchActive,
  searchQuery,
  searchBackendPending,
  onAdd,
  onShowRead,
}: {
  filteredCount: number;
  totalCount: number;
  hiddenReadCount: number;
  searchActive: boolean;
  searchQuery: string;
  // Hold the "no matches" message while the backend search is still
  // resolving — otherwise a query with no local keyword hits flashes "no
  // results" before the trigram pass gets a chance to return any. The
  // skeletons cover that window.
  searchBackendPending: boolean;
  onAdd: () => void;
  onShowRead: () => void;
}) => {
  // Empty state message
  const emptyState = React.useMemo(() => {
    if (filteredCount > 0) return null;
    if (totalCount === 0)
      return {
        message: "Nothing here yet",
        description:
          "Save articles, papers, and links to read later, and they'll show up here.",
        hasHiddenRead: false,
        canAdd: true,
      };

    if (hiddenReadCount > 0) {
      return {
        message: `${hiddenReadCount} read ${hiddenReadCount === 1 ? "item" : "items"} not shown`,
        description: "Read items are hidden. Show them to pick back up.",
        hasHiddenRead: true,
        canAdd: false,
      };
    }
    const trimmedQuery = searchQuery.trim();
    if (searchActive && trimmedQuery) {
      return {
        message: `No results for “${trimmedQuery}”`,
        description: "Try different keywords, or check your spelling.",
        hasHiddenRead: false,
        canAdd: false,
      };
    }
    return {
      message: "No items match your filters",
      description: "Try a different search, or clear your tag filters.",
      hasHiddenRead: false,
      canAdd: false,
    };
  }, [filteredCount, totalCount, hiddenReadCount, searchActive, searchQuery]);

  if (!emptyState || searchBackendPending) return null;

  return (
    <NonIdealState
      align="center"
      size="sm"
      className="py-6"
      title={emptyState.message}
      description={emptyState.description}
      actions={
        emptyState.canAdd ? (
          <Button size="sm" onClick={onAdd}>
            Add item
          </Button>
        ) : emptyState.hasHiddenRead ? (
          <Button variant="outline" size="sm" onClick={onShowRead}>
            Show read
          </Button>
        ) : undefined
      }
    />
  );
};
