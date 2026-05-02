import type { QueryClient } from "@tanstack/react-query";
import type { Item } from "@/lib/types";

export const bumpItemFlashcardCount = (
  queryClient: QueryClient,
  itemId: string,
  delta: number,
) => {
  queryClient.setQueryData<Item[]>(["items"], (old) =>
    old?.map((it) =>
      it.id === itemId
        ? { ...it, flashcardCount: Math.max(0, it.flashcardCount + delta) }
        : it,
    ),
  );
};
