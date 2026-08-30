import { Button } from "./button";
import { type Demo } from "./demo";
import {
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { Input } from "./input";

export const demo: Demo = {
  title: "Dialog",
  description:
    "Modal over a dimmed page, for destructive confirmations and short forms. The actions row is the only way out; no corner close button.",
  render: () => (
    <div className="flex gap-2">
      <Dialog>
        <DialogTrigger render={<Button variant="secondary" />}>
          Delete item
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Delete this item?</DialogTitle>
          <DialogDescription>
            Its notes and 4 flashcards go with it. This cannot be undone.
          </DialogDescription>
          <DialogActions>
            <DialogClose render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
            <DialogClose render={<Button variant="destructive" />}>
              Delete
            </DialogClose>
          </DialogActions>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger render={<Button variant="secondary" />}>
          Rename tag
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Rename tag</DialogTitle>
          <DialogDescription>Applies to 12 items.</DialogDescription>
          <label className="flex flex-col gap-1.5 pt-1">
            <span className="text-small font-medium text-muted-foreground">
              Name
            </span>
            <Input defaultValue="distributed systems" autoFocus />
          </label>
          <DialogActions>
            <DialogClose render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
            <DialogClose render={<Button variant="primary" />}>
              Save
            </DialogClose>
          </DialogActions>
        </DialogContent>
      </Dialog>
    </div>
  ),
};
