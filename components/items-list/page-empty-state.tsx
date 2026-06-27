// Minimal text-only placeholder for standalone pages — matches the small,
// muted "nothing here" / error states used in the items list.
export const PageEmptyState = ({ message }: { message: string }) => (
  <div className="flex h-full items-center justify-center px-1 py-6 text-center text-xs text-muted-foreground">
    {message}
  </div>
);
