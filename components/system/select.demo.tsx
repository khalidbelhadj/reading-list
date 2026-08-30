import React from "react";

import { type Demo } from "./demo";
import { Field } from "./field";
import { Select } from "./select";

type Sort = "created-desc" | "created-asc" | "updated-desc";

const Example = () => {
  const [sort, setSort] = React.useState<Sort>("created-desc");
  const [group, setGroup] = React.useState<"none" | "week" | "day" | null>(
    null,
  );
  return (
    <div className="grid max-w-sm gap-4">
      <Field label="Sort by">
        <Select
          value={sort}
          onValueChange={setSort}
          items={[
            { value: "created-desc", label: "Newest first" },
            { value: "created-asc", label: "Oldest first" },
            { value: "updated-desc", label: "Recently updated" },
          ]}
        />
      </Field>
      <Field label="Group">
        <Select
          value={group}
          onValueChange={setGroup}
          placeholder="No grouping"
          items={[
            { value: "none", label: "None" },
            { value: "week", label: "By week" },
            { value: "day", label: "By day" },
          ]}
        />
      </Field>
      <Field label="Disabled">
        <Select
          value="a"
          onValueChange={() => {}}
          disabled
          items={[{ value: "a", label: "Fixed" }]}
        />
      </Field>
    </div>
  );
};

export const demo: Demo = {
  title: "Select",
  description:
    "One of many, in a popup. Trigger matches Input; the list drops beneath it as a frost surface.",
  render: () => <Example />,
};
