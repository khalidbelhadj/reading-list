import { Button } from "./button";
import { type Demo } from "./demo";
import { Kbd } from "./kbd";

export const demo: Demo = {
  title: "Kbd",
  description: "Shortcut hints. Alone, beside a label, or inside a button.",
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
        <Kbd>Space</Kbd>
        <Kbd>Esc</Kbd>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary">
          Flip
          <Kbd>Space</Kbd>
        </Button>
        <Button variant="primary">
          Reveal
          <Kbd variant="on-primary">Space</Kbd>
        </Button>
      </div>
    </div>
  ),
};
