import { Button } from "./button";
import { type Demo } from "./demo";
import { Spinner } from "./spinner";

export const demo: Demo = {
  title: "Spinner",
  description:
    "Inline progress. Inside a button it replaces the icon and the button stays disabled.",
  render: () => (
    <div className="flex items-center gap-3">
      <Spinner />
      <Button variant="primary" disabled>
        <Spinner />
        Starting
      </Button>
      <Button variant="secondary" disabled>
        <Spinner />
        Saving
      </Button>
    </div>
  ),
};
