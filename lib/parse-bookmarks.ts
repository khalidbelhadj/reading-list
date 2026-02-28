export type ParsedBookmark = {
  title: string;
  url: string;
  tags: string[];
  addedAt: string | null;
  type: "bookmark" | "reading-list";
};

/**
 * Parses a Chrome NETSCAPE-Bookmark-file-1 HTML export.
 * Returns flat bookmark entries with the direct parent folder as a tag.
 */
export function parseBookmarksHtml(html: string): ParsedBookmark[] {
  const results: ParsedBookmark[] = [];
  const lines = html.split("\n");
  const folderStack: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Opening a folder: <DT><H3 ...>Name</H3>
    const folderMatch = trimmed.match(/<DT><H3[^>]*>(.+?)<\/H3>/i);
    if (folderMatch) {
      folderStack.push(folderMatch[1]);
      console.log("[parse-bookmarks] folder:", folderStack.join(" > "));
      continue;
    }

    // Bookmark link: <DT><A HREF="..." ...>Title</A>
    const linkMatch = trimmed.match(
      /<DT><A\s+HREF="([^"]+)"[^>]*>(.+?)<\/A>/i,
    );
    if (linkMatch) {
      const url = linkMatch[1];
      const title = linkMatch[2]
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"');

      // Extract ADD_DATE (Unix timestamp in seconds)
      const dateMatch = trimmed.match(/ADD_DATE="(\d+)"/i);
      const addedAt = dateMatch
        ? new Date(Number(dateMatch[1]) * 1000).toISOString()
        : null;

      // Determine type based on whether any ancestor folder is "Reading List"
      const inReadingList = folderStack.some(
        (f) => f.toLowerCase() === "reading list",
      );

      // Use the direct parent folder as a tag (if any), skip "Reading List" as a tag
      const parentFolder =
        folderStack.length > 0 ? folderStack[folderStack.length - 1] : null;
      const tag =
        parentFolder && parentFolder.toLowerCase() !== "reading list"
          ? parentFolder.toLowerCase()
          : null;

      // Skip chrome-internal and empty URLs
      if (url.startsWith("http://") || url.startsWith("https://")) {
        results.push({
          title,
          url,
          tags: tag ? [tag] : [],
          addedAt,
          type: inReadingList ? "reading-list" : "bookmark",
        });
      }
      continue;
    }

    // Closing a folder block: </DL>
    if (trimmed.startsWith("</DL>")) {
      folderStack.pop();
    }
  }

  return results;
}
