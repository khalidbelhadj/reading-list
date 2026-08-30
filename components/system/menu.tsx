import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { IconCheck, IconChevronRight } from "@tabler/icons-react";
import type React from "react";

import { cn } from "@/lib/utils";

// Menus: a dropdown from a trigger, or a context menu on right-click. Both
// share the same frost popup and items, so they are one component with two
// roots. Items take an optional leading icon and trailing shortcut. Menus sit
// denser than lists on purpose: 24px items, so a menu reads as one gesture.

export const Menu = (props: MenuPrimitive.Root.Props) => (
  <MenuPrimitive.Root {...props} />
);

export const MenuTrigger = (props: MenuPrimitive.Trigger.Props) => (
  <MenuPrimitive.Trigger data-slot="menu-trigger" {...props} />
);

export const ContextMenu = (props: ContextMenuPrimitive.Root.Props) => (
  <ContextMenuPrimitive.Root {...props} />
);

export const ContextMenuTrigger = (
  props: ContextMenuPrimitive.Trigger.Props,
) => (
  <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
);

const POPUP =
  "glass min-w-40 origin-(--transform-origin) rounded-control p-1 text-foreground transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0";

export const MenuContent = ({
  align = "start",
  side = "bottom",
  sideOffset = 4,
  className,
  children,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, "align" | "side" | "sideOffset">) => (
  <MenuPrimitive.Portal>
    <MenuPrimitive.Positioner
      align={align}
      side={side}
      sideOffset={sideOffset}
      className="z-50 outline-none"
    >
      <MenuPrimitive.Popup
        data-slot="menu-content"
        className={cn(POPUP, className)}
        {...props}
      >
        <div className="flex max-h-(--available-height) flex-col gap-px overflow-y-auto">
          {children}
        </div>
      </MenuPrimitive.Popup>
    </MenuPrimitive.Positioner>
  </MenuPrimitive.Portal>
);

const ITEM =
  "flex h-6 cursor-default items-center gap-2 rounded-[calc(var(--r-control)-4px)] px-2 text-body outline-none select-none data-highlighted:bg-foreground/[0.07] data-disabled:opacity-50 [&>svg]:size-3.5 [&>svg]:shrink-0 [&>svg]:text-muted-foreground";

export const MenuItem = ({
  icon,
  shortcut,
  destructive,
  className,
  children,
  ...props
}: MenuPrimitive.Item.Props & {
  icon?: React.ReactNode;
  shortcut?: React.ReactNode;
  destructive?: boolean;
}) => (
  <MenuPrimitive.Item
    data-slot="menu-item"
    className={cn(
      ITEM,
      destructive &&
        "text-destructive data-highlighted:bg-destructive/10 [&>svg]:text-destructive",
      className,
    )}
    {...props}
  >
    {icon}
    <span className="min-w-0 flex-1 truncate">{children}</span>
    {shortcut && (
      <span className="ml-4 text-small text-muted-foreground">{shortcut}</span>
    )}
  </MenuPrimitive.Item>
);

// A toggleable menu item: check mark when on, reserved gutter when off, so
// labels never shift. Stays open on click (toggles read as adjustments, not
// commands); pass closeOnClick to override.
export const MenuCheckboxItem = ({
  icon,
  className,
  children,
  ...props
}: MenuPrimitive.CheckboxItem.Props & { icon?: React.ReactNode }) => (
  <MenuPrimitive.CheckboxItem
    data-slot="menu-checkbox-item"
    closeOnClick={false}
    className={cn(ITEM, className)}
    {...props}
  >
    {icon}
    <span className="min-w-0 flex-1 truncate">{children}</span>
    <MenuPrimitive.CheckboxItemIndicator
      keepMounted
      className="flex w-3.5 justify-center data-[unchecked]:opacity-0"
    >
      <IconCheck className="size-3.5 text-foreground" />
    </MenuPrimitive.CheckboxItemIndicator>
  </MenuPrimitive.CheckboxItem>
);

// A nested menu: the trigger reads as an item with a chevron; the submenu
// opens beside it on hover or arrow-right, wearing the same frost popup.
export const MenuSub = (props: MenuPrimitive.SubmenuRoot.Props) => (
  <MenuPrimitive.SubmenuRoot {...props} />
);

export const MenuSubTrigger = ({
  icon,
  className,
  children,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props & { icon?: React.ReactNode }) => (
  <MenuPrimitive.SubmenuTrigger
    data-slot="menu-sub-trigger"
    className={cn(ITEM, className)}
    {...props}
  >
    {icon}
    <span className="min-w-0 flex-1 truncate">{children}</span>
    <IconChevronRight className="size-3.5 text-muted-foreground" />
  </MenuPrimitive.SubmenuTrigger>
);

export const MenuSubContent = ({
  className,
  children,
  ...props
}: MenuPrimitive.Popup.Props) => (
  <MenuPrimitive.Portal>
    <MenuPrimitive.Positioner
      sideOffset={2}
      alignOffset={-4}
      className="z-50 outline-none"
    >
      <MenuPrimitive.Popup
        data-slot="menu-content"
        className={cn(POPUP, className)}
        {...props}
      >
        <div className="flex max-h-(--available-height) flex-col gap-px overflow-y-auto">
          {children}
        </div>
      </MenuPrimitive.Popup>
    </MenuPrimitive.Positioner>
  </MenuPrimitive.Portal>
);

export const MenuSeparator = ({
  className,
  ...props
}: MenuPrimitive.Separator.Props) => (
  <MenuPrimitive.Separator
    data-slot="menu-separator"
    className={cn("my-1 h-px bg-foreground/10", className)}
    {...props}
  />
);

export const MenuLabel = ({
  className,
  ...props
}: MenuPrimitive.GroupLabel.Props) => (
  <MenuPrimitive.GroupLabel
    data-slot="menu-label"
    className={cn(
      "px-2 pt-1 pb-0.5 text-micro font-medium text-muted-foreground/80",
      className,
    )}
    {...props}
  />
);

export const MenuGroup = (props: MenuPrimitive.Group.Props) => (
  <MenuPrimitive.Group data-slot="menu-group" {...props} />
);
