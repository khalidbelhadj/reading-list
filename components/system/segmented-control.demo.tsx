import React from "react";

import { type Demo } from "./demo";
import { SegmentedControl } from "./segmented-control";

const Example = () => {
  const [density, setDensity] = React.useState<"compact" | "cozy">("compact");
  const [theme, setTheme] = React.useState<"system" | "light" | "dark">(
    "system",
  );
  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        aria-label="Density"
        value={density}
        onValueChange={setDensity}
        options={[
          { value: "compact", label: "Compact" },
          { value: "cozy", label: "Cozy" },
        ]}
      />
      <SegmentedControl
        aria-label="Theme"
        value={theme}
        onValueChange={setTheme}
        options={[
          { value: "system", label: "System" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
      />
      <SegmentedControl
        aria-label="Mode"
        value="due"
        onValueChange={() => {}}
        options={[
          { value: "due", label: "Due" },
          { value: "new", label: "New" },
          { value: "cram", label: "Cram", disabled: true },
        ]}
      />
    </div>
  );
};

export const demo: Demo = {
  title: "Segmented control",
  description:
    "A one-of-few choice shown in full. Two to five options; beyond that, use Select.",
  render: () => <Example />,
};
