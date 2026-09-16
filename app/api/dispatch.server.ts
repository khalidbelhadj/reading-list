// Routes an /api request to its handler: match the method and path against
// lib/api/contract.ts, validate params and body with the route's schemas,
// run the handler, and turn the result (or the error) into JSON. Auth and
// CORS happened in the request guard before this runs.
import { handlers } from "@/app/api/handlers.server";
import { contract, type RouteKey } from "@/lib/api/contract";
import { UnauthorizedError } from "@/lib/auth";
import { ActionError } from "@/lib/safe-action";

type Compiled = {
  key: RouteKey;
  method: string;
  pattern: RegExp;
  names: string[];
  /** Static segments outrank parameters, so /items/search beats /items/{id}. */
  rank: number;
};

const compiled: Compiled[] = (Object.keys(contract) as RouteKey[])
  .map((key) => {
    const { method, path } = contract[key];
    const names: string[] = [];
    const source = path
      .split("/")
      .map((segment) => {
        const match = segment.match(/^\{(\w+)\}$/);
        if (!match?.[1]) return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        names.push(match[1]);
        return "([^/]+)";
      })
      .join("/");
    return {
      key,
      method,
      pattern: new RegExp(`^${source}/?$`),
      names,
      rank: names.length,
    };
  })
  .sort((a, b) => a.rank - b.rank);

const json = (body: unknown, status = 200) => Response.json(body, { status });

const failure = (error: unknown) => {
  if (error instanceof UnauthorizedError) {
    return json({ error: "Unauthorized" }, 401);
  }
  // Deliberate, client-safe messages pass through; anything else is
  // genericised so raw database detail never reaches a client.
  if (error instanceof ActionError) return json({ error: error.message }, 500);
  console.error("[api]", error);
  return json({ error: "Something went wrong. Please try again." }, 500);
};

export const dispatch = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  let pathMatched = false;
  for (const route of compiled) {
    const match = url.pathname.match(route.pattern);
    if (!match) continue;
    pathMatched = true;
    if (route.method !== method) continue;

    const definition = contract[route.key];
    const rawParams = Object.fromEntries(
      route.names.map((name, index) => [
        name,
        decodeURIComponent(match[index + 1] ?? ""),
      ]),
    );
    const params = definition.params?.safeParse(rawParams);
    if (params && !params.success) {
      return json(
        { error: params.error.issues[0]?.message ?? "Bad request" },
        400,
      );
    }

    let input: unknown;
    if (definition.input) {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }
      const parsed = definition.input.safeParse(body);
      if (!parsed.success) {
        return json(
          { error: parsed.error.issues[0]?.message ?? "Bad request" },
          400,
        );
      }
      input = parsed.data;
    }

    try {
      const handler = handlers[route.key] as (context: {
        params: unknown;
        input: unknown;
        request: Request;
      }) => Promise<unknown>;
      const output = await handler({ params: params?.data, input, request });
      return json(output ?? null);
    } catch (error) {
      return failure(error);
    }
  }
  return json(
    { error: pathMatched ? "Method not allowed" : "Not found" },
    pathMatched ? 405 : 404,
  );
};
