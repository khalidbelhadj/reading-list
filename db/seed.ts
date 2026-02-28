import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

config({ path: ".env.local" });

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

const seedItems: { title: string; url: string; tags: string[]; type: string }[] = [
  {
    title: "Go Blog: Error handling and Go",
    url: "https://go.dev/blog/error-handling-and-go",
    tags: ["go", "errors"],
    type: "bookmark",
  },
  {
    title: "SQLite Documentation",
    url: "https://www.sqlite.org/docs.html",
    tags: ["database", "sqlite"],
    type: "bookmark",
  },
  {
    title: "React Query Overview",
    url: "https://tanstack.com/query/latest/docs/framework/react/overview",
    tags: ["react", "data"],
    type: "reading-list",
  },
  {
    title: "Vite Guide",
    url: "https://vite.dev/guide/",
    tags: ["frontend", "tooling"],
    type: "bookmark",
  },
  {
    title: "REST API Design",
    url: "https://restfulapi.net/",
    tags: ["api", "design"],
    type: "reading-list",
  },
  {
    title: "Go Concurrency Patterns",
    url: "https://go.dev/blog/pipelines",
    tags: ["go", "concurrency"],
    type: "reading-list",
  },
  {
    title: "HTTP RFC 9110",
    url: "https://www.rfc-editor.org/rfc/rfc9110",
    tags: ["http", "standards"],
    type: "bookmark",
  },
  {
    title: "MDN: HTTP CORS",
    url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS",
    tags: ["http", "cors"],
    type: "bookmark",
  },
  {
    title: "SQLite Query Planner",
    url: "https://www.sqlite.org/queryplanner.html",
    tags: ["database", "performance"],
    type: "reading-list",
  },
  {
    title: "React Hooks Reference",
    url: "https://react.dev/reference/react",
    tags: ["react", "hooks"],
    type: "bookmark",
  },
  {
    title: "Vite Environment Variables",
    url: "https://vite.dev/guide/env-and-mode.html",
    tags: ["frontend", "config"],
    type: "bookmark",
  },
  {
    title: "SQL Style Guide",
    url: "https://www.sqlstyle.guide/",
    tags: ["sql", "style"],
    type: "reading-list",
  },
];

for (const item of seedItems) {
  const itemId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(schema.items).values({
    id: itemId,
    title: item.title,
    url: item.url,
    type: item.type,
    starred: false,
    createdAt: now,
    updatedAt: now,
  });

  for (const tagName of item.tags) {
    await db.insert(schema.tags)
      .values({ name: tagName })
      .onConflictDoNothing();

    const [tag] = await db
      .select()
      .from(schema.tags)
      .where(eq(schema.tags.name, tagName));

    if (tag) {
      await db.insert(schema.itemsTags)
        .values({ itemId, tagId: tag.id });
    }
  }
}

console.log(`Seeded ${seedItems.length} items`);
await client.end();
