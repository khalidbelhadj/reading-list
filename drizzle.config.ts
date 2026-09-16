import { defineConfig } from "drizzle-kit";

import { applyBackend } from "./scripts/profiles";

// `bun run db:push [--env=prod]`; the local stack unless asked otherwise.
applyBackend();

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
