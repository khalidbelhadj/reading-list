import { type Demo } from "./demo";
import { Field } from "./field";
import { Switch } from "./switch";

export const demo: Demo = {
  title: "Switch",
  description:
    "A setting that takes effect immediately. Label on the left, control on the right, one per row.",
  render: () => (
    <div className="flex max-w-sm flex-col gap-2">
      <Field label="Reviews in a new window" orientation="horizontal">
        <Switch defaultChecked />
      </Field>
      <Field label="Show read items" orientation="horizontal">
        <Switch />
      </Field>
      <Field
        label="Suggestions"
        hint="Needs the embedding index"
        orientation="horizontal"
      >
        <Switch disabled />
      </Field>
    </div>
  ),
};
