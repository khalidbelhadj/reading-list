import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function HelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-0 p-4 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription className="sr-only">List of keyboard shortcuts</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs mt-3">
          <span className="text-muted-foreground text-[11px] font-medium col-span-2 mt-1 first:mt-0">Navigation</span>
          <kbd className="font-mono text-muted-foreground">j / k</kbd><span>Move down / up</span>
          <kbd className="font-mono text-muted-foreground">Ctrl+N / P</kbd><span>Move down / up</span>
          <kbd className="font-mono text-muted-foreground">Shift+J / K</kbd><span>Extend selection down / up</span>
          <kbd className="font-mono text-muted-foreground">Alt+J / K</kbd><span>Move item down / up</span>
          <kbd className="font-mono text-muted-foreground">Ctrl+Shift+N / P</kbd><span>Extend selection down / up</span>
          <kbd className="font-mono text-muted-foreground">g g</kbd><span>Go to first item</span>
          <kbd className="font-mono text-muted-foreground">G</kbd><span>Go to last item</span>
          <kbd className="font-mono text-muted-foreground">Ctrl+D / U</kbd><span>Half-page down / up</span>

          <span className="text-muted-foreground text-[11px] font-medium col-span-2 mt-2">Selection</span>
          <kbd className="font-mono text-muted-foreground">v</kbd><span>Toggle visual mode</span>

          <span className="text-muted-foreground text-[11px] font-medium col-span-2 mt-2">Actions</span>
          <kbd className="font-mono text-muted-foreground">Enter</kbd><span>Edit selected item</span>
          <kbd className="font-mono text-muted-foreground">o</kbd><span>Open URL in new tab</span>
          <kbd className="font-mono text-muted-foreground">x</kbd><span>Toggle read</span>
          <kbd className="font-mono text-muted-foreground">Space</kbd><span>Toggle read</span>
          <kbd className="font-mono text-muted-foreground">Cmd+Enter</kbd><span>Open URL in new tab</span>
          <kbd className="font-mono text-muted-foreground">d d</kbd><span>Delete selected</span>
          <kbd className="font-mono text-muted-foreground">Cmd+Backspace</kbd><span>Delete selected</span>
          <kbd className="font-mono text-muted-foreground">Cmd+V</kbd><span>Quick-add URL from clipboard</span>

          <span className="text-muted-foreground text-[11px] font-medium col-span-2 mt-2">Other</span>
          <kbd className="font-mono text-muted-foreground">/</kbd><span>Search</span>
          <kbd className="font-mono text-muted-foreground">1 / 2</kbd><span>Reading List / Bookmarks</span>
          <kbd className="font-mono text-muted-foreground">a</kbd><span>Add new item</span>
          <kbd className="font-mono text-muted-foreground">t</kbd><span>Toggle tags / bulk tag</span>
          <kbd className="font-mono text-muted-foreground">r</kbd><span>Toggle show read</span>
          <kbd className="font-mono text-muted-foreground">m</kbd><span>Move to other list (bulk)</span>
          <kbd className="font-mono text-muted-foreground">Escape</kbd><span>Close / clear selection</span>
          <kbd className="font-mono text-muted-foreground">?</kbd><span>Show this help</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
