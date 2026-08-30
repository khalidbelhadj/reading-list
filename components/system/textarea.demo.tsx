import { type Demo } from "./demo";
import { Field } from "./field";
import { Textarea } from "./textarea";

export const demo: Demo = {
  title: "Textarea",
  description:
    "For short free text (a card's back, a note). Long-form notes use the editor.",
  render: () => (
    <div className="grid max-w-sm gap-4">
      <Field label="Back">
        <Textarea
          rows={3}
          placeholder="The answer"
          defaultValue="The size and alignment of the concrete type, and a drop pointer."
        />
      </Field>
      <Field label="Disabled">
        <Textarea rows={2} disabled defaultValue="Read only" />
      </Field>
    </div>
  ),
};
