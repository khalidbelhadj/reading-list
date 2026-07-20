import { useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";

import { deleteTag, renameTag } from "@/app/actions";
import { type DbTag, type Item } from "@/lib/types";

import { useInvalidateItems } from "./use-invalidate-items";

export const useTagMutations = (items: Item[]) => {
  const queryClient = useQueryClient();
  const invalidateItems = useInvalidateItems();

  const [renamingTagId, setRenamingTagId] = React.useState<number | null>(null);
  const [renameDraft, setRenameDraft] = React.useState("");
  const [pendingDeleteTag, setPendingDeleteTag] = React.useState<DbTag | null>(
    null,
  );
  const [deleting, setDeleting] = React.useState(false);

  const renameMutation = useMutation({
    mutationFn: ({ tagId, newName }: { tagId: number; newName: string }) =>
      renameTag(tagId, newName),
    onMutate: async ({ tagId, newName }) => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const previous = queryClient.getQueryData<Item[]>(["items"]);
      queryClient.setQueryData<Item[]>(["items"], (old) =>
        (old ?? []).map((item) => ({
          ...item,
          tags: item.tags.map((t) =>
            t.id === tagId ? { ...t, name: newName } : t,
          ),
        })),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["items"], context.previous);
      }
    },
    onSettled: invalidateItems,
  });

  const deleteMutation = useMutation({
    mutationFn: (tagId: number) => deleteTag(tagId),
    onSuccess: invalidateItems,
  });

  const startRename = React.useCallback((tag: DbTag) => {
    setRenamingTagId(tag.id);
    setRenameDraft(tag.name);
  }, []);

  const commitRename = React.useCallback(
    (tag: DbTag) => {
      const next = renameDraft.trim().toLowerCase();
      setRenamingTagId(null);
      if (next && next !== tag.name) {
        renameMutation.mutate({ tagId: tag.id, newName: next });
      }
    },
    [renameDraft, renameMutation],
  );

  const cancelRename = React.useCallback(() => {
    setRenamingTagId(null);
  }, []);

  const confirmDelete = React.useCallback(async () => {
    if (!pendingDeleteTag) return;
    setDeleting(true);
    try {
      await deleteMutation.mutateAsync(pendingDeleteTag.id);
    } finally {
      setDeleting(false);
      setPendingDeleteTag(null);
    }
  }, [pendingDeleteTag, deleteMutation]);

  const pendingDeleteCount = React.useMemo(() => {
    if (!pendingDeleteTag) return 0;
    return items.filter((item) =>
      item.tags.some((t) => t.id === pendingDeleteTag.id),
    ).length;
  }, [items, pendingDeleteTag]);

  return {
    renameMutation,
    deleteMutation,
    renamingTagId,
    renameDraft,
    setRenameDraft,
    startRename,
    commitRename,
    cancelRename,
    pendingDeleteTag,
    setPendingDeleteTag,
    pendingDeleteCount,
    confirmDelete,
    deleting,
  };
};
