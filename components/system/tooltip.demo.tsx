import { IconPin, IconTrash } from "@tabler/icons-react";

import { Button } from "./button";
import { type Demo } from "./demo";
import { Kbd } from "./kbd";
import { Tooltip } from "./tooltip";

export const demo: Demo = {
  title: "Tooltip",
  description:
    "Hover the buttons. Flat solid fill, small text, optional key cap; never the only place a label lives.",
  render: () => (
    <div className="flex items-center gap-2">
      <Tooltip content="Pin to the top">
        <Button size="icon-md" variant="ghost" aria-label="Pin">
          <IconPin />
        </Button>
      </Tooltip>
      <Tooltip
        content={
          <>
            Delete
            <Kbd>⌘⌫</Kbd>
          </>
        }
      >
        <Button size="icon-md" variant="ghost" aria-label="Delete">
          <IconTrash />
        </Button>
      </Tooltip>
      <Tooltip content="Opens in a new window" side="bottom">
        <Button variant="secondary">Review</Button>
      </Tooltip>
    </div>
  ),
};
