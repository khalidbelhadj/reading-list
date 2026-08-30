import { stripBlankLineSentinel } from "@/lib/markdown";
import { type Item } from "@/lib/types";

// Open Claude with the item pre-loaded as context, from the item menu.
export const openChatWithClaude = (item: Item) => {
  const lines = ["This is an item from my reading list:", ""];
  lines.push(`- **ID:** ${item.id}`);
  if (item.title) lines.push(`- **Title:** ${item.title}`);
  if (item.url) lines.push(`- **URL:** ${item.url}`);
  if (item.notes)
    lines.push("", "**Notes:**", "", stripBlankLineSentinel(item.notes));
  const prompt = lines.join("\n");
  window.open(
    `claude://claude.ai/new?q=${encodeURIComponent(prompt)}`,
    "_self",
  );
};
