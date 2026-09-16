import {
  contract,
  fillPath,
  type Output,
  type RouteArgs,
  type RouteKey,
} from "./contract";

// The typed HTTP client for the API in lib/api/contract.ts, riding the
// web's cookie session. The server's error message comes back as the thrown
// error's message, so "Unauthorized" and the friendly action errors read
// exactly as they did over the RPC layer.

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const api = async <K extends RouteKey>(
  key: K,
  ...rest: keyof RouteArgs<K> extends never ? [] : [RouteArgs<K>]
): Promise<Output<K>> => {
  const definition = contract[key];
  const args = (rest[0] ?? {}) as {
    params?: Record<string, string>;
    input?: unknown;
  };
  const path = fillPath(definition.path, args.params);
  const headers: Record<string, string> = { Accept: "application/json" };
  const init: RequestInit = {
    method: definition.method,
    headers,
    credentials: "same-origin",
  };
  if (args.input !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(args.input);
  }
  const response = await fetch(path, init);
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body
        ? String((body as { error: unknown }).error)
        : response.status === 401
          ? "Unauthorized"
          : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return body as Output<K>;
};
