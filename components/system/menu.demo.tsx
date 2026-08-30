import {
  IconCopy,
  IconDots,
  IconExternalLink,
  IconPin,
  IconTrash,
} from "@tabler/icons-react";

import { Button } from "./button";
import { type Demo } from "./demo";
import {
  ContextMenu,
  ContextMenuTrigger,
  Menu,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "./menu";
import { Surface } from "./surface";

const Items = () => (
  <>
    <MenuGroup>
      <MenuLabel>Item</MenuLabel>
      <MenuItem icon={<IconExternalLink />} shortcut="⌘O">
        Open link
      </MenuItem>
      <MenuItem icon={<IconPin />} shortcut="P">
        Pin
      </MenuItem>
      <MenuItem icon={<IconCopy />}>Copy link</MenuItem>
    </MenuGroup>
    <MenuSeparator />
    <MenuItem icon={<IconTrash />} shortcut="⌘⌫" destructive>
      Delete
    </MenuItem>
  </>
);

export const demo: Demo = {
  title: "Menu",
  description:
    "Dropdown from a trigger, or a context menu on right-click. Same frost popup, 24px items (denser than lists), icon left, shortcut right, destructive last.",
  render: () => (
    <div className="flex items-start gap-6">
      <Menu>
        <MenuTrigger
          render={
            <Button size="icon-md" variant="secondary" aria-label="More" />
          }
        >
          <IconDots />
        </MenuTrigger>
        <MenuContent>
          <Items />
        </MenuContent>
      </Menu>

      <ContextMenu>
        <ContextMenuTrigger
          render={
            <Surface
              padding="sm"
              className="flex h-20 w-64 items-center justify-center text-body text-muted-foreground select-none"
            />
          }
        >
          Right-click here
        </ContextMenuTrigger>
        <MenuContent>
          <Items />
        </MenuContent>
      </ContextMenu>
    </div>
  ),
};
