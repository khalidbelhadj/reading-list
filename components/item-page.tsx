"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { IconArrowLeft, IconDots, IconExternalLink, IconFileFilled, IconPlus } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { type Item } from "@/lib/types";
import { fetchItems } from "@/lib/queries";
import { getFaviconSrc } from "@/components/items-list/utils";
import { updateItem, deleteItem, toggleRead } from "@/app/actions";
import { type EditFields } from "@/components/items-list/utils";
import { useInvalidateItems } from "@/components/items-list/use-invalidate-items";
import { DetailPanel, type DetailPanelHandle } from "@/components/items-list/detail-panel";
import { DetailPanelSkeleton } from "@/components/items-list/detail-panel-skeleton";
import { LoadingFade } from "@/components/ui/loading-fade";
import { ItemDropdown } from "@/components/items-list/item-dropdown";
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DeleteItemDialog } from "@/components/items-list/delete-item-dialog";

export const ItemPage = ({ itemId }: { itemId: string }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateItems();

  const { data: items } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: fetchItems,
    staleTime: Infinity,
  });

  const item = items?.find((i) => i.id === itemId) ?? null;

  React.useEffect(() => {
    router.prefetch("/");
  }, [router]);

  React.useEffect(() => {
    const pageTitle = item?.title?.trim() || "Untitled";
    document.title = `${pageTitle} — Reading List`;
    return () => {
      document.title = "Reading List";
    };
  }, [item?.title]);

  const detailRef = React.useRef<DetailPanelHandle>(null);
  const morphRef = React.useRef<HTMLDivElement>(null);
  const headerSlotRef = React.useRef<HTMLDivElement>(null);
  const scrolledRef = React.useRef(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const THRESHOLD = 48;
    const CONTENT_ICON = 24;
    const HEADER_ICON = 14;
    const CONTENT_FONT = 24;
    const HEADER_FONT = 12;

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const ease = (t: number) => t * (2 - t);

    const update = () => {
      const morph = morphRef.current;
      const headerSlot = headerSlotRef.current;
      const contentRow = document.querySelector<HTMLElement>("[data-title-row]");
      if (!morph || !headerSlot || !contentRow) return;

      const scrollY = Math.max(0, window.scrollY);
      const rawT = Math.min(scrollY / THRESHOLD, 1);
      const t = ease(rawT);

      const isScrolled = scrollY > 0;
      if (isScrolled !== scrolledRef.current) {
        scrolledRef.current = isScrolled;
        setScrolled(isScrolled);
      }

      if (rawT <= 0) {
        morph.style.opacity = "0";
        contentRow.style.visibility = "";
        return;
      }

      contentRow.style.visibility = "hidden";

      const contentRect = contentRow.getBoundingClientRect();
      const headerRect = headerSlot.getBoundingClientRect();

      const x = lerp(contentRect.left, headerRect.left, t);
      const y = lerp(contentRect.top, headerRect.top, t);
      const iconSize = lerp(CONTENT_ICON, HEADER_ICON, t);
      const fontSize = lerp(CONTENT_FONT, HEADER_FONT, t);
      const gap = lerp(8, 6, t);
      const maxWidth = lerp(contentRect.width, headerRect.width, t);

      morph.style.transform = `translate(${x}px, ${y}px)`;
      morph.style.fontSize = `${fontSize}px`;
      morph.style.gap = `${gap}px`;
      morph.style.maxWidth = `${maxWidth}px`;
      morph.style.opacity = "1";

      const icon = morph.querySelector<HTMLElement>("[data-morph-icon]");
      if (icon) {
        icon.style.width = `${iconSize}px`;
        icon.style.height = `${iconSize}px`;
      }
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const raf = requestAnimationFrame(update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      cancelAnimationFrame(raf);
      const contentRow = document.querySelector<HTMLElement>("[data-title-row]");
      if (contentRow) contentRow.style.visibility = "";
    };
  }, [item]);

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const updateMutation = useMutation({
    mutationFn: (args: {
      id: string;
      fields: {
        title?: string;
        url?: string;
        notes?: string;
        tagNames?: string[];
      };
    }) => updateItem(args.id, args.fields),
    onMutate: async ({ id, fields }) => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const previous = queryClient.getQueryData<Item[]>(["items"]);
      queryClient.setQueryData<Item[]>(["items"], (old) =>
        (old ?? []).map((it) => {
          if (it.id !== id) return it;
          const next = { ...it, updatedAt: new Date().toISOString() };
          if (fields.title !== undefined) next.title = fields.title;
          if (fields.url !== undefined) next.url = fields.url;
          if (fields.notes !== undefined) next.notes = fields.notes;
          if (fields.tagNames !== undefined) {
            const byName = new Map(it.tags.map((t) => [t.name, t]));
            next.tags = fields.tagNames.map(
              (name, i) =>
                byName.get(name) ?? { id: -(i + 1), userId: it.userId, name },
            );
          }
          return next;
        }),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous)
        queryClient.setQueryData(["items"], context.previous);
    },
    onSettled: invalidate,
  });

  const handleSave = React.useCallback(
    (id: string, fields: EditFields) => {
      const tagNames = fields.tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      updateMutation.mutate({
        id,
        fields: {
          title: fields.title,
          url: fields.url,
          notes: fields.notes,
          tagNames,
        },
      });
    },
    [updateMutation],
  );

  const handleTogglePin = React.useCallback(async () => {
    if (!item) return;
    const newStarred = !item.starred;
    queryClient.setQueryData<Item[]>(["items"], (old) =>
      (old ?? []).map((it) =>
        it.id === item.id ? { ...it, starred: newStarred } : it,
      ),
    );
    await updateItem(item.id, { starred: newStarred });
    invalidate();
  }, [item, queryClient, invalidate]);

  const handleToggleRead = React.useCallback(async () => {
    if (!item) return;
    const newRead = !item.read;
    queryClient.setQueryData<Item[]>(["items"], (old) =>
      (old ?? []).map((it) =>
        it.id === item.id ? { ...it, read: newRead } : it,
      ),
    );
    await toggleRead(item.id, newRead);
    invalidate();
  }, [item, queryClient, invalidate]);

  const handleDelete = React.useCallback(async () => {
    if (!item) return;
    setDeleting(true);
    await deleteItem(item.id);
    invalidate();
    router.back();
  }, [item, invalidate, router]);

  const handleBack = React.useCallback(() => {
    router.back();
  }, [router]);

  const faviconSrc = item
    ? getFaviconSrc({ faviconUrl: item.faviconUrl, url: item.url })
    : null;

  return (
    <div className="min-h-dvh">
      <div className="mx-auto w-full max-w-175 px-5">
        <div className="sticky top-0 z-10 flex items-center gap-0.5 -mx-1.5 pt-1.5 pb-1.5 bg-background">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                  onClick={handleBack}
                />
              }
            >
              <IconArrowLeft />
            </TooltipTrigger>
            <TooltipContent>Back</TooltipContent>
          </Tooltip>
          <div ref={headerSlotRef} className="ml-1 h-5 flex-1" />
          {item?.url && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground"
                    onClick={() => window.open(item.url, "_blank")}
                  />
                }
              >
                <IconExternalLink />
              </TooltipTrigger>
              <TooltipContent>Open URL</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                  onClick={() => detailRef.current?.startAddingCard()}
                />
              }
            >
              <IconPlus />
            </TooltipTrigger>
            <TooltipContent>Add flashcard</TooltipContent>
          </Tooltip>
          {item ? (
            <ItemDropdown
              item={item}
              onTogglePin={handleTogglePin}
              onToggleRead={handleToggleRead}
              onDelete={() => setDeleteOpen(true)}
            >
              <Tooltip>
                <DropdownMenuTrigger
                  render={
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground"
                        />
                      }
                    >
                      <IconDots />
                    </TooltipTrigger>
                  }
                />
                <TooltipContent>More options</TooltipContent>
              </Tooltip>
            </ItemDropdown>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              disabled
            >
              <IconDots />
            </Button>
          )}
          {scrolled && (
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-linear-to-b from-background to-transparent translate-y-full pointer-events-none" />
          )}
        </div>
        <div className="pt-1">
        <LoadingFade loading={!item} skeleton={<DetailPanelSkeleton />}>
          {item ? (
            <DetailPanel
              ref={detailRef}
              key={item.id}
              item={item}
              isNew={false}
              onSave={handleSave}
              onCreate={() => {}}
              onDelete={() => setDeleteOpen(true)}
            />
          ) : null}
        </LoadingFade>
        </div>
      </div>

      {item && (
        <div
          ref={morphRef}
          className="fixed top-0 left-0 z-20 flex items-center pointer-events-none"
          style={{ opacity: 0 }}
        >
          <div data-morph-icon className="shrink-0 flex items-center justify-center" style={{ width: 24, height: 24 }}>
            {faviconSrc ? (
              <Image
                src={faviconSrc}
                alt=""
                width={24}
                height={24}
                className="w-full h-full rounded object-contain"
                unoptimized
              />
            ) : (
              <IconFileFilled className="w-full h-full text-muted-foreground" />
            )}
          </div>
          <span className="font-content font-semibold truncate">
            {item.title || "Untitled"}
          </span>
        </div>
      )}

      <DeleteItemDialog
        item={item}
        open={deleteOpen}
        deleting={deleting}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
      />
    </div>
  );
};
