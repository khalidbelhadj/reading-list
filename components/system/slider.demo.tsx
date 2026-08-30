import React from "react";

import { type Demo } from "./demo";
import { Field } from "./field";
import { Slider } from "./slider";

const single = (next: number | readonly number[], fallback: number) =>
  Array.isArray(next) ? (next[0] ?? fallback) : (next as number);

const Example = () => {
  const [zoom, setZoom] = React.useState(125);
  const [size, setSize] = React.useState(3);
  return (
    <div className="grid max-w-sm gap-5">
      <Field label={`Zoom ${zoom}%`}>
        <Slider
          value={zoom}
          onValueChange={(next) => setZoom(single(next, zoom))}
          min={50}
          max={200}
          step={5}
        />
      </Field>
      <Field label={`Text size ${size} of 5`}>
        <Slider
          value={size}
          onValueChange={(next) => setSize(single(next, size))}
          min={1}
          max={5}
          step={1}
          marks
        />
      </Field>
      <Field label="Disabled">
        <Slider defaultValue={40} disabled />
      </Field>
    </div>
  );
};

export const demo: Demo = {
  title: "Slider",
  description:
    "One value on a range. Thick track, accent fill, a thumb the height of the track; stepped sliders show a dot on every point.",
  render: () => <Example />,
};
