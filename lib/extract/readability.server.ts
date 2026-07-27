// HTML → structured markdown. One implementation shared by the server-fetch
// web extractor and the live-capture path (submitLiveContent), so the markdown
// shape is identical regardless of producer.
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";

export type ArticleMarkdown = {
  title: string | null;
  markdown: string;
};

// Runaway pages (infinite comment threads, generated docs) get truncated
// rather than failed — a capped article still indexes and reads fine.
const MAX_MARKDOWN_CHARS = 400_000;

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});
// Media/frame noise that Readability sometimes lets through.
turndown.remove(["script", "style", "iframe", "noscript"]);

// Resolve every href/src against the page URL so the reader view and any
// image rendering work from stored markdown alone.
const absolutizeUrls = (document: Document, baseUrl: string) => {
  for (const attr of ["href", "src"] as const) {
    for (const el of document.querySelectorAll(`[${attr}]`)) {
      const value = el.getAttribute(attr);
      if (!value || value.startsWith("#") || value.startsWith("data:")) {
        continue;
      }
      try {
        el.setAttribute(attr, new URL(value, baseUrl).toString());
      } catch {
        // Malformed URL — leave as-is, turndown will carry it through.
      }
    }
  }
};

const collapseBlankLines = (markdown: string): string =>
  markdown.replace(/\n{3,}/g, "\n\n").trim();

export const htmlToArticleMarkdown = (
  html: string,
  url: string,
): ArticleMarkdown | null => {
  const { document } = parseHTML(html);
  absolutizeUrls(document as unknown as Document, url);

  const article = new Readability(document as unknown as Document, {
    // Readability's default char threshold rejects short-but-real posts.
    charThreshold: 250,
  }).parse();
  if (!article?.content) return null;

  const markdown = collapseBlankLines(turndown.turndown(article.content));
  if (!markdown) return null;

  return {
    title: article.title?.trim() || null,
    markdown: markdown.slice(0, MAX_MARKDOWN_CHARS),
  };
};
