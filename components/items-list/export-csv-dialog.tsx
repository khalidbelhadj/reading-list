// Export-as-CSV dialog for the settings menu: owns the filename field state
// (reset to the dated default each time it opens) and the download trigger.
import { useQueryClient } from "@tanstack/react-query";
import React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

  const handleExportKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleExport();
      }
    },
    [handleExport],
  );

  const handleCancelExport = React.useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export as CSV</DialogTitle>
        </DialogHeader>
        <div className="flex h-8 items-center rounded-md bg-card px-2 ring-1 ring-foreground/10 focus-within:ring-foreground/25">
          <input
            autoFocus
            value={exportFilename}
            onChange={handleExportFilenameChange}
            onKeyDown={handleExportKeyDown}
            className="min-w-0 flex-1 bg-transparent text-xs outline-none"
          />
          <span className="pl-1 text-xs text-muted-foreground/60 select-none">
            .csv
          </span>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancelExport}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={!exportFilename.trim()}>
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
