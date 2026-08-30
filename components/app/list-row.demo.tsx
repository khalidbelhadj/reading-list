import {
  IconBrandYoutube,
  IconFileText,
  IconPinFilled,
} from "@tabler/icons-react";

import { Badge } from "@/components/system/badge";
import { type Demo } from "@/components/system/demo";

import { ListRow } from "./list-row";

export const demo: Demo = {
  title: "List row",
  description:
    "The reading list, recents and flashcard lists share this row. 28px, favicon, title, meta on the right.",
  render: () => (
    <div className="flex max-w-md flex-col gap-0.5">
      <ListRow
        leading={<IconBrandYoutube className="text-destructive" />}
        title="Linux Container Primitives: cgroups, namespaces, and more"
        meta="13m ago"
        trailing={<IconPinFilled className="size-3 text-muted-foreground" />}
      />
      <ListRow
        leading={<IconBrandYoutube className="text-destructive" />}
        title="How AWS's Firecracker virtual machines work"
        meta="22m ago"
        selected
      />
      <ListRow
        leading={<IconFileText />}
        title="[1908.01262] A systematic review of fuzzing"
        meta="2d ago"
        trailing={<Badge variant="accent">Due</Badge>}
      />
      <ListRow
        leading={<IconBrandYoutube className="text-destructive" />}
        title="What Really Happened at the Minab School Strike?"
        meta="6d ago"
        muted
      />
    </div>
  ),
};
