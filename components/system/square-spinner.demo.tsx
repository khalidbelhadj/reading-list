import { type Demo } from "./demo";
import { SquareSpinner } from "./square-spinner";

export const demo: Demo = {
  title: "Square spinner",
  description:
    "Four dots pulsing clockwise. For longer-lived waits with their own presence, like an agent working; inline button progress stays with Spinner.",
  render: () => <SquareSpinner />,
};
