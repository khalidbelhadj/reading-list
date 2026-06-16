import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  deleteItem,
  toggleRead,
  updateItem,
} from "@/app/actions";
import { type Item } from "@/lib/types";
import {
  useInvalidateItemFlashcards,
  useInvalidateItems,
} from "./use-invalidate-items";

export type UpdateItemFields = {
  title?: string;
  url?: string;
  notes?: string;
  starred?: boolean;
  tagNames?: string[];
};

export const useItemMutations = () => {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateItems();
  const invalidateItemFlashcards = useInvalidateItemFlashcards();

  const toggleReadMutation = useMutation({
    mutationFn: ({ itemId, read }: { itemId: string; read: boolean }) =>
      toggleRead(itemId, read),
    onMutate: async ({ itemId, read }) => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const previous = queryClient.getQueryData<Item[]>(["items"]);
      queryClient.setQueryData<Item[]>(["items"], (old) =>
        (old ?? []).map((item) =>
          item.id === itemId
            ? {
                ...item,
                read,
                readAt: read ? new Date().toISOString() : null,
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["items"], context.previous);
      }
    },
    onSettled: invalidate,
  });

  const togglePinMutation = useMutation({
    mutationFn: ({ itemId, starred }: { itemId: string; starred: boolean }) =>
      updateItem(itemId, { starred }),
    onMutate: async ({ itemId, starred }) => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const previous = queryClient.getQueryData<Item[]>(["items"]);
      queryClient.setQueryData<Item[]>(["items"], (old) =>
        (old ?? []).map((item) =>
          item.id === itemId ? { ...item, starred } : item,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["items"], context.previous);
      }
    },
    onSettled: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => deleteItem(itemId),
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const previous = queryClient.getQueryData<Item[]>(["items"]);
      queryClient.setQueryData<Item[]>(["items"], (old) =>
        (old ?? []).filter((item) => item.id !== itemId),
      );
      return { previous };
    },
    onError: (_err, _itemId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["items"], context.previous);
      }
    },
    onSettled: (_data, _error, itemId) => {
      invalidate();
      // Deleting an item also deletes its flashcards server-side.
      invalidateItemFlashcards(itemId);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ itemId, fields }: { itemId: string; fields: UpdateItemFields }) =>
      updateItem(itemId, fields),
    onMutate: async ({ itemId, fields }) => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const previous = queryClient.getQueryData<Item[]>(["items"]);
      queryClient.setQueryData<Item[]>(["items"], (old) =>
        (old ?? []).map((it) => {
          if (it.id !== itemId) return it;
          const next = { ...it, updatedAt: new Date().toISOString() };
          if (fields.title !== undefined) next.title = fields.title;
          if (fields.url !== undefined) next.url = fields.url;
          if (fields.notes !== undefined) next.notes = fields.notes;
          if (fields.starred !== undefined) next.starred = fields.starred;
          if (fields.tagNames !== undefined) {
            const byName = new Map(it.tags.map((t) => [t.name, t]));
            next.tags = fields.tagNames.map(
              (name, i) =>
                byName.get(name) ?? { id: -(i + 1), userId: it.userId, name },
            );
          }
          return next;
        }),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["items"], context.previous);
      }
    },
    onSettled: (_data, _error, { itemId, fields }) => {
      invalidate();
      // A notes save reconciles inline flashcards server-side.
      if (fields.notes !== undefined) invalidateItemFlashcards(itemId);
    },
  });

  return {
    toggleReadMutation,
    togglePinMutation,
    deleteMutation,
    updateMutation,
  };
};
