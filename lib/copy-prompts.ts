"use client";

import { useCallback, useEffect, useState } from "react";

export type CopyPrompt = {
  id: string;
  name: string;
  description: string;
  template: string;
};

const STORAGE_KEY = "copy-prompts";
const EVENT_NAME = "copy-prompts-changed";

export const AVAILABLE_PLACEHOLDERS = ["title", "url", "id", "notes"] as const;

export const DEFAULT_PROMPTS: CopyPrompt[] = [
  {
    id: "markdown",
    name: "Markdown link",
    description: "The title and URL as a Markdown link",
    template: "[{{title}}]({{url}})",
  },
  {
    id: "discussion",
    name: "Discussion prompt",
    description: "Chat through the article and save key ideas as flashcards",
    template: `We're going to focus on this item from my reading list:

- Title: {{title}}
- URL: {{url}}
- Item ID: {{id}}

Existing notes:
{{notes}}

Start by reading the URL and (if possible) giving me a quick, concise summary of the key ideas — keep it brief. From there we'll have a discussion — asking questions, extracting information, structuring thoughts — to round out my understanding of this item.

Whenever we hit a key point, a revelation, or reach a solid understanding of something worth remembering, propose a flashcard and (with my go-ahead) save it using the reading-list MCP tools — create_flashcards with the item ID above. You can also append anything worth keeping to the item's notes via update_items from the same tools.`,
  },
  {
    id: "flashcards",
    name: "Create flashcards prompt",
    description: "Generate a focused set of flashcards from the article",
    template: `Create flashcards for this item from my reading list:

- Title: {{title}}
- URL: {{url}}
- Item ID: {{id}}

Existing notes:
{{notes}}

Read the URL (and notes above, if any), then create a focused set of flashcards that cover the key ideas. One idea per card — fronts should read like questions or prompts, backs should be concise answers. Save them in a single call using the reading-list MCP tools — create_flashcards with the item ID above.`,
  },
  {
    id: "tidy",
    name: "Tidy notes prompt",
    description: "Rewrite the item's notes for clarity",
    template: `Tidy the notes for this item from my reading list:

- Title: {{title}}
- URL: {{url}}
- Item ID: {{id}}

Current notes:
{{notes}}

Rewrite the notes to be clearer and better-organized: tighten prose, group related points, remove redundancy. Preserve meaning and tone — don't invent facts that aren't there. Once I approve the result, save it using the reading-list MCP tools — update_items with the item ID above.`,
  },
];

export const applyTemplate = (
  template: string,
  values: Record<string, string>,
) => template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? "");

const loadPrompts = (): CopyPrompt[] => {
  if (typeof window === "undefined") return DEFAULT_PROMPTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROMPTS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_PROMPTS;
    // Backfill missing fields so older stored shapes upgrade cleanly.
    return (parsed as Partial<CopyPrompt>[]).map((p, i) => ({
      id: p.id ?? `prompt-${Date.now()}-${i}`,
      name: p.name ?? "Untitled",
      description: p.description ?? "",
      template: p.template ?? "",
    }));
  } catch {
    return DEFAULT_PROMPTS;
  }
};

const savePrompts = (prompts: CopyPrompt[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
  window.dispatchEvent(new Event(EVENT_NAME));
};

export const useCopyPrompts = (): [
  CopyPrompt[],
  (prompts: CopyPrompt[]) => void,
] => {
  const [prompts, setPromptsState] = useState<CopyPrompt[]>(DEFAULT_PROMPTS);

  useEffect(() => {
    setPromptsState(loadPrompts());
    const handler = () => setPromptsState(loadPrompts());
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  const setPrompts = useCallback((next: CopyPrompt[]) => {
    savePrompts(next);
    setPromptsState(next);
  }, []);

  return [prompts, setPrompts];
};
