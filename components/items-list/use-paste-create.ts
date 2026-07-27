// Item creation entry points for ItemsList: blank "new item", paste-a-URL
// creation with background retitle (typewriter animation), and the clipboard
// URL validation behind the paste shortcut.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";

import { fetchPageTitle, updateItem } from "@/app/actions";
import { type Item } from "@/lib/types";

import { type useCreateItem } from "./use-create-item";
import { useInvalidateItems } from "./use-invalidate-items";
import { makeOptimisticItem } from "./utils";

export const usePasteCreate = ({
  requestCreate,
  onOpenItem,
  animateTypingTitle,
  activeTags,
}: {
  requestCreate: ReturnType<typeof useCreateItem>["requestCreate"];
  onOpenItem: (id: string) => void;
  animateTypingTitle: (id: string, title: string) => Promise<void>;
  activeTags: Set<string>;
}) => {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateItems();

  // Background retitle for pasted URLs: the item is created instantly with a
  // hostname fallback title, then this fetches the real page title (external
  // HTTP, up to ~5s) and applies it — unless the user already renamed the
  // item in the meantime.
  const retitleMutation = useMutation({
    mutationFn: async (args: {
      newId: string;
      url: string;
      fallback: string;
    }): Promise<{ newId: string; title: string } | null> => {
      const fetched = await fetchPageTitle(args.url);
      const title = fetched?.trim();
      if (!title || title === args.fallback) return null;
      const current = queryClient
        .getQueryData<Item[]>(["items"])
        ?.find((it) => it.id === args.newId);
      if (current && current.title !== args.fallback) return null;
      await updateItem(args.newId, { title });
      return { newId: args.newId, title };
    },
    onSuccess: (result) => {
      if (!result) return;
      queryClient.setQueryData<Item[]>(["items"], (old) =>
        old?.map((it) =>
          it.id === result.newId ? { ...it, title: result.title } : it,
        ),
      );
      void animateTypingTitle(result.newId, result.title);
      invalidate();
    },
  });

  const handleOpenNew = React.useCallback(() => {
    requestCreate(
      { title: "", url: "", tagNames: [] },
      {
        onCreated: (newId) => {
          // Optimistically insert into the cache so the detail page can
          // render the new (empty) item without waiting on a full refetch.
          queryClient.setQueryData<Item[]>(["items"], (old) => {
            if (!old) return old;
            return [makeOptimisticItem(newId, old), ...old];
          });
          invalidate();
          onOpenItem(newId);
        },
        onError: () => {
          toast.error("Could not create item", {
            description: "Please try again.",
          });
        },
      },
    );
  }, [requestCreate, queryClient, invalidate, onOpenItem]);

  const requestPasteCreate = React.useCallback(
    (url: string, tagNames: string[]) => {
      // Create immediately with the hostname fallback title — waiting on the
      // external page-title fetch here used to block creation for up to 5s.
      // retitleMutation swaps in the real title when it arrives.
      const fallback = (() => {
        try {
          return new URL(url).hostname.replace(/^www\./, "");
        } catch {
          return url;
        }
      })();
      requestCreate(
        { title: fallback, url, tagNames },
        {
          onCreated: (newId) => {
            // Optimistically insert so the row appears immediately; the
            // animation typing overlay then replaces its title visually.
            queryClient.setQueryData<Item[]>(["items"], (old) => {
              if (!old) return old;
              if (old.some((it) => it.id === newId)) return old;
              return [
                makeOptimisticItem(newId, old, {
                  title: fallback,
                  url,
                  tagNames,
                }),
                ...old,
              ];
            });
            invalidate();
            retitleMutation.mutate({ newId, url, fallback });
          },
          onOpenExisting: onOpenItem,
        },
      );
    },
    [requestCreate, onOpenItem, invalidate, retitleMutation, queryClient],
  );

  const handlePasteUrl = React.useCallback(async () => {
    // The dropdown menu's focus handoff hasn't settled by the time this
    // handler runs synchronously — clipboard.readText() would reject with
    // "Document is not focused". Wait one frame for focus to return to the
    // trigger, then read.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    let text: string;
    try {
      text = (await navigator.clipboard.readText()).trim();
    } catch {
      toast.error("Couldn't read clipboard", {
        description: "Grant clipboard permission and try again.",
      });
      return;
    }
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      toast.error("Invalid URL", {
        description: "Your clipboard doesn't contain a valid URL.",
      });
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      toast.error("Invalid URL", {
        description: "Your clipboard doesn't contain a valid URL.",
      });
      return;
    }
    requestPasteCreate(text, [...activeTags]);
  }, [requestPasteCreate, activeTags]);

  return { handleOpenNew, requestPasteCreate, handlePasteUrl };
};
