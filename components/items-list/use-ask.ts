import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart } from "ai";
import React from "react";

/**
 * Client state for the "Ask" agentic search.
 *
 * Wraps `useChat` against `/api/ask` (one-shot, not a conversation). The agent
 * streams back a sequence of message parts — tool calls (search_items, …), any
 * reasoning text, and a final `present_results` tool call carrying the summary
 * and the chosen item ids. We project those parts into:
 *  - `steps`      — the tool calls / text to show in the collapsible step view
 *  - `summary`    — the one-line description, read off `present_results`
 *  - `resultIds`  — the item ids to render (against the in-memory ["items"] cache)
 */

const PRESENT_RESULTS = "present_results";

export type AskToolStep = {
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

export type AskTextStep = { kind: "text"; text: string };

export type AskStep = AskToolStep | AskTextStep;

type PresentResultsInput = { summary?: string; itemIds?: string[] };

// Stateless config — one shared instance avoids allocating a transport on every
// render of the (large) list component that hosts this hook.
const askTransport = new DefaultChatTransport({ api: "/api/ask" });

export const useAsk = () => {
  const [active, setActive] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const { messages, sendMessage, setMessages, status, error } = useChat({
    transport: askTransport,
  });

  const isAsking = status === "submitted" || status === "streaming";

  const runAsk = React.useCallback(
    (nextQuery: string) => {
      const trimmed = nextQuery.trim();
      if (trimmed.length === 0) return;
      setQuery(trimmed);
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
  // into steps, and pull the final answer out of the present_results call.
  const assistant = React.useMemo(
    () => [...messages].reverse().find((m) => m.role === "assistant"),
    [messages],
  );

  const { steps, summary, resultIds, hasPresented } = React.useMemo(() => {
    const collected: AskStep[] = [];
    let foundSummary: string | null = null;
    let foundIds: string[] | null = null;

    for (const part of assistant?.parts ?? []) {
      if (isToolUIPart(part)) {
        const name = getToolName(part);
        if (name === PRESENT_RESULTS) {
          const input = part.input as PresentResultsInput | undefined;
          if (input?.summary !== undefined) foundSummary = input.summary;
          if (Array.isArray(input?.itemIds)) foundIds = input.itemIds;
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
      hasPresented: foundIds !== null,
    };
  }, [assistant]);

  return {
    askActive: active,
    isAsking,
    error: error ?? null,
    query,
    steps,
    summary,
    resultIds,
    hasPresented,
    runAsk,
    clearAsk,
  };
};
