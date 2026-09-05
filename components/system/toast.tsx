import { IconX } from "@tabler/icons-react";
import type React from "react";
import { toast as sonner, Toaster as Sonner, type ToasterProps } from "sonner";

import { playError } from "@/lib/sounds";
import { cn } from "@/lib/utils";

import { Button } from "./button";
import { Surface } from "./surface";

type NotifyAction = {
  label: string;
  onClick?: () => void;
  // The one action that resolves the notification; rendered in the foreground
  // colour. Everything else reads as quiet text.
  primary?: boolean;
};

export type NotifyOptions = {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  // Short trailing note beside the title, e.g. "2m ago" or "Saved".
  meta?: React.ReactNode;
  actions?: NotifyAction[];
  tone?: "default" | "error";
  duration?: number;
};

// The notification card itself: a frost surface with the surface radius, an
// icon, a bold title with a quiet meta, a line of description, text-only
// actions, and a close in the corner. Modelled on macOS notifications.
export const Notification = ({
  title,
  description,
  icon,
  meta,
  actions,
  tone = "default",
  onClose,
}: Omit<NotifyOptions, "duration"> & { onClose: () => void }) => (
  <Surface
    kind="frost"
    padding="none"
    role="status"
    className="relative flex w-88 gap-3 p-4 pr-10 text-body select-none"
  >
    {icon && (
      <div className="flex size-8 shrink-0 items-center justify-center [&>svg]:size-5">
        {icon}
      </div>
    )}
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "truncate font-medium",
            tone === "error" ? "text-destructive" : "text-foreground",
          )}
        >
          {title}
        </span>
        {meta && (
          <span className="shrink-0 text-small text-muted-foreground">
            {meta}
          </span>
        )}
      </div>
      {description && (
        <p className="text-body text-muted-foreground">{description}</p>
      )}
      {actions && actions.length > 0 && (
        <div className="-ml-2 flex items-center gap-1 pt-2">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant="ghost"
              className={cn(
                "h-6 px-2",
                action.primary
                  ? "font-medium text-foreground"
                  : "text-muted-foreground",
              )}
              onClick={() => {
                action.onClick?.();
                onClose();
              }}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Dismiss"
      className="absolute top-2.5 right-2.5 text-muted-foreground"
      onClick={onClose}
    >
      <IconX />
    </Button>
  </Surface>
);

// Show a notification. Returns the id, for dismissing it early. An error
// gets its sound here, the one place every failure passes through.
export const notify = (options: NotifyOptions) => {
  if (options.tone === "error") playError();
  return sonner.custom(
    (id) => <Notification {...options} onClose={() => sonner.dismiss(id)} />,
    {
      // Sonner's own chrome would double the surface; the card is the toast.
      // `unstyled` drops its layout, and the className clears the themed edge
      // the Toaster applies to legacy toasts, which would otherwise draw a
      // second box around the card at the wrong radius.
      unstyled: true,
      className: "!bg-transparent !p-0 !shadow-none",
      duration: options.duration ?? (options.actions?.length ? 10_000 : 4_000),
    },
  );
};

notify.dismiss = (id?: string | number) => sonner.dismiss(id);

// Host for notifications. Mount once near the root. Plain `toast()` calls
// from legacy code still render through sonner's own chrome, themed to the
// system tokens, until they migrate to notify().
export const Toaster = (props: ToasterProps) => (
  <Sonner
    position="bottom-right"
    offset={16}
    gap={8}
    visibleToasts={4}
    style={
      {
        "--normal-bg": "var(--card)",
        "--normal-text": "var(--foreground)",
        "--normal-border": "transparent",
        "--border-radius": "var(--r-control)",
      } as React.CSSProperties
    }
    toastOptions={{
      classNames: {
        // Scoped to sonner's own styled toasts: a notify() card is the toast,
        // and the surface edge on its unstyled, unrounded wrapper would draw a
        // square ring behind the card.
        toast:
          "data-[styled=true]:!shadow-surface !text-body data-[type=error]:!text-destructive",
        description: "!text-small !text-muted-foreground",
      },
    }}
    {...props}
  />
);
