import React from "react";

import { Button } from "./button";
import { CommandPalette } from "./command-palette";
import { type Demo } from "./demo";

const FRUIT = [
  "Apple",
  "Blackberry",
  "Cherry",
  "Damson",
  "Elderberry",
  "Fig",
  "Gooseberry",
];

const PaletteDemo = () => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [picked, setPicked] = React.useState<string | null>(null);
  const entries = FRUIT.filter((fruit) =>
    fruit.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <div className="flex items-center gap-3">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Open palette
      </Button>
      {picked && (
        <span className="text-small text-muted-foreground">
          Picked {picked}
        </span>
      )}
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        query={query}
        onQueryChange={setQuery}
        entries={entries}
        getKey={(fruit) => fruit}
        onPick={setPicked}
        placeholder="Search fruit"
        header={query.trim() ? undefined : "All fruit"}
        renderEntry={(fruit, selected) => (
          <div
            className={
              selected
                ? "flex h-row items-center rounded-control bg-foreground/[0.07] px-2 text-body"
                : "flex h-row items-center rounded-control px-2 text-body"
            }
          >
            {fruit}
          </div>
        )}
      />
    </div>
  );
};

export const demo: Demo = {
  title: "Command palette",
  description:
    "A ⌘K sheet: search input over a keyboard-navigable list. Arrows or Ctrl+N/P move, Enter picks, Escape closes; the caller owns the query and entries.",
  render: () => <PaletteDemo />,
};
