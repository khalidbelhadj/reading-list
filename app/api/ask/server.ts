import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  convertToModelMessages,
  hasToolCall,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";

import { getCurrentUserId } from "@/lib/auth";

import { REVIEW_PROMPT, SEARCH_PROMPT } from "./prompts";
import { type AgentMode, toolsForMode } from "./tools";

// Pinned in one place so swapping the model (or provider) is a one-line
// change. flash-lite: fast/cheap with usable free-tier headroom. ASK_MODEL
// overrides for both modes; REVIEW_MODEL for the review compiler alone,
// which makes more judgment calls and may deserve a stronger model.
const DEFAULT_MODEL = "gemini-3.1-flash-lite";
const modelFor = (mode: AgentMode) =>
  (mode === "review" ? process.env.REVIEW_MODEL : undefined) ??
  process.env.ASK_MODEL ??
  DEFAULT_MODEL;

// Point the provider at GEMINI_API_KEY (the default provider looks for
// GOOGLE_GENERATIVE_AI_API_KEY, which also works when that is what's set).
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });

const parseMode = (value: unknown): AgentMode =>
  value === "review" ? "review" : "search";

export async function POST(request: Request) {
  // Cookie-session auth — same helper the server actions use. No MCP/OAuth
  // round-trip; the tools run the existing search queries directly as this
  // user.
  const userId = await getCurrentUserId();

  const { messages, mode: rawMode }: { messages: UIMessage[]; mode?: unknown } =
    await request.json();
  const mode = parseMode(rawMode);
  const terminal = mode === "review" ? "present_review" : "present_results";

  const result = streamText({
    model: google(modelFor(mode)),
    system: mode === "review" ? REVIEW_PROMPT : SEARCH_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: toolsForMode(userId, mode),
    // Run the tool-calling loop until the agent presents (or we hit the step
    // ceiling as a guard against runaway loops). Review runs get more room:
    // they are told to search from several angles.
    stopWhen: [stepCountIs(mode === "review" ? 14 : 8), hasToolCall(terminal)],
  });

  return result.toUIMessageStreamResponse({
    // By default the SDK masks errors as "An error occurred." Surface the real
    // message to the server log and to the client so failures are debuggable.
    onError: (error) => {
      console.error("[/api/ask] stream error:", error);
      return error instanceof Error ? error.message : String(error);
    },
  });
}
