import { useMutation, useQueryClient } from "@tanstack/react-query";

import { bulkDeleteItems, bulkMarkRead, bulkSetPinned } from "@/app/actions";
import { type Item } from "@/lib/types";
import { useInvalidateItems } from "./use-invalidate-items";

// The bulk action schemas cap each call at 100 ids — a select-all can exceed
// that, so requests are split into parallel chunks.
const CHUNK_SIZE = 100;
const chunked = (ids: string[]): string[][] => {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
};

// Optimistic bulk mutations over the ["items"] cache, mirroring the
// single-item mutations in use-item-mutations.ts: apply to the cache
// immediately, roll back on error, invalidate on settle.
export const useBulkMutations = () => {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateItems();

  const applyOptimistic = async (map: (item: Item) => Item) => {
    await queryClient.cancelQueries({ queryKey: ["items"] });
    const previous = queryClient.getQueryData<Item[]>(["items"]);
    queryClient.setQueryData<Item[]>(["items"], (old) => (old ?? []).map(map));
    return { previous };
  };

  const rollback = (context?: { previous?: Item[] }) => {
    if (context?.previous) {
      queryClient.setQueryData(["items"], context.previous);
    }
  };

  const bulkReadMutation = useMutation({
    mutationFn: ({ itemIds, read }: { itemIds: string[]; read: boolean }) =>
      Promise.all(chunked(itemIds).map((ids) => bulkMarkRead(ids, read))),
    onMutate: ({ itemIds, read }) => {
      const ids = new Set(itemIds);
      const now = new Date().toISOString();
      return applyOptimistic((item) =>
        ids.has(item.id)
          ? { ...item, read, readAt: read ? now : null, updatedAt: now }
          : item,
      );
    },
    onError: (_err, _vars, context) => rollback(context),
    onSettled: invalidate,
  });

  const bulkPinMutation = useMutation({
    mutationFn: ({
      itemIds,
      starred,
    }: {
      itemIds: string[];
      starred: boolean;
    }) =>
      Promise.all(chunked(itemIds).map((ids) => bulkSetPinned(ids, starred))),
    onMutate: ({ itemIds, starred }) => {
      const ids = new Set(itemIds);
      return applyOptimistic((item) =>
        ids.has(item.id) ? { ...item, starred } : item,
      );
    },
    onError: (_err, _vars, context) => rollback(context),
    onSettled: invalidate,
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (itemIds: string[]) =>
      Promise.all(chunked(itemIds).map((ids) => bulkDeleteItems(ids))),
    onMutate: (itemIds) => {
      const ids = new Set(itemIds);
      return queryClient.cancelQueries({ queryKey: ["items"] }).then(() => {
        const previous = queryClient.getQueryData<Item[]>(["items"]);
        queryClient.setQueryData<Item[]>(["items"], (old) =>
          (old ?? []).filter((item) => !ids.has(item.id)),
        );
        return { previous };
      });
    },
    onError: (_err, _vars, context) => rollback(context),
    onSettled: () => {
      invalidate();
      // Deleting items also deletes their flashcards server-side.
      queryClient.invalidateQueries({ queryKey: ["all-flashcards"] });
      queryClient.invalidateQueries({ queryKey: ["flashcards"] });
      queryClient.invalidateQueries({ queryKey: ["review-status"] });
      queryClient.invalidateQueries({ queryKey: ["item-review-status"] });
    },
  });

  return {
    bulkReadMutation,
    bulkPinMutation,
    bulkDeleteMutation,
  };
};
