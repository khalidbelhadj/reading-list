import { IconClock } from "@tabler/icons-react";

import { Badge } from "./badge";
import { type Demo } from "./demo";

export const demo: Demo = {
  title: "Badge",
  description:
    "Neutral for state, accent for the one state that matters now, outline for tags.",
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>New</Badge>
      <Badge variant="accent">Due</Badge>
      <Badge variant="accent">
        <IconClock />
        110 due
      </Badge>
      <Badge variant="outline">distributed systems</Badge>
      <Badge variant="outline">rust</Badge>
    </div>
  ),
};
