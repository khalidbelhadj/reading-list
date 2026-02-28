"use client";

import React from "react";
import { cn } from "@/lib/utils";

type TabsProps = {
  value: string;
  onValueChange: (value: string) => void;
  tabs: { label: string; value: string }[];
  variant?: "inline" | "text";
};

export function Tabs({ value, onValueChange, tabs, variant }: TabsProps) {
  if (variant === "text") {
    return (
      <div className="flex gap-3 text-sm">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => onValueChange(tab.value)}
            className={cn(
              "transition-colors cursor-pointer",
              value === tab.value
                ? "text-foreground font-medium"
                : "text-muted-foreground/50 hover:text-muted-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className="flex gap-1 text-xs">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => onValueChange(tab.value)}
            className={cn(
              "px-2 py-1 rounded-md font-medium transition-colors cursor-pointer",
              value === tab.value
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    );
  }

  return null;
}
