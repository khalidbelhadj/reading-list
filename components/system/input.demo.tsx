import { IconLink, IconSearch } from "@tabler/icons-react";

import { type Demo } from "./demo";
import { Field } from "./field";
import { Input } from "./input";
import { Kbd } from "./kbd";

export const demo: Demo = {
  title: "Input",
  description:
    "A quiet fill at rest, ring on focus. Leading and trailing slots hold an icon, a key cap or a unit inside the field.",
  render: () => (
    <div className="grid max-w-sm gap-4">
      <Input
        placeholder="Untitled"
        defaultValue="Two Ways To Do Dynamic Dispatch"
      />
      <Input
        leading={<IconSearch />}
        placeholder="Search"
        trailing={<Kbd>⌘K</Kbd>}
      />
      <Input leading={<IconLink />} placeholder="https://" />
      <Input
        defaultValue="1.25"
        trailing={<span className="text-small">×</span>}
        className="w-24"
      />
      <Field label="Invalid">
        <Input aria-invalid defaultValue="not a url" />
      </Field>
      <Field label="Disabled">
        <Input disabled defaultValue="Read only" />
      </Field>
    </div>
  ),
};
