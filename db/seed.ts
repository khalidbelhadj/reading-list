import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, eq } from "drizzle-orm";
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

const seedItems: { title: string; url: string; tags: string[] }[] = [
  {
    title: "Go Blog: Error handling and Go",
    url: "https://go.dev/blog/error-handling-and-go",
    tags: ["go", "errors"],
  },
  {
    title: "SQLite Documentation",
    url: "https://www.sqlite.org/docs.html",
    tags: ["database", "sqlite"],
  },
  {
    title: "React Query Overview",
    url: "https://tanstack.com/query/latest/docs/framework/react/overview",
    tags: ["react", "data"],
  },
  {
    title: "Vite Guide",
    url: "https://vite.dev/guide/",
    tags: ["frontend", "tooling"],
  },
  {
    title: "REST API Design",
    url: "https://restfulapi.net/",
    tags: ["api", "design"],
  },
  {
    title: "Go Concurrency Patterns",
    url: "https://go.dev/blog/pipelines",
    tags: ["go", "concurrency"],
  },
  {
    title: "HTTP RFC 9110",
    url: "https://www.rfc-editor.org/rfc/rfc9110",
    tags: ["http", "standards"],
  },
  {
    title: "MDN: HTTP CORS",
    url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS",
    tags: ["http", "cors"],
  },
  {
    title: "SQLite Query Planner",
    url: "https://www.sqlite.org/queryplanner.html",
    tags: ["database", "performance"],
  },
  {
    title: "React Hooks Reference",
    url: "https://react.dev/reference/react",
    tags: ["react", "hooks"],
  },
  {
    title: "Vite Environment Variables",
    url: "https://vite.dev/guide/env-and-mode.html",
    tags: ["frontend", "config"],
  },
  {
    title: "SQL Style Guide",
    url: "https://www.sqlstyle.guide/",
    tags: ["sql", "style"],
  },
];

for (const item of seedItems) {
  const itemId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(schema.items).values({
    id: itemId,
    userId,
    title: item.title,
    url: item.url,
    starred: false,
    createdAt: now,
    updatedAt: now,
  });

  for (const tagName of item.tags) {
    await db
      .insert(schema.tags)
      .values({ userId, name: tagName })
      .onConflictDoNothing();

    const [tag] = await db
      .select()
      .from(schema.tags)
      .where(
        and(eq(schema.tags.userId, userId), eq(schema.tags.name, tagName)),
      );

    if (tag) {
      await db.insert(schema.itemsTags)
        .values({ itemId, tagId: tag.id });
    }
  }
}

console.log(`Seeded ${seedItems.length} items`);
await client.end();
