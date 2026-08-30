import { Button } from "./button";
import { type Demo } from "./demo";
import { Kbd } from "./kbd";
import {
  Popover,
  PopoverActions,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "./popover";

export const demo: Demo = {
  title: "Popover",
  description:
    "A quick confirm or a compact form anchored to its trigger. For anything bigger, use Dialog.",
  render: () => (
    <Popover>
      <PopoverTrigger render={<Button variant="secondary" />}>
        Review 110
        <Kbd>R</Kbd>
      </PopoverTrigger>
      <PopoverContent>
        <PopoverTitle>Review 110 cards?</PopoverTitle>
        <PopoverDescription>
          Runs in a new window. You can end the session at any time.
        </PopoverDescription>
        <PopoverActions>
          <PopoverClose render={<Button variant="ghost" />}>
            Not now
          </PopoverClose>
          <Button variant="primary">Start</Button>
        </PopoverActions>
      </PopoverContent>
    </Popover>
  ),
};
