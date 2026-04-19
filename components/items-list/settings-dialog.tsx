"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  IconDownload,
  IconEdit,
  IconLogout,
  IconMoon,
  IconSettings,
  IconSun,
  IconTypography,
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/lib/use-current-user";
import { downloadItemsCsv, defaultCsvFilename } from "@/lib/csv-export";
import { CopyPromptsDialog } from "./copy-prompts-dialog";

type FontKey = "dm-sans" | "noto-sans" | "source-serif-4";

const FONT_VALUES: Record<FontKey, string> = {
  "dm-sans": '"DM Sans Variable", sans-serif',
  "noto-sans": '"Noto Sans Variable", sans-serif',
  "source-serif-4": '"Source Serif 4 Variable", serif',
};

const FONT_LABELS: Record<FontKey, string> = {
  "dm-sans": "DM Sans",
  "noto-sans": "Noto Sans",
  "source-serif-4": "Source Serif 4",
};

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
  const [sansFont, setSansFont] = React.useState<FontKey>("dm-sans");
  const [contentFont, setContentFont] = React.useState<FontKey>("dm-sans");
  const [promptsOpen, setPromptsOpen] = React.useState(false);

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

  const handleLogout = React.useCallback(() => {
    logoutMutation.mutate();
  }, [logoutMutation]);

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
    setExportOpen(false);
  }, []);

  const openPrompts = React.useCallback(() => setPromptsOpen(true), []);

  const handleSansFontChange = React.useCallback((value: string) => {
    const key = value as FontKey;
    setSansFont(key);
    localStorage.setItem("font-sans", key);
    document.documentElement.style.setProperty(
      "--font-sans",
      FONT_VALUES[key],
    );
  }, []);

  const handleContentFontChange = React.useCallback((value: string) => {
    const key = value as FontKey;
    setContentFont(key);
    localStorage.setItem("font-content", key);
    document.documentElement.style.setProperty(
      "--font-content",
      FONT_VALUES[key],
    );
  }, []);

  React.useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
    const storedSans = localStorage.getItem("font-sans") as FontKey | null;
    const storedContent = localStorage.getItem("font-content") as FontKey | null;
    if (storedSans && storedSans in FONT_VALUES) setSansFont(storedSans);
    if (storedContent && storedContent in FONT_VALUES) setContentFont(storedContent);
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
        <DropdownMenuItem onClick={openPrompts}>
          <IconEdit />
          Edit copy prompts
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <IconTypography />
            Body font
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={sansFont}
              onValueChange={handleSansFontChange}
            >
              {(Object.keys(FONT_VALUES) as FontKey[]).map((key) => (
                <DropdownMenuRadioItem key={key} value={key}>
                  {FONT_LABELS[key]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <IconTypography />
            Content font
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={contentFont}
              onValueChange={handleContentFontChange}
            >
              {(Object.keys(FONT_VALUES) as FontKey[]).map((key) => (
                <DropdownMenuRadioItem key={key} value={key}>
                  {FONT_LABELS[key]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {mounted && email && (
          <DropdownMenuItem onClick={handleLogout}>
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
          <div className="flex h-8 items-center rounded-md bg-card px-2 ring-1 ring-foreground/10 focus-within:ring-foreground/25">
            <input
              autoFocus
              value={exportFilename}
              onChange={handleExportFilenameChange}
              onKeyDown={handleExportKeyDown}
              className="flex-1 min-w-0 bg-transparent text-xs outline-none"
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

      <CopyPromptsDialog open={promptsOpen} onOpenChange={setPromptsOpen} />
    </DropdownMenu>
  );
};
