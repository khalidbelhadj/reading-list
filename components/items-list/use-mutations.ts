import { useQueryClient } from "@tanstack/react-query";

import {
  reorderItem,
  toggleRead,
  deleteItem,
} from "@/app/actions";
import { type Item } from "@/lib/types";

export function useItemsMutations({
  filteredItems,
  setSelectedIds,
  setEditingId,
  showRead,
  setCursor,
}: {
  filteredItems: Item[];
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
  showRead: boolean;
  setCursor: (id: string | null) => void;
}) {
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["items"] });
  }

  async function handleReorder(itemId: string, type: string, newPosition: number) {
    await reorderItem(itemId, type, newPosition);
    invalidate();
  }

  async function handleToggleRead(itemId: string, read: boolean) {
    if (read && !showRead) {
      const idx = filteredItems.findIndex((i) => i.id === itemId);
      const nextItem = filteredItems[idx + 1] ?? filteredItems[idx - 1];
      if (nextItem) {
        setSelectedIds(new Set([nextItem.id]));
        setCursor(nextItem.id);
      } else {
        setSelectedIds(new Set());
        setCursor(null);
      }
    }
    await toggleRead(itemId, read);
    invalidate();
  }

  async function handleDeleteSingle(itemId: string) {
    const idx = filteredItems.findIndex((i) => i.id === itemId);
    const nextItem = filteredItems[idx + 1] ?? filteredItems[idx - 1];
    setEditingId(null);
    if (nextItem) {
      setSelectedIds(new Set([nextItem.id]));
      setCursor(nextItem.id);
    } else {
      setSelectedIds(new Set());
      setCursor(null);
    }
    await deleteItem(itemId);
    invalidate();
  }

  return {
    handleReorder,
    handleToggleRead,
    handleDeleteSingle,
  };
}
