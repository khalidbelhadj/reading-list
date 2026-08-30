import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";

import { generateItemPreview } from "@/app/actions";
import { fetchItemPreviews } from "@/app/actions";
import { getYouTubeVideoId } from "@/lib/url";

// Single-flight set so duplicate generation requests aren't fired for the
// same item across re-mounts (rows scrolling in and out).
const inFlight = new Set<string>();

const isProbeableUrl = (raw: string): boolean => {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * The stored preview image for an item (a PDF first-page render), from the
 * shared ["item-previews"] fetch. The first time a qualifying item is shown
 * it lazily generates (and persists) its preview — once per item for the
 * lifetime of the database. YouTube items are skipped (their thumbnail comes
 * straight from ytimg). Pass `enabled: false` where thumbnails aren't shown
 * so compact rows never trigger the heavy fetch.
 */
export const useItemPreview = (
  item: { id: string; url: string },
  enabled: boolean,
): string | null => {
  const queryClient = useQueryClient();
  const { data: previews, isSuccess: previewsLoaded } = useQuery({
    queryKey: ["item-previews"],
    queryFn: fetchItemPreviews,
    enabled,
  });
  // Three states, keyed off presence in the previews map: absent → never
  // attempted; "" → checked, not a PDF; data URL → rendered.
  const previewResolved = previews ? item.id in previews : false;
  const previewImageUrl = previews?.[item.id] || null;

  const { mutate: triggerGenerate } = useMutation({
    mutationFn: (itemId: string) => generateItemPreview(itemId),
    onSuccess: (dataUrl, itemId) => {
      // Patch the shared cache in place; null from the action means "not a
      // PDF" and is stored as "" so it isn't probed again.
      queryClient.setQueryData<Record<string, string>>(
        ["item-previews"],
        (old) => ({ ...(old ?? {}), [itemId]: dataUrl ?? "" }),
      );
    },
    onSettled: (_data, _error, itemId) => inFlight.delete(itemId),
  });

  React.useEffect(() => {
    if (!enabled || !previewsLoaded || previewResolved) return;
    if (getYouTubeVideoId(item.url)) return;
    if (!isProbeableUrl(item.url)) return;
    if (inFlight.has(item.id)) return;
    inFlight.add(item.id);
    triggerGenerate(item.id);
  }, [
    enabled,
    previewsLoaded,
    previewResolved,
    item.id,
    item.url,
    triggerGenerate,
  ]);

  return previewImageUrl;
};
