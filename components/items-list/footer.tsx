import React from "react";
import { useQueryClient } from "@tanstack/react-query";

import { importBookmarks } from "@/app/actions";
import { logout } from "@/app/logout/actions";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import type { Item } from "@/lib/types";

export const Footer = () => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [email, setEmail] = React.useState<string | null>(null);

  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null);
    });
  }, []);

  const handleExport = React.useCallback(() => {
    const items = queryClient.getQueryData<Item[]>(["items"]);
    if (!items || items.length === 0) return;
    const header = "type,title,url,tags,notes,read,created_at,updated_at";
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = items.map((i) =>
      [esc(i.type), esc(i.title), esc(i.url), esc(i.tags.map((t) => t.name).join("; ")), esc(i.notes ?? ""), i.type === "bookmark" ? "" : i.type === "reading-list" ? (i.read ? "true" : "false") : "", i.createdAt, i.updatedAt].join(","),
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
      <input
        ref={fileInputRef}
        type="file"
        accept=".html"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const html = await file.text();
          e.target.value = "";
          await importBookmarks(html);
          queryClient.invalidateQueries({ queryKey: ["items"] });
        }}
      />

      <div className="mt-8 flex items-center justify-center gap-3 text-xs text-muted-foreground/50 md:fixed md:bottom-4 md:left-4 md:mt-0 md:justify-start">
        <Button
          variant="link"
          className="text-muted-foreground/50 hover:text-muted-foreground p-0 h-auto"
          onClick={() => fileInputRef.current?.click()}
        >
          Import
        </Button>
        <span>·</span>
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
          onClick={() => void logout()}
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
