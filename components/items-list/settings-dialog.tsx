"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  IconDownload,
  IconLogout,
  IconMoon,
  IconSettings,
  IconSun,
} from "@tabler/icons-react";

import { logout } from "@/app/logout/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/lib/use-current-user";
import { downloadItemsCsv, defaultCsvFilename } from "@/lib/csv-export";

export const SettingsMenu = () => {
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const email = user?.email ?? null;
  const [dark, setDark] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [exportFilename, setExportFilename] = React.useState(
    defaultCsvFilename(),
  );

  const logoutMutation = useMutation({
    mutationFn: () => logout(),
    onSuccess: () => queryClient.clear(),
  });

  const toggleTheme = React.useCallback(() => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  const openExport = React.useCallback(() => {
    setExportFilename(defaultCsvFilename());
    setExportOpen(true);
  }, []);

  const handleExport = React.useCallback(() => {
    const trimmed = exportFilename.trim();
    if (!trimmed) return;
    downloadItemsCsv(queryClient, trimmed);
    setExportOpen(false);
  }, [queryClient, exportFilename]);

  React.useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
          >
            <IconSettings />
          </Button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={4} className="min-w-48">
        {mounted && email && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem closeOnClick={false} onClick={toggleTheme}>
          {dark ? <IconSun /> : <IconMoon />}
          {dark ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openExport}>
          <IconDownload />
          Export as CSV
        </DropdownMenuItem>
        {mounted && email && (
          <DropdownMenuItem onClick={() => logoutMutation.mutate()}>
            <IconLogout />
            Log out
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export as CSV</DialogTitle>
          </DialogHeader>
          <input
            autoFocus
            value={exportFilename}
            onChange={(e) => setExportFilename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleExport();
              }
            }}
            className="h-8 rounded-md bg-card px-2 text-xs outline-none ring-1 ring-foreground/10 focus:ring-foreground/25"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={!exportFilename.trim()}>
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DropdownMenu>
  );
};
