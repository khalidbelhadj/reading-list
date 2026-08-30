import { useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";

import { updateItem } from "@/app/actions";
import { notify } from "@/components/system/toast";
import { type Item } from "@/lib/types";

type EditableFields = { title?: string; notes?: string; url?: string };

const SAVE_DEBOUNCE_MS = 800;

/**
 * Write-through editing for one item. `patch` writes straight into the
 * ["items"] cache — every surface rendering the item (sidebar row, lists,
 * hover preview, the item view itself) updates on the keystroke — and arms a
 * debounced server save of the dirty fields. `flush` saves immediately; the
 * hook also flushes on unmount, which covers switching items and closing the
 * view (the item view remounts per item).
 *
 * Edits win over refetches: the dirty values live in a ref, and if a refetch
 * (staleTime, focus, the cross-device sync watcher) lands mid-edit, the dirty
 * fields are re-applied on top. A failed save keeps its fields dirty — unless
 * they were edited again in the meantime — so the next edit retries them.
 */
export const useEditItem = (itemId: string, item: Item | undefined) => {
  const queryClient = useQueryClient();
  const dirtyRef = React.useRef<EditableFields>({});
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const patchCache = React.useCallback(
    (fields: EditableFields) => {
      queryClient.setQueryData<Item[]>(["items"], (old) =>
        old?.map((cached) =>
          cached.id === itemId ? { ...cached, ...fields } : cached,
        ),
      );
    },
    [queryClient, itemId],
  );

  const saveMutation = useMutation({
    mutationFn: (fields: EditableFields) => updateItem(itemId, fields),
    onError: (_error, fields) => {
      // Re-mark the failed fields dirty so a later edit retries them, but
      // never on top of values the user has typed since.
      dirtyRef.current = { ...fields, ...dirtyRef.current };
      notify({ tone: "error", title: "Could not save changes" });
    },
  });

  const { mutate: save } = saveMutation;
  const flush = React.useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const fields = dirtyRef.current;
    if (Object.keys(fields).length === 0) return;
    dirtyRef.current = {};
    save(fields);
  }, [save]);

  const patch = React.useCallback(
    (fields: EditableFields) => {
      Object.assign(dirtyRef.current, fields);
      patchCache(fields);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [patchCache, flush],
  );

  // Re-apply in-progress edits whenever fresh server data replaces the cache.
  // Converges: once the patch lands, the item's fields equal the dirty values
  // and this effect writes nothing.
  React.useEffect(() => {
    if (!item) return;
    const dirty = dirtyRef.current;
    const stale = (Object.keys(dirty) as (keyof EditableFields)[]).some(
      (key) => (item[key] ?? "") !== dirty[key],
    );
    if (stale) patchCache(dirty);
  }, [item, patchCache]);

  // Flush pending edits when the view unmounts (item switch, view change).
  React.useEffect(() => flush, [flush]);

  return { patch, flush };
};
