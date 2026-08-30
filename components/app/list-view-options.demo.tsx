import React from "react";

import { type Demo } from "@/components/system/demo";

import {
  type ListDensity,
  type ListGroupBy,
  type ListSortBy,
  ListViewOptions,
} from "./list-view-options";

const OptionsDemo = () => {
  const [showRead, setShowRead] = React.useState(true);
  const [groupBy, setGroupBy] = React.useState<ListGroupBy>("day");
  const [sortBy, setSortBy] = React.useState<ListSortBy>("created-desc");
  const [density, setDensity] = React.useState<ListDensity>("compact");
  return (
    <div className="flex flex-col gap-2">
      <ListViewOptions
        showRead={showRead}
        onShowReadChange={setShowRead}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        density={density}
        onDensityChange={setDensity}
      />
      <p className="text-micro text-muted-foreground">
        {showRead ? "showing read" : "hiding read"}, {groupBy}, {sortBy},{" "}
        {density}
      </p>
    </div>
  );
};

export const demo: Demo = {
  title: "List view options",
  description:
    "The icon-button row under a list's search bar: show-read toggle, group, sort, and density menus. Values and writes come from the caller.",
  render: () => <OptionsDemo />,
};
