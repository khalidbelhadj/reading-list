import { IconCards, IconHome, IconList } from "@tabler/icons-react";

import { type Demo } from "@/components/system/demo";

import { SidebarItem } from "./sidebar-item";

export const demo: Demo = {
  title: "Sidebar item",
  description:
    "Navigation rows for the frost sidebar: 24px tall (denser than list rows), icon, label, trailing count. One active at a time.",
  render: () => (
    <div className="glass flex w-56 flex-col gap-0.5 rounded-surface p-2">
      <SidebarItem href="#" icon={<IconHome />} label="Home" active />
      <SidebarItem
        href="#"
        icon={<IconCards />}
        label="Flashcards"
        count={155}
      />
      <SidebarItem
        href="#"
        icon={<IconList />}
        label="Reading list"
        count={198}
      />
    </div>
  ),
};
