import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addItemsToList,
  createList,
  deleteList,
  fetchLists,
  removeItemFromList,
  updateList,
} from "@/app/actions";
import type { ListWithMembers } from "@/lib/lists";

export const useLists = () => {
  return useQuery<ListWithMembers[]>({
    queryKey: ["lists"],
    queryFn: fetchLists,
    staleTime: Infinity,
  });
};

// Helper that updates the lists cache synchronously and returns the previous
// snapshot, so callers can apply optimistic changes before kicking off the
// async mutation. Doing the write here (not inside React Query's `onMutate`)
// avoids the one-tick flash where the UI re-renders against the stale cache
// before `onMutate` runs.
const applyListsPatch = (
  queryClient: ReturnType<typeof useQueryClient>,
  patch: (old: ListWithMembers[]) => ListWithMembers[],
) => {
  const previous = queryClient.getQueryData<ListWithMembers[]>(["lists"]);
  queryClient.setQueryData<ListWithMembers[]>(["lists"], (old) =>
    patch(old ?? []),
  );
  return previous;
};

const rollback = (
  queryClient: ReturnType<typeof useQueryClient>,
  previous: ListWithMembers[] | undefined,
) => {
  if (previous) queryClient.setQueryData(["lists"], previous);
};

export const useListMutations = () => {
  const queryClient = useQueryClient();
  const invalidate = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["lists"] }),
    [queryClient],
  );

  const createMutation = useMutation({
    mutationFn: ({
      name,
      icon,
      id,
    }: {
      name: string;
      icon?: string | null;
      id: string;
    }) => createList(name, icon, id),
    onSettled: invalidate,
  });

  const renameMutation = useMutation({
    mutationFn: ({ listId, name }: { listId: string; name: string }) =>
      updateList(listId, { name }),
    onSettled: invalidate,
  });

  const setIconMutation = useMutation({
    mutationFn: ({ listId, icon }: { listId: string; icon: string | null }) =>
      updateList(listId, { icon }),
    onSettled: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (listId: string) => deleteList(listId),
    onSettled: invalidate,
  });

  const addMutation = useMutation({
    mutationFn: ({ listId, itemIds }: { listId: string; itemIds: string[] }) =>
      addItemsToList(listId, itemIds),
    onSettled: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: ({ listId, itemId }: { listId: string; itemId: string }) =>
      removeItemFromList(listId, itemId),
    onSettled: invalidate,
  });

  const handleCreate = React.useCallback(
    ({ name, icon }: { name: string; icon?: string | null }) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const previous = applyListsPatch(queryClient, (old) => [
        ...old,
        {
          id,
          userId: "",
          name,
          icon: icon ?? null,
          position: old.length,
          createdAt: now,
          updatedAt: now,
          itemIds: [],
        },
      ]);
      createMutation.mutate(
        { name, icon, id },
        { onError: () => rollback(queryClient, previous) },
      );
      return id;
    },
    [queryClient, createMutation],
  );

  const handleRename = React.useCallback(
    ({ listId, name }: { listId: string; name: string }) => {
      const previous = applyListsPatch(queryClient, (old) =>
        old.map((l) => (l.id === listId ? { ...l, name } : l)),
      );
      renameMutation.mutate(
        { listId, name },
        { onError: () => rollback(queryClient, previous) },
      );
    },
    [queryClient, renameMutation],
  );

  const handleSetIcon = React.useCallback(
    ({ listId, icon }: { listId: string; icon: string | null }) => {
      const previous = applyListsPatch(queryClient, (old) =>
        old.map((l) => (l.id === listId ? { ...l, icon } : l)),
      );
      setIconMutation.mutate(
        { listId, icon },
        { onError: () => rollback(queryClient, previous) },
      );
    },
    [queryClient, setIconMutation],
  );

  const handleDelete = React.useCallback(
    (listId: string) => {
      const previous = applyListsPatch(queryClient, (old) =>
        old.filter((l) => l.id !== listId),
      );
      deleteMutation.mutate(listId, {
        onError: () => rollback(queryClient, previous),
      });
    },
    [queryClient, deleteMutation],
  );

  const handleAdd = React.useCallback(
    ({ listId, itemIds }: { listId: string; itemIds: string[] }) => {
      const previous = applyListsPatch(queryClient, (old) =>
        old.map((l) =>
          l.id === listId
            ? {
                ...l,
                itemIds: [
                  ...l.itemIds,
                  ...itemIds.filter((id) => !l.itemIds.includes(id)),
                ],
              }
            : l,
        ),
      );
      addMutation.mutate(
        { listId, itemIds },
        { onError: () => rollback(queryClient, previous) },
      );
    },
    [queryClient, addMutation],
  );

  const handleRemove = React.useCallback(
    ({ listId, itemId }: { listId: string; itemId: string }) => {
      const previous = applyListsPatch(queryClient, (old) =>
        old.map((l) =>
          l.id === listId
            ? { ...l, itemIds: l.itemIds.filter((id) => id !== itemId) }
            : l,
        ),
      );
      removeMutation.mutate(
        { listId, itemId },
        { onError: () => rollback(queryClient, previous) },
      );
    },
    [queryClient, removeMutation],
  );

  return {
    createList: handleCreate,
    renameList: handleRename,
    setListIcon: handleSetIcon,
    deleteList: handleDelete,
    addItemsToList: handleAdd,
    removeItemFromList: handleRemove,
  };
};
