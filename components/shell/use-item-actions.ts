import { useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";

import {
  deleteItem as deleteItemAction,
  setItemRead,
  updateItem,
} from "@/app/actions";
import { notify } from "@/components/system/toast";
import { type Item } from "@/lib/types";

/**
 * Row-level item actions, all optimistic: the ["items"] cache changes on the
 * click, the server call follows, and on failure the previous cache snapshot
 * is restored with an error card. Same write-through model as creation and
 * editing.
 */
export const useItemActions = () => {
  const queryClient = useQueryClient();

  const snapshot = React.useCallback(async () => {
    await queryClient.cancelQueries({ queryKey: ["items"] });
    return queryClient.getQueryData<Item[]>(["items"]);
  }, [queryClient]);

  const restore = React.useCallback(
    (previous: Item[] | undefined) => {
      if (previous) queryClient.setQueryData(["items"], previous);
    },
    [queryClient],
  );

  const patchItem = React.useCallback(
    (id: string, fields: Partial<Item>) => {
      queryClient.setQueryData<Item[]>(["items"], (old) =>
        old?.map((item) => (item.id === id ? { ...item, ...fields } : item)),
      );
    },
    [queryClient],
  );

  const invalidate = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["items"] }),
    [queryClient],
  );

  const readMutation = useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) =>
      setItemRead(id, read),
    onMutate: async ({ id, read }) => {
      const previous = await snapshot();
      patchItem(id, { read, readAt: read ? new Date().toISOString() : null });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      restore(context?.previous);
      notify({ tone: "error", title: "Could not update item" });
    },
    onSettled: () => invalidate(),
  });

  const starMutation = useMutation({
    mutationFn: ({ id, starred }: { id: string; starred: boolean }) =>
      updateItem(id, { starred }),
    onMutate: async ({ id, starred }) => {
      const previous = await snapshot();
      patchItem(id, { starred });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      restore(context?.previous);
      notify({ tone: "error", title: "Could not update item" });
    },
    onSettled: () => invalidate(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteItemAction(id),
    onMutate: async (id) => {
      const previous = await snapshot();
      queryClient.setQueryData<Item[]>(["items"], (old) =>
        old?.filter((item) => item.id !== id),
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      restore(context?.previous);
      notify({ tone: "error", title: "Could not delete item" });
    },
    onSettled: () => invalidate(),
  });

  const { mutate: mutateRead } = readMutation;
  const toggleRead = React.useCallback(
    (item: Pick<Item, "id" | "read">) =>
      mutateRead({ id: item.id, read: !item.read }),
    [mutateRead],
  );

  const { mutate: mutateStar } = starMutation;
  const toggleStar = React.useCallback(
    (item: Pick<Item, "id" | "starred">) =>
      mutateStar({ id: item.id, starred: !item.starred }),
    [mutateStar],
  );

  const hiddenMutation = useMutation({
    mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) =>
      updateItem(id, { hiddenFromReview: hidden }),
    onMutate: async ({ id, hidden }) => {
      const previous = await snapshot();
      patchItem(id, { hiddenFromReview: hidden });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      restore(context?.previous);
      notify({ tone: "error", title: "Could not update item" });
    },
    onSettled: () => {
      void invalidate();
      // Hiding pulls the item's cards out of the review queue.
      void queryClient.invalidateQueries({ queryKey: ["all-flashcards"] });
    },
  });

  const { mutate: mutateDelete } = deleteMutation;
  const removeItem = React.useCallback(
    (item: Pick<Item, "id">) => mutateDelete(item.id),
    [mutateDelete],
  );

  const { mutate: mutateHidden } = hiddenMutation;
  const toggleHiddenFromReview = React.useCallback(
    (item: Pick<Item, "id" | "hiddenFromReview">) =>
      mutateHidden({ id: item.id, hidden: !item.hiddenFromReview }),
    [mutateHidden],
  );

  const openLink = React.useCallback((item: Pick<Item, "url">) => {
    if (item.url) window.open(item.url, "_blank", "noopener,noreferrer");
  }, []);

  const copyLink = React.useCallback((item: Pick<Item, "url">) => {
    if (item.url) void navigator.clipboard.writeText(item.url);
  }, []);

  return {
    toggleRead,
    toggleStar,
    toggleHiddenFromReview,
    removeItem,
    openLink,
    copyLink,
  };
};
