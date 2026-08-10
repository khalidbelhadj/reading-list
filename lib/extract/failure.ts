// Why an item could not be indexed, as a closed set.
//
// Every failure in the pipeline resolves to one of these before it is stored.
// The point is not tidiness: the reason decides what the UI says and whether
// Retry is offered at all. Free-text errors could not do that, which is how
// "Retry everything failed" ended up requeueing pages that had already been
// established to contain no article — a button that could not possibly work.
//
// Client-safe: the debug UI imports the labels, so keep this free of
// server-only imports.

export const FAILURE_REASONS = {
  unreachable: {
    label: "Couldn't reach it",
    // Shown under the label. Written for someone who did not write the
    // pipeline, and says what to do rather than what happened internally.
    explain:
      "The site didn't respond, or timed out. Usually temporary — retrying often works.",
    retryable: true,
  },
  blocked: {
    label: "The site refused",
    explain:
      "It answered, but wouldn't serve the page — a login wall, a paywall, or bot protection. Retrying gets the same answer.",
    retryable: false,
  },
  not_readable: {
    label: "No article to read",
    explain:
      "The page loaded, but there is no article-shaped content on it: an app screen, a directory, a video with no transcript.",
    retryable: false,
  },
  too_large: {
    label: "Too big to index",
    explain: "The page or PDF is past the size cap the extractor will fetch.",
    retryable: false,
  },
  invalid_url: {
    label: "Not a usable link",
    explain:
      "The URL is malformed, or points somewhere that can't be fetched from the server.",
    retryable: false,
  },
  no_content: {
    label: "Nothing to embed",
    explain:
      "Text was extracted, but there wasn't enough of it to make a single chunk.",
    retryable: false,
  },
  embed_unavailable: {
    label: "Embedding model unavailable",
    explain:
      "The embedding provider couldn't be reached or isn't configured. Fix that, then retry — the extracted text is already saved.",
    retryable: true,
  },
  embed_rejected: {
    label: "Embedding was refused",
    explain:
      "The provider answered but declined the request, usually a quota or a rate limit. The extracted text is already saved.",
    retryable: true,
  },
  internal: {
    label: "Something went wrong",
    explain:
      "A bug on our side rather than a problem with the page. Worth reporting if it keeps happening.",
    retryable: true,
  },
} as const;

export type FailureReason = keyof typeof FAILURE_REASONS;

export const FAILURE_REASON_VALUES = Object.keys(
  FAILURE_REASONS,
) as FailureReason[];

const isFailureReason = (value: string): value is FailureReason =>
  value in FAILURE_REASONS;

/**
 * Reads a stored reason. Falls back to `internal` rather than throwing: a row
 * written by an older build (or by hand) must still render, and "something
 * went wrong" is true of an unrecognized reason.
 */
export const describeFailure = (reason: string | null) =>
  FAILURE_REASONS[reason && isFailureReason(reason) ? reason : "internal"];

/**
 * A failure with its reason already decided. Thrown at the point that knows
 * why — the fetch that saw the 403, the extractor that found no article — so
 * the worker never has to guess from a message string.
 *
 * `detail` is the raw underlying message. It is kept for the detail pane and
 * for us; it is never the primary thing shown, because it is written for
 * whoever wrote the code, not whoever is reading the screen.
 */
export class IndexFailure extends Error {
  readonly reason: FailureReason;
  readonly detail: string | undefined;

  constructor(reason: FailureReason, detail?: string) {
    super(detail ?? FAILURE_REASONS[reason].label);
    this.name = "IndexFailure";
    this.reason = reason;
    this.detail = detail;
  }
}

/** HTTP status → reason. Refusals are terminal; everything else may pass. */
export const failureForStatus = (status: number): FailureReason => {
  if (status === 401 || status === 403 || status === 429) return "blocked";
  if (status === 404 || status === 410) return "not_readable";
  return "unreachable";
};

// ---------------------------------------------------------------------------
// Diagnostics: what actually went wrong, in full
// ---------------------------------------------------------------------------

