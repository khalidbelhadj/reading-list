import React from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { cn } from "@/lib/utils";
import { LIST_ICONS } from "@/lib/list-icons";

export const IconPicker = ({
  open,
  onOpenChange,
  anchor,
  selectedIcon,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: HTMLElement | null;
  selectedIcon: string | null;
  onSelect: (iconName: string | null) => void;
}) => {
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      // Defer focus so the popover is mounted and positioned first.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return LIST_ICONS;
    return LIST_ICONS.filter(
      (entry) =>
        entry.name.toLowerCase().includes(needle) ||
        entry.keywords.includes(needle),
    );
  }, [query]);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger
        render={<span className="hidden" />}
        nativeButton={false}
      />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          anchor={anchor}
          sideOffset={6}
          align="start"
          className="isolate z-50 outline-none"
        >
          <PopoverPrimitive.Popup
            className="z-50 w-64 rounded-lg bg-popover text-popover-foreground shadow-depth-floating ring-1 ring-foreground/10 outline-none p-2 flex flex-col gap-2"
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search icons..."
              className="h-7 px-2 rounded-md bg-muted text-xs outline-none placeholder:text-muted-foreground/60"
            />
            <div className="grid grid-cols-7 gap-1 max-h-56 overflow-y-auto">
              {filtered.map((entry) => {
                const Icon = entry.Component;
                const isSelected = selectedIcon === entry.name;
                return (
                  <button
                    key={entry.name}
                    type="button"
                    title={entry.name}
                    onClick={() => {
                      onSelect(entry.name);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "size-7 flex items-center justify-center rounded-md cursor-pointer outline-none transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-7 py-4 text-center text-xs text-muted-foreground">
                  No matches
                </div>
              )}
            </div>
            {selectedIcon && (
              <button
                type="button"
                onClick={() => {
                  onSelect(null);
                  onOpenChange(false);
                }}
                className="text-[0.65rem] text-muted-foreground hover:text-foreground cursor-pointer outline-none text-left px-1"
              >
                Reset to default
              </button>
            )}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
};
