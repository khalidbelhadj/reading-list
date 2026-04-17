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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/lib/use-current-user";
import type { Item } from "@/lib/types";

export const SettingsMenu = () => {
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const email = user?.email ?? null;
  const [dark, setDark] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

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

  const handleExport = React.useCallback(() => {
    const items = queryClient.getQueryData<Item[]>(["items"]);
    if (!items || items.length === 0) return;
    const header = "type,title,url,tags,notes,read,created_at,updated_at";
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = items.map((i) =>
      [esc(i.type), esc(i.title), esc(i.url), esc(i.tags.map((t) => t.name).join("; ")), esc(i.notes ?? ""), i.read ? "true" : "false", i.createdAt, i.updatedAt].join(","),
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `reading-list-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [queryClient]);

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
        <DropdownMenuItem onClick={handleExport}>
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
    </DropdownMenu>
  );
};
