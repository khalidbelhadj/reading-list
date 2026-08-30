import {
  IconChevronDown,
  IconLayoutList,
  IconLayoutRows,
  IconMinus,
  IconPlus,
} from "@tabler/icons-react";

import { Button } from "./button";
import { ButtonGroup } from "./button-group";
import { type Demo } from "./demo";

export const demo: Demo = {
  title: "Button group",
  description:
    "Buttons that act as one control. Corners join; a hairline of page colour separates them.",
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <ButtonGroup>
        <Button variant="primary">Review 110</Button>
        <Button
          variant="primary"
          size="icon-md"
          aria-label="More review options"
        >
          <IconChevronDown />
        </Button>
      </ButtonGroup>
      <ButtonGroup>
        <Button size="icon-md" aria-label="Compact">
          <IconLayoutList />
        </Button>
        <Button size="icon-md" aria-label="Cozy">
          <IconLayoutRows />
        </Button>
      </ButtonGroup>
      <ButtonGroup>
        <Button size="icon-sm" aria-label="Zoom out">
          <IconMinus />
        </Button>
        <Button size="sm">100%</Button>
        <Button size="icon-sm" aria-label="Zoom in">
          <IconPlus />
        </Button>
      </ButtonGroup>
    </div>
  ),
};
