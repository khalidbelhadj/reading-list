import React from "react";

import { type Demo } from "./demo";
import { HoverCard, useHoverAnchor } from "./hover-card";

const ROWS = [
  "A row with a short label",
  "Another row, whose card shows longer text than the row can hold",
  "A third row",
  "The fourth and last row",
];

const Example = () => {
  const { anchor, open, enter, leave } = useHoverAnchor();
  const [index, setIndex] = React.useState<number | null>(null);
  return (
    <div className="flex flex-col gap-0.5" onPointerLeave={leave}>
      {ROWS.map((row, rowIndex) => (
        <div
          key={row}
          className="flex h-row w-64 items-center rounded-control px-2 text-body hover:bg-foreground/[0.05]"
          onPointerEnter={(event) => {
            setIndex(rowIndex);
            enter(event.currentTarget);
          }}
        >
          <span className="fade-r">{row}</span>
        </div>
      ))}
      <HoverCard anchor={anchor} open={open}>
        <p className="text-body">{index === null ? "" : ROWS[index]}</p>
        <p className="pt-1 text-small text-muted-foreground">
          Row {index === null ? "" : index + 1} of 4
        </p>
      </HoverCard>
    </div>
  );
};

export const demo: Demo = {
  title: "Hover card",
  description:
    "Hover the rows. One frost card beside the hovered element that glides to the next one instead of blinking; a short delay before it first appears and a grace period on leaving.",
  render: () => <Example />,
};
