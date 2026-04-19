"use client";

import React from "react";
import { cn } from "@/lib/utils";

type AppTabsProps<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  tabs: { label: string; value: T }[];
  variant?: "inline" | "text";
};

export function AppTabs<T extends string>({ value, onValueChange, tabs, variant }: AppTabsProps<T>) {
  if (variant === "text") {
    return (
      <div className="flex gap-3 text-sm">
        {tabs.map((tab) => (
          <TabButton
            key={tab.value}
            tab={tab}
            onValueChange={onValueChange}
            className={cn(
              "font-content transition-colors cursor-pointer",
              value === tab.value
                ? "text-foreground font-medium"
                : "text-muted-foreground/50 hover:text-muted-foreground",
            )}
          />
        ))}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className="flex gap-1 text-xs">
        {tabs.map((tab) => (
          <TabButton
            key={tab.value}
            tab={tab}
            onValueChange={onValueChange}
            className={cn(
              "px-2 py-1 rounded-md font-medium transition-colors cursor-pointer",
              value === tab.value
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          />
        ))}
      </div>
    );
  }

  return null;
}

function TabButton<T extends string>({
  tab,
  onValueChange,
  className,
}: {
  tab: { label: string; value: T };
  onValueChange: (value: T) => void;
  className: string;
}) {
  const handleClick = React.useCallback(() => {
    onValueChange(tab.value);
  }, [tab.value, onValueChange]);

  return (
    <button
      key={tab.value}
      type="button"
      onClick={handleClick}
      className={className}
    >
      {tab.label}
    </button>
  );
}
