import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateFlashcard, deleteFlashcard } from "@/app/actions";

export const useFlashcardMutations = <T extends { id: string }>({
  queryKey,
  onUpdateSuccess,
  onDeleteSettled,
}: {
  queryKey: readonly unknown[];
  onUpdateSuccess?: (id: string) => void;
  onDeleteSettled?: (id: string) => void;
}) => {
  const queryClient = useQueryClient();
  const [deletingCardId, setDeletingCardId] = React.useState<string | null>(null);

  const updateCardMutation = useMutation({
    mutationFn: ({
      id,
      front,
      back,
    }: {
      id: string;
      front?: string;
      back?: string;
    }) => updateFlashcard(id, { front, back }),
    onMutate: async ({ id, front, back }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData<T[]>(queryKey, (old) =>
        (old ?? []).map((c) =>
          c.id === id
            ? {
                ...c,
                ...(front !== undefined && { front }),
                ...(back !== undefined && { back }),
                updatedAt: new Date().toISOString(),
              }
            : c,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSuccess: (_data, vars) => {
      onUpdateSuccess?.(vars.id);
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: (id: string) => deleteFlashcard(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData<T[]>(queryKey, (old) =>
        (old ?? []).filter((c) => c.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: (_data, _err, id) => {
      onDeleteSettled?.(id);
    },
  });

  const handleUpdateCard = React.useCallback(
    (id: string, fields: { front?: string; back?: string }) => {
      updateCardMutation.mutate({ id, ...fields });
    },
    [updateCardMutation],
  );

  const handleDeleteCard = React.useCallback(
    async (id: string) => {
      setDeletingCardId(id);
      try {
        await deleteCardMutation.mutateAsync(id);
      } finally {
        setDeletingCardId(null);
      }
    },
    [deleteCardMutation],
  );

  return {
    updateCardMutation,
    deleteCardMutation,
    deletingCardId,
    setDeletingCardId,
    handleUpdateCard,
    handleDeleteCard,
  };
};
