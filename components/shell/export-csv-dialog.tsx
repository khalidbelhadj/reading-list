// Export-as-CSV dialog for the settings menu: owns the filename field state
// (reset to the dated default each time it opens) and the download trigger.
import { useQueryClient } from "@tanstack/react-query";
import React from "react";

import { Button } from "@/components/system/button";
import {
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/system/dialog";
import { Input } from "@/components/system/input";
import { defaultCsvFilename, downloadItemsCsv } from "@/lib/csv-export";

export const ExportCsvDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const queryClient = useQueryClient();
  const [exportFilename, setExportFilename] = React.useState(() =>
    defaultCsvFilename(),
  );

  // Re-seed the filename with the current date each time the dialog opens.
  React.useEffect(() => {
    if (open) setExportFilename(defaultCsvFilename());
  }, [open]);

  const handleExport = React.useCallback(() => {
    const trimmed = exportFilename.trim();
    if (!trimmed) return;
    downloadItemsCsv(queryClient, trimmed);
    onOpenChange(false);
  }, [queryClient, exportFilename, onOpenChange]);

  const handleExportFilenameChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      const stripped = value.toLowerCase().endsWith(".csv")
        ? value.slice(0, -4)
        : value;
      setExportFilename(stripped);
    },
    [],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle className="text-title">Export as CSV</DialogTitle>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            handleExport();
          }}
        >
          <div className="relative">
            <Input
              autoFocus
              value={exportFilename}
              onChange={handleExportFilenameChange}
              aria-label="Filename"
              className="pr-9"
            />
            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-small text-muted-foreground/60 select-none">
              .csv
            </span>
          </div>
          <DialogActions className="pt-0">
            <DialogClose render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button
              type="submit"
              variant="primary"
              disabled={!exportFilename.trim()}
            >
              Export
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
};
