import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { logout } from "@/app/logout/actions";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useCurrentUser } from "@/lib/use-current-user";
import type { Item } from "@/lib/types";

export const Footer = () => {
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const email = user?.email ?? null;

  const logoutMutation = useMutation({
    mutationFn: () => logout(),
    onSuccess: () => queryClient.clear(),
  });

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

  return (
    <>
      <div className="mt-8 flex items-center justify-center gap-3 text-xs text-muted-foreground/50 md:fixed md:bottom-4 md:left-4 md:mt-0 md:justify-start">
        <Button
          variant="link"
          className="text-muted-foreground/50 hover:text-muted-foreground p-0 h-auto"
          onClick={handleExport}
        >
          Export
        </Button>
        <span>·</span>
        <Button
          variant="link"
          className="text-muted-foreground/50 hover:text-muted-foreground p-0 h-auto"
          onClick={() => logoutMutation.mutate()}
        >
          Log out
        </Button>
      </div>

      <div className="fixed bottom-4 right-4 flex items-center gap-3">
        {email && (
          <span className="text-xs text-muted-foreground/50">{email}</span>
        )}
        <ThemeToggle />
      </div>
    </>
  );
};