// Caps. Generous enough that nothing worth reading is cut, bounded so one
// pathological page can't put a megabyte of HTML in every row.
const BODY_CAP = 1500;
const STACK_CAP = 2500;
export const DETAIL_CAP = 8000;

/**
 * Reads a failed response's body for the record.
 *
 * "Fetch failed with status 403" is not a diagnosis — the body is where the
 * site says whether it wants a login, thinks you are a bot, or is rate
 * limiting you, and it is where Ollama and OpenAI put their actual error
 * objects. Consuming the body is safe here because this only runs on paths
 * that are already abandoning the response.
 */
export const readErrorBody = async (res: Response): Promise<string> => {
  try {
    const text = await res.text();
    // HTML error pages are mostly whitespace and markup; collapsing runs of
    // whitespace makes the sentence that matters visible in one line.
    const collapsed = text.replace(/\s+/g, " ").trim();
    if (!collapsed) return "";
    return collapsed.length > BODY_CAP
      ? `${collapsed.slice(0, BODY_CAP)}… [${text.length} bytes total]`
      : collapsed;
  } catch (error) {
    return `<body unreadable: ${
      error instanceof Error ? error.message : String(error)
    }>`;
  }
};

/** Status line plus body, as the detail for an HTTP failure. */
export const describeResponse = (res: Response, body: string): string => {
  const statusLine = `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ""} — ${res.url || "(no url)"}`;
  const contentType = res.headers.get("content-type");
  const lines = [statusLine];
  if (contentType) lines.push(`content-type: ${contentType}`);
  if (body) lines.push("", body);
  return lines.join("\n");
};

/**
 * Everything an exception knows: its name and message, every `cause` beneath
 * it, and the stack.
 *
 * The cause chain matters because wrappers hide the real error — drizzle
 * reports "Failed query: <the entire SQL>" and hangs the driver's complaint
 * off `cause`, and eleven rows once sat failing with nothing recorded but a
 * truncated SQL statement. The stack matters because an `internal` failure is
 * our bug, and a reason without a line number is a bug report with no address.
 */
export const describeThrown = (error: unknown): string => {
  if (!(error instanceof Error)) return String(error);
  const lines = [`${error.name}: ${error.message}`];
  let cause: unknown = error.cause;
  let depth = 0;
  while (cause instanceof Error && depth < 4) {
    lines.push(`caused by ${cause.name}: ${cause.message}`);
    cause = cause.cause;
    depth++;
  }
  if (cause !== undefined && !(cause instanceof Error)) {
    lines.push(`caused by: ${String(cause)}`);
  }
  // A stack starts by repeating "Name: message", which is already line one.
  // Keep only the frames.
  const frames = error.stack?.slice(error.stack.indexOf("\n    at "));
  if (frames?.startsWith("\n    at ")) {
    lines.push(frames.slice(1, STACK_CAP));
  }
  return lines.join("\n");
};

/**
 * Last line of defence: turns anything thrown into a typed failure. An
 * unrecognized error becomes `internal`, which is the honest answer — we did
 * not anticipate it, so it is our problem rather than the page's.
 *
 * Network-level errors are matched here rather than at every fetch site
 * because they surface identically everywhere: `fetch` rejects with a
 * TypeError, and an expired AbortSignal.timeout throws a TimeoutError.
 */
export const toIndexFailure = (error: unknown): IndexFailure => {
  if (error instanceof IndexFailure) return error;
  // The detail is the full description; the classification below reads the
  // bare message, which is the only part with a stable shape.
  const detail = describeThrown(error);
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError" || name === "AbortError") {
    return new IndexFailure("unreachable", detail);
  }
  // safeFetch (lib/url.server.ts) is shared with the rest of the app and
  // raises a plain Error when a URL bounces between redirects forever. It is
  // the one such case, and it means the same thing a timeout does.
  if (message === "Too many redirects") {
    return new IndexFailure("unreachable", detail);
  }
  // fetch() rejects with a TypeError for DNS, connection refused, and TLS
  // failures — all "couldn't reach it" from the reader's point of view.
  if (error instanceof TypeError) {
    return new IndexFailure("unreachable", detail);
  }
  return new IndexFailure("internal", detail);
};
