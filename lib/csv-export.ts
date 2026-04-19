import type { QueryClient } from "@tanstack/react-query";

import type { Item } from "@/lib/types";

const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

const ensureCsvExtension = (name: string) =>
  name.toLowerCase().endsWith(".csv") ? name : `${name}.csv`;

export const defaultCsvFilename = () =>
  `reading-list-${new Date().toISOString().slice(0, 10)}`;

export const itemsToCsv = (items: Item[]): string => {
  const header = "type,title,url,tags,notes,read,created_at,updated_at";
  const rows = items.map((item) =>
    [
      escape(item.type),
      escape(item.title),
      escape(item.url),
      escape(item.tags.map((t) => t.name).join("; ")),
      escape(item.notes ?? ""),
      item.read ? "true" : "false",
      item.createdAt,
      item.updatedAt,
    ].join(","),
  );
  return [header, ...rows].join("\n");
};

export const downloadItemsCsv = (
  queryClient: QueryClient,
  filename: string,
) => {
  const items = queryClient.getQueryData<Item[]>(["items"]);
  if (!items || items.length === 0) return;
  const csv = itemsToCsv(items);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = ensureCsvExtension(filename);
  anchor.click();
  URL.revokeObjectURL(url);
};
