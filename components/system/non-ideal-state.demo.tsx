import { Button } from "@/components/system/button";
import { type Demo } from "@/components/system/demo";

import { NonIdealState } from "./non-ideal-state";

export const demo: Demo = {
  title: "Non-ideal state",
  description:
    "Title + faint description + actions, behind every empty, error, and not-found surface. Standalone pages use the lg size (and fullPage, not shown here); embedded empty states use sm.",
  render: () => (
    <div className="flex flex-col gap-8">
      <NonIdealState
        title="Page not found"
        description="The page you are looking for does not exist or has moved."
        actions={<Button variant="primary">Back to your list</Button>}
      />
      <NonIdealState
        size="sm"
        tone="error"
        title="Something went wrong"
        description="Could not load items."
        actions={
          <Button variant="secondary" size="sm">
            Retry
          </Button>
        }
      />
    </div>
  ),
};
