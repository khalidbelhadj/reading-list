import { type Demo } from "./demo";
import { Field } from "./field";
import { Input } from "./input";
import { Switch } from "./switch";

export const demo: Demo = {
  title: "Field",
  description:
    "Label, control, hint or error. Vertical for forms; horizontal for settings rows where the control sits on the right.",
  render: () => (
    <div className="grid max-w-sm gap-5">
      <Field label="Title">
        <Input defaultValue="Two Ways To Do Dynamic Dispatch" />
      </Field>
      <Field label="URL" hint="Paste a link and the title fills itself in.">
        <Input placeholder="https://" />
      </Field>
      <Field label="URL" error="That does not look like a link.">
        <Input aria-invalid defaultValue="not a url" />
      </Field>
      <div className="flex flex-col gap-2 pt-2">
        <Field label="Reviews in a new window" orientation="horizontal">
          <Switch defaultChecked />
        </Field>
        <Field
          label="Suggestions"
          hint="Needs the embedding index"
          orientation="horizontal"
        >
          <Switch disabled />
        </Field>
      </div>
    </div>
  ),
};
