import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

config({ path: ".env.local" });

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

const userId = process.env.SEED_USER_ID;
if (!userId) {
  console.error(
    "Set SEED_USER_ID to the Supabase auth.users.id to seed under (required).",
  );
  process.exit(1);
}

const seedItems: { title: string; url: string }[] = [
  {
    title: "Go Blog: Error handling and Go",
    url: "https://go.dev/blog/error-handling-and-go",
  },
  {
    title: "SQLite Documentation",
    url: "https://www.sqlite.org/docs.html",
  },
  {
    title: "React Query Overview",
    url: "https://tanstack.com/query/latest/docs/framework/react/overview",
  },
  {
    title: "Vite Guide",
    url: "https://vite.dev/guide/",
  },
  {
    title: "REST API Design",
    url: "https://restfulapi.net/",
  },
  {
    title: "Go Concurrency Patterns",
    url: "https://go.dev/blog/pipelines",
  },
  {
    title: "HTTP RFC 9110",
    url: "https://www.rfc-editor.org/rfc/rfc9110",
  },
  {
    title: "MDN: HTTP CORS",
    url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS",
  },
  {
    title: "SQLite Query Planner",
    url: "https://www.sqlite.org/queryplanner.html",
  },
  {
    title: "React Hooks Reference",
    url: "https://react.dev/reference/react",
  },
  {
    title: "Vite Environment Variables",
    url: "https://vite.dev/guide/env-and-mode.html",
  },
  {
    title: "SQL Style Guide",
    url: "https://www.sqlstyle.guide/",
  },
];

for (const item of seedItems) {
  const now = new Date().toISOString();
  await db.insert(schema.items).values({
    id: crypto.randomUUID(),
    userId,
    title: item.title,
    url: item.url,
    starred: false,
    createdAt: now,
    updatedAt: now,
  });
}

console.log(`Seeded ${seedItems.length} items`);
await client.end();
