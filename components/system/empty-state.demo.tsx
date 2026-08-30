import { Button } from "./button";
import { type Demo } from "./demo";
import { EmptyState } from "./empty-state";
import { Surface } from "./surface";

export const demo: Demo = {
  title: "Empty state",
  description:
    "Empty, error and not-found share one block. Say what is missing, then the one thing to do about it.",
  render: () => (
    <div className="grid gap-4 md:grid-cols-3">
      <Surface className="flex min-h-40 items-center justify-center">
        <EmptyState
          title="No flashcards yet"
          description="Cards you add to items will collect here."
        />
      </Surface>
      <Surface className="flex min-h-40 items-center justify-center">
        <EmptyState
          tone="error"
          title="Couldn't load a card"
          description="Try again in a moment."
          action={<Button variant="secondary">Retry</Button>}
        />
      </Surface>
      <Surface className="flex min-h-40 items-center justify-center">
        <EmptyState
          title="Item not found"
          description="It may have been deleted on another device."
          action={<Button variant="secondary">Back home</Button>}
        />
      </Surface>
    </div>
  ),
};
