import { IconLetterCase, IconZoomIn } from "@tabler/icons-react";
import React from "react";

import { type Demo } from "./demo";
import { Field } from "./field";
import { NumberInput } from "./number-input";

const Example = () => {
  const [zoom, setZoom] = React.useState<number | null>(125);
  const [size, setSize] = React.useState<number | null>(13);
  const [cards, setCards] = React.useState<number | null>(20);
  return (
    <div className="flex flex-wrap items-end gap-4">
      <Field label="Zoom">
        <NumberInput
          value={zoom}
          onValueChange={setZoom}
          label={<IconZoomIn />}
          min={50}
          max={400}
          step={5}
          largeStep={25}
          format={{ style: "unit", unit: "percent" }}
          className="w-32"
        />
      </Field>
      <Field label="Text size">
        <NumberInput
          value={size}
          onValueChange={setSize}
          label={<IconLetterCase />}
          min={10}
          max={24}
          className="w-28"
        />
      </Field>
      <Field label="Cards per session">
        <NumberInput
          value={cards}
          onValueChange={setCards}
          label="Cards"
          min={5}
          max={200}
          step={5}
          className="w-36"
        />
      </Field>
      <Field label="Disabled">
        <NumberInput
          value={3}
          onValueChange={() => {}}
          label="Tabs"
          disabled
          className="w-28"
        />
      </Field>
    </div>
  );
};

export const demo: Demo = {
  title: "Number input",
  description:
    "A number with a handle: press the label and drag sideways to change it, click the chevrons to step, or type. Hold Shift while dragging or stepping for the large step.",
  render: () => <Example />,
};
