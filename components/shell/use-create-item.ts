import { useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";

import { createItem, fetchPageTitle, updateItem } from "@/app/actions";
import { notify } from "@/components/system/toast";
import { playItemCreated } from "@/lib/sounds";
import { type Item } from "@/lib/types";
import { normalizeUrl } from "@/lib/url";

// http(s) URLs only — favicons and open-in-browser assume web content.
export const clipboardUrl = (text: string): string | null => {
  const trimmed = text.trim();
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:"
      ? trimmed
      : null;
  } catch {
    return null;
  }
};

export const hostnameOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

// A cache-shaped item for the optimistic insert, so the new row (and an open
// item view) renders before the server has answered.
const optimisticItem = (
  id: string,
  existing: Item[],
  fields: { title?: string; url?: string } = {},
): Item => {
  const now = new Date().toISOString();
  return {
    id,
    userId: existing[0]?.userId ?? "",
    title: fields.title ?? "",
    url: fields.url ?? "",
    faviconUrl: null,
    starred: false,
    notes: null,
    read: false,
    readAt: null,
    hiddenFromReview: false,
    createdAt: now,
    updatedAt: now,
    flashcardCount: 0,
  };
};

/**
 * Item creation for the new shell: a blank item from the sidebar's New item,
 * and paste-a-URL creation (global ⌘V, or the paste affordance).
 *
 * Fully optimistic: the id is generated client-side, the row (and any open
 * item view, and the confirmation) appear before the request is sent, and the
 * server creates under that same id — no swap, no waiting. On failure the row
 * is rolled back; a duplicate URL rolls back too and offers to open the
 * existing item. Pasted URLs start with a hostname fallback title and a
 * background retitle swaps in the real page title once fetched — unless the
 * item was renamed in the meantime.
 */
// Background retitle: fetch the page's real title (external HTTP, up to ~5s,
// never blocking) and apply it — unless the fetch fails, returns nothing, or
// the item's title already moved past `fallback` (the user renamed it).
// Shared by paste-create and the item view's URL editing.
export const useRetitleItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; url: string; fallback: string }) => {
      const fetched = (await fetchPageTitle(args.url))?.trim();
      if (!fetched || fetched === args.fallback) return null;
      const current = queryClient
        .getQueryData<Item[]>(["items"])
        ?.find((item) => item.id === args.id);
      if (current && current.title !== args.fallback) return null;
      await updateItem(args.id, { title: fetched });
      return { id: args.id, title: fetched };
    },
    onSuccess: (result) => {
      if (!result) return;
      queryClient.setQueryData<Item[]>(["items"], (old) =>
        old?.map((item) =>
          item.id === result.id ? { ...item, title: result.title } : item,
        ),
      );
      void queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });
};

export const useCreateItem = (onOpen: (id: string) => void) => {
  const queryClient = useQueryClient();

  const insertIntoCache = React.useCallback(
    async (id: string, fields: { title?: string; url?: string } = {}) => {
      // Stop any in-flight refetch from landing without the new row.
      await queryClient.cancelQueries({ queryKey: ["items"] });
      queryClient.setQueryData<Item[]>(["items"], (old) => {
        if (!old || old.some((item) => item.id === id)) return old;
        return [optimisticItem(id, old, fields), ...old];
      });
    },
    [queryClient],
  );

  const removeFromCache = React.useCallback(
    (id: string) => {
      queryClient.setQueryData<Item[]>(["items"], (old) =>
        old?.filter((item) => item.id !== id),
      );
    },
    [queryClient],
  );

  const invalidate = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["items"] }),
    [queryClient],
  );

  const retitleMutation = useRetitleItem();

  const createFromUrlMutation = useMutation({
    mutationFn: ({ id, url }: { id: string; url: string }) =>
      createItem(hostnameOf(url), url, undefined, undefined, id),
    onMutate: async ({ id, url }) => {
      // The sound means a new item actually landed: only the url paste
      // paths (⌘V and the paste affordance) come through here.
      playItemCreated();
      await insertIntoCache(id, { title: hostnameOf(url), url });
      const notifyId = notify({
        title: hostnameOf(url),
        description: "Added to your list",
        actions: [{ label: "Open", primary: true, onClick: () => onOpen(id) }],
      });
      return { notifyId };
    },
    onSuccess: (result, { id, url }, context) => {
      if (!result.ok) {
        removeFromCache(id);
        notify.dismiss(context.notifyId);
        notify({
          title: "Already saved",
          description: result.duplicate.title || result.duplicate.url,
          actions: [
            {
              label: "Open",
              primary: true,
              onClick: () => onOpen(result.duplicate.id),
            },
          ],
        });
        return;
      }
      retitleMutation.mutate({ id, url, fallback: hostnameOf(url) });
    },
    onError: (_error, { id }, context) => {
      removeFromCache(id);
      if (context) notify.dismiss(context.notifyId);
      notify({ tone: "error", title: "Could not add item" });
    },
    onSettled: () => invalidate(),
  });

  const createBlankMutation = useMutation({
    // An empty url skips the duplicate check server-side.
    mutationFn: (id: string) => createItem("", "", undefined, undefined, id),
    onMutate: async (id) => {
      await insertIntoCache(id);
      onOpen(id);
    },
    onError: (_error, id) => {
      removeFromCache(id);
      notify({ tone: "error", title: "Could not create item" });
    },
    onSettled: () => invalidate(),
  });

  const { mutate: mutateFromUrl } = createFromUrlMutation;
  const createFromUrl = React.useCallback(
    (url: string) => {
      // Same sameness rule as the server's duplicate check, applied to the
      // cache first: a known duplicate short-circuits to "Already saved"
      // without the optimistic insert (no jitter). The server check remains
      // the authority for what the cache doesn't know about (e.g. an item
      // just added on another device) — only that rare case rolls back.
      const normalized = normalizeUrl(url);
      const existing = normalized
        ? queryClient
            .getQueryData<Item[]>(["items"])
            ?.find((item) => normalizeUrl(item.url) === normalized)
        : undefined;
      if (existing) {
        notify({
          title: "Already saved",
          description: existing.title || existing.url,
          actions: [
            {
              label: "Open",
              primary: true,
              onClick: () => onOpen(existing.id),
            },
          ],
        });
        return;
      }
      mutateFromUrl({ id: crypto.randomUUID(), url });
    },
    [mutateFromUrl, queryClient, onOpen],
  );

  const { mutate: mutateBlank } = createBlankMutation;
  const createBlank = React.useCallback(
    () => mutateBlank(crypto.randomUUID()),
    [mutateBlank],
  );

  // The paste affordance's click path: read the clipboard, validate, create.
  const pasteFromClipboard = React.useCallback(async () => {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      notify({
        tone: "error",
        title: "Couldn't read clipboard",
        description: "Grant clipboard permission and try again.",
      });
      return;
    }
    const url = clipboardUrl(text);
    if (!url) {
      notify({
        title: "Nothing to add",
        description: "Your clipboard doesn't contain a link.",
      });
      return;
    }
    createFromUrl(url);
  }, [createFromUrl]);

  return { createFromUrl, createBlank, pasteFromClipboard };
};
