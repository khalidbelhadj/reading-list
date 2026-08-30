import { IconCards, IconCheck, IconLink } from "@tabler/icons-react";

import { Button } from "./button";
import { type Demo } from "./demo";
import { Notification, notify } from "./toast";

export const demo: Demo = {
  title: "Notification",
  description:
    "Bottom-right, frost, the surface radius. Icon, bold title with a quiet meta, one line of description, text actions, close in the corner. Click to try the live ones.",
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() =>
            notify({
              icon: <IconCheck className="text-primary" />,
              title: "Marked as read",
              meta: "now",
            })
          }
        >
          Plain
        </Button>
        <Button
          onClick={() =>
            notify({
              icon: <IconCards className="text-primary" />,
              title: "110 cards due",
              meta: "2m ago",
              description: "Your daily review is waiting.",
              actions: [
                { label: "Later" },
                { label: "Start review", primary: true },
              ],
            })
          }
        >
          With actions
        </Button>
        <Button
          onClick={() =>
            notify({
              icon: <IconLink className="text-muted-foreground" />,
              title: "Link copied",
              meta: "now",
              description: "youtube.com/watch?v=x1npPrzyKfs",
            })
          }
        >
          With description
        </Button>
        <Button
          onClick={() =>
            notify({
              tone: "error",
              title: "Could not save",
              meta: "now",
              description:
                "The server did not respond. Your edit is still here.",
              actions: [{ label: "Retry", primary: true }],
            })
          }
        >
          Error
        </Button>
      </div>
      <div className="flex w-fit flex-col gap-2">
        <Notification
          icon={<IconCards className="text-primary" />}
          title="110 cards due"
          meta="2m ago"
          description="Your daily review is waiting."
          actions={[
            { label: "Later" },
            { label: "Start review", primary: true },
          ]}
          onClose={() => {}}
        />
      </div>
    </div>
  ),
};
