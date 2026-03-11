import React from "react";

import { useStore } from "@/lib/store";
import { importBookmarks } from "@/app/actions";
import { logout } from "@/app/logout/actions";

export function Footer({
  setHelpOpen,
}: {
  setHelpOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const store = useStore();

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
          // Import is non-optimistic: call server action directly, then fullSync
          await importBookmarks(html);
          await store.fullSync();
        }}
      />

      <div className="mt-8 flex items-center justify-center gap-3 text-xs text-muted-foreground/50 md:fixed md:bottom-4 md:left-4 md:mt-0 md:justify-start">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="hover:text-muted-foreground transition-colors cursor-pointer"
        >
          Import
        </button>
        <span>·</span>
        <button
          type="button"
          onClick={() => {
            const items = store.getAllItems();
            if (items.length === 0) return;
            const header = "type,title,url,tags,notes,read,created_at,updated_at";
            const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
            const rows = items.map((i) =>
              [esc(i.type), esc(i.title), esc(i.url), esc(i.tags.map((t) => t.name).join("; ")), esc(i.notes ?? ""), i.type === "bookmark" ? "" : (i as any).read ? "true" : "false", i.createdAt, i.updatedAt].join(",")
            );
            const csv = [header, ...rows].join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `reading-list-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="hover:text-muted-foreground transition-colors cursor-pointer"
        >
          Export
        </button>
        <span>·</span>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="hover:text-muted-foreground transition-colors cursor-pointer"
        >
          Shortcuts
        </button>
        <span>·</span>
        <button
          type="button"
          onClick={() => void logout()}
          className="hover:text-muted-foreground transition-colors cursor-pointer"
        >
          Log out
        </button>
      </div>
    </>
  );
}
