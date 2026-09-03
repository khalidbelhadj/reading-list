import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";
import React from "react";

import { semanticSearch } from "@/app/actions";
import { embedQuery, INDEX_MODEL_ID } from "@/lib/index-client";

/**
 * Client state for the agentic search ("Ask") and the review compiler.
 *
 * Wraps `useChat` against `/api/ask` (one-shot, not a conversation). The agent
 * streams back a sequence of message parts — tool calls (search_items, …), any
 * narration text, and a final terminal tool call (`present_results` for a
 * search, `present_review` for a stack) carrying the summary and the chosen
 * ids. We project those parts into:
 *  - `steps`     — the tool calls / text to show in the activity feed
 *  - `summary`   — the one-line description, read off the terminal call
 *  - `resultIds` — the item ids to render (against the in-memory ["items"] cache)
 *  - `review`    — the stack the review agent proposed (review mode only)
 */

export type AskMode = "search" | "review";

const TERMINAL_TOOLS = new Set(["present_results", "present_review"]);

type AskToolStep = {
  kind: "tool";
  toolCallId: string;
  name: string;
  // Mirrors the SDK's ToolUIPart lifecycle: input-streaming → input-available →
  // output-available | output-error. Kept as a string so we don't pin to the
  // exact SDK union.
  state: string;
  input: unknown;
  output: unknown;
};

type AskTextStep = { kind: "text"; text: string };

export type AskStep = AskToolStep | AskTextStep;

type ProposedReview = {
  title: string;
  summary: string;
  itemIds: string[];
  cardIds: string[];
};

type TerminalInput = {
  summary?: string;
  title?: string;
  itemIds?: string[];
  cardIds?: string[];
};

type SemanticSearchInput = {
  query: string;
  scope: "items" | "cards";
  limit?: number;
};

// Stateless config — one shared instance per mode avoids allocating a
// transport on every render of the hosting component.
const transports: Record<AskMode, DefaultChatTransport<UIMessage>> = {
  search: new DefaultChatTransport({
    api: "/api/ask",
    body: { mode: "search" },
  }),
  review: new DefaultChatTransport({
    api: "/api/ask",
    body: { mode: "review" },
  }),
};

export const useAsk = (mode: AskMode = "search") => {
  const [active, setActive] = React.useState(false);

  const { messages, sendMessage, setMessages, status, error, addToolOutput } =
    useChat({
      transport: transports[mode],
      // semantic_search runs here, not on the server: the embedding model
      // lives in the index worker, and a query must be embedded by the same
      // model as the chunks. The worker embeds, the server ranks, and the
      // result goes back to the agent as the tool's output.
      onToolCall: async ({ toolCall }) => {
        if (toolCall.toolName !== "semantic_search") return;
        const input = toolCall.input as SemanticSearchInput;
        try {
          const vector = await embedQuery(input.query);
          const output = await semanticSearch({
            model: INDEX_MODEL_ID,
            vector,
            scope: input.scope,
            limit: input.limit ?? 15,
          });
          addToolOutput({
            tool: "semantic_search",
            toolCallId: toolCall.toolCallId,
            output,
          });
        } catch (toolError) {
          addToolOutput({
            tool: "semantic_search",
            toolCallId: toolCall.toolCallId,
            state: "output-error",
            errorText:
              toolError instanceof Error
                ? toolError.message
                : "Semantic search failed",
          });
        }
      },
      // Once every tool call in the turn has an output (ours included), the
      // conversation goes back to the model for its next step.
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    });

  const isAsking = status === "submitted" || status === "streaming";

  const runAsk = React.useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (trimmed.length === 0) return;
      setActive(true);
      // Each Ask is a fresh one-shot — drop any prior turn before sending.
      setMessages([]);
      sendMessage({ text: trimmed });
    },
    [sendMessage, setMessages],
  );

  const clearAsk = React.useCallback(() => {
    setActive(false);
    setMessages([]);
  }, [setMessages]);

  // The agent's reply is the last assistant message; project its ordered parts
  // into steps, and pull the final answer out of the terminal call.
  const assistant = React.useMemo(
    () =>
      [...messages].reverse().find((message) => message.role === "assistant"),
    [messages],
  );

  const { steps, summary, resultIds, review, hasPresented } =
    React.useMemo(() => {
      const collected: AskStep[] = [];
      let foundSummary: string | null = null;
      let foundIds: string[] | null = null;
      let foundReview: ProposedReview | null = null;

      for (const part of assistant?.parts ?? []) {
        if (isToolUIPart(part)) {
          const name = getToolName(part);
          if (TERMINAL_TOOLS.has(name)) {
            const input = part.input as TerminalInput | undefined;
            if (input?.summary !== undefined) foundSummary = input.summary;
            if (Array.isArray(input?.itemIds)) foundIds = input.itemIds;
            if (name === "present_review" && input) {
              foundReview = {
                title: input.title ?? "Review",
                summary: input.summary ?? "",
                itemIds: input.itemIds ?? [],
                cardIds: input.cardIds ?? [],
              };
            }
            continue; // shown as the summary, not as a step
          }
          collected.push({
            kind: "tool",
            toolCallId: part.toolCallId,
            name,
            state: part.state,
            input: part.input,
            output: (part as { output?: unknown }).output,
          });
        } else if (part.type === "text" && part.text.trim().length > 0) {
          collected.push({ kind: "text", text: part.text });
        }
      }

      return {
        steps: collected,
        summary: foundSummary,
        resultIds: foundIds,
        review: foundReview,
        hasPresented: foundIds !== null,
      };
    }, [assistant]);

  return {
    askActive: active,
    isAsking,
    error: error ?? null,
    steps,
    summary,
    resultIds,
    review,
    hasPresented,
    runAsk,
    clearAsk,
  };
};
