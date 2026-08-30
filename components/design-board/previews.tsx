import type React from "react";

import { cn } from "@/lib/utils";

import { type TokenSet } from "./options";

// Sample UI rendered under each candidate token set. Built from raw elements
// on purpose: the kit does not exist yet, and this is what it will replace.

const asStyle = (tokens: TokenSet, extra?: React.CSSProperties) =>
  ({ ...tokens, ...extra }) as React.CSSProperties;

export const Frame = ({
  tokens,
  dark,
  radiusControl,
  radiusSurface,
  className,
  children,
}: {
  tokens?: TokenSet;
  dark?: boolean;
  radiusControl?: string;
  radiusSurface?: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <div
    className={cn(
      dark && "dark",
      "flex flex-col gap-4 bg-background p-5 text-foreground",
      className,
    )}
    style={asStyle(tokens ?? {}, {
      "--r-control": radiusControl ?? "8px",
      "--r-surface": radiusSurface ?? "14px",
      borderRadius: "var(--r-surface)",
    } as React.CSSProperties)}
  >
    {children}
  </div>
);

export const SampleCard = ({ glass }: { glass?: boolean }) => (
  <div
    className={cn(
      "flex flex-col gap-3 p-4",
      glass ? "glass-preview" : "bg-card",
    )}
    style={{ borderRadius: "var(--r-surface)" }}
  >
    <div className="flex items-center justify-between gap-3">
      <span className="font-content text-[15px] font-medium">
        Two Ways To Do Dynamic Dispatch
      </span>
      <span
        className="bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
        style={{ borderRadius: "calc(var(--r-control) - 2px)" }}
      >
        Due
      </span>
    </div>
    <p className="text-[13px] text-muted-foreground">
      Besides method pointers, what else does a Rust trait object&rsquo;s vtable
      typically store?
    </p>
    <div className="flex items-center justify-end gap-2 pt-1">
      <SampleButton variant="secondary">Next</SampleButton>
      <SampleButton variant="primary">Review</SampleButton>
    </div>
  </div>
);

export const SampleButton = ({
  variant,
  children,
}: {
  variant: "primary" | "secondary";
  children: React.ReactNode;
}) => (
  <span
    className={cn(
      "inline-flex h-7 items-center px-3 text-[13px] font-medium select-none",
      variant === "primary"
        ? "bg-primary text-primary-foreground"
        : "bg-muted text-foreground",
    )}
    style={{ borderRadius: "var(--r-control)" }}
  >
    {children}
  </span>
);

export const SampleRows = () => (
  <ul className="flex flex-col">
    {[
      ["Linux Container Primitives", true],
      ["How Firecracker works", false],
      ["Multicast and the Markets", false],
    ].map(([title, active]) => (
      <li
        key={String(title)}
        className={cn(
          "flex h-7 items-center gap-2 px-2 text-[13px]",
          active ? "bg-foreground/[0.07]" : "text-muted-foreground",
        )}
        style={{ borderRadius: "var(--r-control)" }}
      >
        <span className="size-3 rounded-[3px] bg-primary/70" />
        {title}
      </li>
    ))}
  </ul>
);

export const SampleInput = () => (
  <div
    className="flex h-8 items-center px-3 text-[13px] text-muted-foreground ring-1 ring-border ring-inset"
    style={{ borderRadius: "var(--r-control)" }}
  >
    Filter cards
  </div>
);
