"use client";

import React from "react";
import { IconPlus } from "@tabler/icons-react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AVAILABLE_PLACEHOLDERS,
  type CopyPrompt,
  DEFAULT_PROMPTS,
  useCopyPrompts,
} from "@/lib/copy-prompts";

export const CopyPromptsDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const [prompts, setPrompts] = useCopyPrompts();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameDraft, setRenameDraft] = React.useState("");
  const [menuAnchor, setMenuAnchor] = React.useState<{
    prompt: CopyPrompt;
    el: HTMLElement;
  } | null>(null);
  const tabStripRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  React.useEffect(() => {
    if (open && !selectedId && prompts.length > 0) {
      setSelectedId(prompts[0].id);
    }
  }, [open, selectedId, prompts]);

  const selectedPrompt = prompts.find((p) => p.id === selectedId) ?? null;

  const handleTemplateChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!selectedPrompt) return;
      const template = e.target.value;
      setPrompts(
        prompts.map((p) =>
          p.id === selectedPrompt.id ? { ...p, template } : p,
        ),
      );
    },
    [prompts, selectedPrompt, setPrompts],
  );

  const handleDescriptionChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedPrompt) return;
      const description = e.target.value;
      setPrompts(
        prompts.map((p) =>
          p.id === selectedPrompt.id ? { ...p, description } : p,
        ),
      );
    },
    [prompts, selectedPrompt, setPrompts],
  );

  const handleAddPrompt = React.useCallback(() => {
    const id = `prompt-${Date.now()}`;
    const newPrompt: CopyPrompt = {
      id,
      name: "New prompt",
      description: "",
      template: "",
    };
    setPrompts([...prompts, newPrompt]);
    setSelectedId(id);
    setRenamingId(id);
    setRenameDraft(newPrompt.name);
  }, [prompts, setPrompts]);

  const handleDeletePrompt = React.useCallback(
    (id: string) => {
      const idx = prompts.findIndex((p) => p.id === id);
      const next = prompts.filter((p) => p.id !== id);
      setPrompts(next);
      if (selectedId === id) {
        const neighbor = next[idx] ?? next[idx - 1] ?? null;
        setSelectedId(neighbor?.id ?? null);
      }
    },
    [prompts, selectedId, setPrompts],
  );

  const startRename = React.useCallback((prompt: CopyPrompt) => {
    setRenamingId(prompt.id);
    setRenameDraft(prompt.name);
  }, []);

  const commitRename = React.useCallback(() => {
    if (!renamingId) return;
    const name = renameDraft.trim();
    if (name) {
      setPrompts(
        prompts.map((p) => (p.id === renamingId ? { ...p, name } : p)),
      );
    }
    setRenamingId(null);
  }, [renamingId, renameDraft, prompts, setPrompts]);

  const cancelRename = React.useCallback(() => {
    setRenamingId(null);
  }, []);

  const handleRenameKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitRename();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelRename();
      }
    },
    [commitRename, cancelRename],
  );

  const handleRenameChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setRenameDraft(e.target.value);
    },
    [],
  );

  const handleTabContextMenu = React.useCallback(
    (prompt: CopyPrompt, el: HTMLElement) => {
      setMenuAnchor({ prompt, el });
    },
    [],
  );

  const handleMenuOpenChange = React.useCallback((nextOpen: boolean) => {
    if (!nextOpen) setMenuAnchor(null);
  }, []);

  const handleRenameMenuClick = React.useCallback(() => {
    if (menuAnchor) startRename(menuAnchor.prompt);
    setMenuAnchor(null);
  }, [menuAnchor, startRename]);

  const handleDeleteMenuClick = React.useCallback(() => {
    if (menuAnchor) handleDeletePrompt(menuAnchor.prompt.id);
    setMenuAnchor(null);
  }, [menuAnchor, handleDeletePrompt]);

  const handleReset = React.useCallback(() => {
    setPrompts(DEFAULT_PROMPTS);
    setSelectedId(DEFAULT_PROMPTS[0]?.id ?? null);
  }, [setPrompts]);

  const handleClose = React.useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const updateScrollState = React.useCallback(() => {
    const el = tabStripRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  React.useEffect(() => {
    updateScrollState();
    const el = tabStripRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateScrollState, prompts.length, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl gap-3">
        <DialogHeader>
          <DialogTitle>Prompts</DialogTitle>
        </DialogHeader>

        <div
          ref={tabStripRef}
          onScroll={updateScrollState}
          style={{
            maskImage: `linear-gradient(to right, ${canScrollLeft ? "transparent" : "black"}, black 1rem, black calc(100% - 1rem), ${canScrollRight ? "transparent" : "black"})`,
          }}
          className="flex items-center gap-1 overflow-x-auto hide-scrollbar min-w-0"
        >
          {prompts.map((prompt) => (
            <PromptTab
              key={prompt.id}
              prompt={prompt}
              isSelected={selectedId === prompt.id}
              isRenaming={renamingId === prompt.id}
              renameDraft={renameDraft}
              onSelect={setSelectedId}
              onContextMenu={handleTabContextMenu}
              onRenameChange={handleRenameChange}
              onRenameCommit={commitRename}
              onRenameKeyDown={handleRenameKeyDown}
            />
          ))}
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground"
            onClick={handleAddPrompt}
            title="Add prompt"
          >
            <IconPlus />
          </Button>
        </div>

        {selectedPrompt && (
          <input
            type="text"
            value={selectedPrompt.description}
            onChange={handleDescriptionChange}
            placeholder="Description"
            className="h-8 rounded-md bg-card px-3 text-xs outline-none ring-1 ring-foreground/10 focus:ring-foreground/25"
          />
        )}

        {selectedPrompt ? (
          <textarea
            key={selectedPrompt.id}
            value={selectedPrompt.template}
            onChange={handleTemplateChange}
            spellCheck={false}
            placeholder="Write your prompt template..."
            className="font-mono w-full h-96 resize-none rounded-md bg-card p-3 text-xs outline-none ring-1 ring-foreground/10 focus:ring-foreground/25 detail-panel-scroll"
          />
        ) : (
          <div className="h-96 flex items-center justify-center text-xs text-muted-foreground">
            No prompts. Click + to create one.
          </div>
        )}

        <p className="text-xs text-muted-foreground/60">
          Available placeholders:{" "}
          {AVAILABLE_PLACEHOLDERS.map((p, i) => (
            <span key={p}>
              {i > 0 ? ", " : ""}
              <code className="px-1 rounded bg-muted/50">{`{{${p}}}`}</code>
            </span>
          ))}
        </p>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={handleReset}
            className="mr-auto text-muted-foreground"
          >
            Reset to defaults
          </Button>
          <Button onClick={handleClose}>Done</Button>
        </DialogFooter>
      </DialogContent>

      <MenuPrimitive.Root
        open={menuAnchor !== null}
        onOpenChange={handleMenuOpenChange}
      >
        <MenuPrimitive.Portal>
          <MenuPrimitive.Positioner
            anchor={menuAnchor?.el ?? null}
            className="isolate z-50 outline-none"
            align="start"
            sideOffset={4}
          >
            <MenuPrimitive.Popup
              data-slot="dropdown-menu-content"
              className="z-50 min-w-32 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
            >
              <MenuPrimitive.Item
                data-slot="dropdown-menu-item"
                className="relative flex min-h-7 cursor-default items-center gap-2 rounded-md px-2 py-1 text-xs/relaxed outline-hidden select-none focus:bg-accent focus:text-accent-foreground"
                onClick={handleRenameMenuClick}
              >
                Rename
              </MenuPrimitive.Item>
              <MenuPrimitive.Item
                data-slot="dropdown-menu-item"
                data-variant="destructive"
                className="relative flex min-h-7 cursor-default items-center gap-2 rounded-md px-2 py-1 text-xs/relaxed text-destructive outline-hidden select-none focus:bg-destructive/10 focus:text-destructive dark:focus:bg-destructive/20"
                onClick={handleDeleteMenuClick}
              >
                Delete
              </MenuPrimitive.Item>
            </MenuPrimitive.Popup>
          </MenuPrimitive.Positioner>
        </MenuPrimitive.Portal>
      </MenuPrimitive.Root>
    </Dialog>
  );
};

const PromptTab = ({
  prompt,
  isSelected,
  isRenaming,
  renameDraft,
  onSelect,
  onContextMenu,
  onRenameChange,
  onRenameCommit,
  onRenameKeyDown,
}: {
  prompt: CopyPrompt;
  isSelected: boolean;
  isRenaming: boolean;
  renameDraft: string;
  onSelect: (id: string) => void;
  onContextMenu: (prompt: CopyPrompt, el: HTMLElement) => void;
  onRenameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRenameCommit: () => void;
  onRenameKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) => {
  const handleClick = React.useCallback(() => {
    if (isRenaming) return;
    onSelect(prompt.id);
  }, [isRenaming, onSelect, prompt.id]);

  const handleContextMenu = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      onContextMenu(prompt, e.currentTarget);
    },
    [onContextMenu, prompt],
  );

  if (isRenaming) {
    return (
      <input
        autoFocus
        value={renameDraft}
        onChange={onRenameChange}
        onBlur={onRenameCommit}
        onKeyDown={onRenameKeyDown}
        size={Math.max(renameDraft.length, 6)}
        className="rounded-md bg-card px-2 py-1 text-xs outline-none ring-1 ring-foreground/25 field-sizing-content"
      />
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "flex items-center rounded-md px-2 py-1 text-xs cursor-pointer shrink-0",
        isSelected
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-accent",
      )}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      title={prompt.name}
    >
      {prompt.name}
    </div>
  );
};
