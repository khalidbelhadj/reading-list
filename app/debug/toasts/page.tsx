"use client";

import React from "react";
import { notFound } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type ToastVariant = {
  id: string;
  name: string;
  description: string;
  fire: () => void;
};

const VARIANTS: ToastVariant[] = [
  {
    id: "default",
    name: "Default",
    description: "Plain message, no icon",
    fire: () => toast("Item created"),
  },
  {
    id: "success",
    name: "Success",
    description: "Check icon, green accent",
    fire: () => toast.success("Saved 3 items"),
  },
  {
    id: "info",
    name: "Info",
    description: "Info icon",
    fire: () => toast.info("Sync starts in 2 minutes"),
  },
  {
    id: "warning",
    name: "Warning",
    description: "Triangle icon",
    fire: () => toast.warning("Your session expires soon"),
  },
  {
    id: "error",
    name: "Error",
    description: "Octagon icon, destructive",
    fire: () => toast.error("Could not save item"),
  },
  {
    id: "loading",
    name: "Loading",
    description: "Spinner, stays until dismissed",
    fire: () => {
      const id = toast.loading("Importing items…");
      setTimeout(() => toast.dismiss(id), 2500);
    },
  },
  {
    id: "with-description",
    name: "With description",
    description: "Title + secondary line",
    fire: () =>
      toast("Item updated", {
        description: "Tags and notes were saved to the server.",
      }),
  },
  {
    id: "icon-with-description",
    name: "Icon + description",
    description: "Typed variant with subtitle",
    fire: () =>
      toast.success("Item saved", {
        description: "Tags and notes synced to the server.",
      }),
  },
  {
    id: "with-action",
    name: "With action",
    description: "Undo / retry button",
    fire: () =>
      toast("Item deleted", {
        action: {
          label: "Undo",
          onClick: () => toast.success("Restored"),
        },
      }),
  },
  {
    id: "promise",
    name: "Promise",
    description: "Loading → success/error",
    fire: () => {
      const work = new Promise<string>((resolve) =>
        setTimeout(() => resolve("done"), 1500),
      );
      toast.promise(work, {
        loading: "Fetching page title…",
        success: "Title fetched",
        error: "Could not fetch title",
      });
    },
  },
  {
    id: "long",
    name: "Long text",
    description: "Wraps across lines",
    fire: () =>
      toast(
        "This is a very long toast message that should wrap onto multiple lines to verify the layout still feels balanced when the content exceeds the typical one-line width.",
      ),
  },
  {
    id: "stack",
    name: "Stack 4",
    description: "Fire four in a row",
    fire: () => {
      toast("First");
      setTimeout(() => toast.success("Second"), 120);
      setTimeout(() => toast.info("Third"), 240);
      setTimeout(() => toast.error("Fourth"), 360);
    },
  },
  {
    id: "dismiss",
    name: "Dismiss all",
    description: "Clear the queue",
    fire: () => toast.dismiss(),
  },
];

const ToastsPlayground = () => {
  return (
    <div className="min-h-dvh px-5 py-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-content text-xl">Toasts</h1>
          <p className="text-sm text-muted-foreground">
            Click a card to fire that variant. Sonner is the underlying library;
            styling comes from <code className="font-mono text-xs">components/ui/sonner.tsx</code>.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {VARIANTS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={v.fire}
              className="flex flex-col items-start gap-1 rounded-lg bg-card p-4 text-left transition-colors hover:bg-card/70"
            >
              <span className="font-content text-sm text-foreground">
                {v.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {v.description}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => toast.dismiss()}>
            Dismiss all
          </Button>
        </div>
      </div>
    </div>
  );
};

const ToastsPage = () => {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
  return <ToastsPlayground />;
};

export default ToastsPage;
