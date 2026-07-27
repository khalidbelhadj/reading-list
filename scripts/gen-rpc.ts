// Generates app/actions/index.ts (the RPC layer) from the manifest below.
//
//   bun run gen:rpc          — regenerate app/actions/index.ts
//   bun run gen:rpc --check  — exit 1 if the checked-in file drifts from the
//                              manifest (used by `bun run check`)
//
// Why codegen: every wrapper in index.ts is mechanically derivable from
// (module, export name, arity). The dynamic `import()` MUST stay inline inside
// each .handler() callback — TanStack Start's compiler strips handler bodies
// from the client bundle only when it can see the import there, so a runtime
// factory/loop would leak server code into the client. Codegen keeps the
// emitted file shaped exactly like the hand-written original.
//
// Adding a new action: implement it in the impl module (app/actions/*.ts),
// add an entry to the manifest below, then run `bun run gen:rpc`.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface FnEntry {
  name: string;
  /** Zero-argument action: no validator, wrapper takes no args. */
  zeroArg?: boolean;
  /**
   * Some impl signatures (optional params) don't survive `Parameters<>` as a
   * validator input type; widen the wire type and assert back.
   */
  widenValidator?: string;
}

interface Section {
  /** Text of the `// --- ... ---` section header. */
  header: string;
  /** Import specifier of the impl module, e.g. "./items". */
  module: string;
  /**
   * Type-only re-exports from this module. `top: true` hoists the export
   * above the sections (next to the header comment), matching the original
   * file's layout for review-session/review-stats.
   */
  typeExports?: { names: string[]; top?: boolean };
  fns: FnEntry[];
}

const WIDE_ARGS = "Array<string | number | undefined>";

const manifest: Section[] = [
  {
    header: "items",
    module: "./items",
    fns: [
      { name: "searchItems" },
      { name: "deleteItem" },
      { name: "fetchPageTitle" },
      { name: "createItem" },
      { name: "updateItem" },
      { name: "setItemRead" },
      { name: "bulkDeleteItems" },
      { name: "bulkTag" },
      { name: "bulkMarkRead" },
      { name: "bulkSetStarred" },
      { name: "generateItemPreview" },
    ],
  },
  {
    header: "intelligence (extracted content, embeddings, semantic search)",
    module: "./intelligence",
    typeExports: {
      names: [
        "ContentOverviewRow",
        "IntelligenceOverview",
        "ItemChunk",
        "ItemContentDetail",
        "ModelCoverage",
      ],
    },
    fns: [
      { name: "getIntelligenceOverview", zeroArg: true },
      { name: "getItemContent" },
      { name: "getItemChunks" },
      { name: "getEmbeddingSettings", zeroArg: true },
      { name: "updateEmbeddingSettings" },
      { name: "reextractItem" },
      { name: "reembedItem" },
      { name: "processQueueBatch", zeroArg: true },
      { name: "retryMissingEmbeddings", zeroArg: true },
      { name: "backfillMyContent", zeroArg: true },
      { name: "submitLiveContent" },
    ],
  },
  {
    header: "semantic search (vector queries over the embeddings)",
    module: "./semantic-search",
    typeExports: { names: ["RelatedItem", "SemanticHit"] },
    fns: [
      { name: "semanticSearch", widenValidator: WIDE_ARGS },
      { name: "getRelatedItems", widenValidator: WIDE_ARGS },
    ],
  },
  {
    header: "tags",
    module: "./tags",
    fns: [{ name: "renameTag" }, { name: "deleteTag" }],
  },
  {
    header: "settings",
    module: "./settings",
    fns: [{ name: "getSettings", zeroArg: true }, { name: "updateSettings" }],
  },
  {
    header: "flashcards",
    module: "./flashcards",
    fns: [
      { name: "getFlashcards" },
      { name: "getAllFlashcards", zeroArg: true },
      { name: "createFlashcard" },
      { name: "updateFlashcard" },
      { name: "deleteFlashcard" },
    ],
  },
  {
    header: "reviews (session lifecycle)",
    module: "./review-session",
    typeExports: {
      top: true,
      names: [
        "BatchedReviewEvent",
        "FlashcardWithItem",
        "ReviewMode",
        "ReviewScope",
        "ReviewSessionCard",
        "ReviewSessionData",
      ],
    },
    fns: [
      { name: "startReviewSession" },
      { name: "getReviewSession" },
      { name: "rateCard" },
      { name: "logSessionEvent" },
      { name: "skipCard" },
      { name: "endReviewSession" },
    ],
  },
  {
    header: "reviews (aggregate stats)",
    module: "./review-stats",
    typeExports: {
      top: true,
      names: ["ItemReviewStatus", "SessionSummary"],
    },
    fns: [
      { name: "getSessionSummary" },
      { name: "getReviewStatus", zeroArg: true },
      { name: "getItemReviewStatus" },
    ],
  },
];

// --- emission ---

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = join(repoRoot, "app", "actions", "index.ts");

const implAlias = (module: string): string => {
  const base = module.replace("./", "");
  const camel = base.replace(/-([a-z])/g, (_, letter: string) =>
    letter.toUpperCase(),
  );
  return `${camel}Impl`;
};

const emitFn = (section: Section, fn: FnEntry): string => {
  const alias = implAlias(section.module);
  const ref = `${alias}.${fn.name}`;
  if (fn.zeroArg) {
    return [
      `const ${fn.name}Fn = createServerFn({ method: "POST" }).handler(() => import("${section.module}").then((m) => m.${fn.name}()));`,
      `export const ${fn.name}: typeof ${ref} = () => ${fn.name}Fn();`,
    ].join("\n");
  }
  const validator = fn.widenValidator
    ? `.validator((args: ${fn.widenValidator}) => args as Parameters<typeof ${ref}>)`
    : `.validator((args: Parameters<typeof ${ref}>) => args)`;
  return [
    `const ${fn.name}Fn = createServerFn({ method: "POST" })`,
    `  ${validator}`,
    `  .handler(({ data }) => import("${section.module}").then((m) => m.${fn.name}(...data)));`,
    `export const ${fn.name}: typeof ${ref} = (...args) => ${fn.name}Fn({ data: args });`,
  ].join("\n");
};

const emitTypeExport = (module: string, names: string[]): string =>
  `export type { ${names.join(", ")} } from "${module}";`;

const generate = async (): Promise<string> => {
  const parts: string[] = [];

  parts.push(
    `// GENERATED by scripts/gen-rpc.ts — edit the manifest there, then bun run gen:rpc`,
  );
  parts.push(`import { createServerFn } from "@tanstack/react-start";`);
  parts.push("");
  const sortedSections = [...manifest].sort((a, b) =>
    a.module.localeCompare(b.module),
  );
  for (const section of sortedSections) {
    parts.push(
      `import type * as ${implAlias(section.module)} from "${section.module}";`,
    );
  }

  parts.push("");
  parts.push(
    [
      "// RPC layer between client code and the server-only implementations. Each",
      "// exported function keeps the exact signature of its implementation (callers",
      "// are unchanged from the Next.js server-action days); the createServerFn",
      "// handlers dynamically import the impl modules so db/pdf/etc. code never",
      "// reaches the client bundle. Thrown ActionError/UnauthorizedError messages",
      "// serialize across the wire, so mutation error toasts behave as before.",
    ].join("\n"),
  );
  parts.push("");

  for (const section of manifest) {
    if (section.typeExports?.top) {
      parts.push(emitTypeExport(section.module, section.typeExports.names));
    }
  }
  parts.push("");

  for (const section of manifest) {
    parts.push(`// --- ${section.header} ---`);
    parts.push("");
    if (section.typeExports && !section.typeExports.top) {
      parts.push(emitTypeExport(section.module, section.typeExports.names));
      parts.push("");
    }
    for (const fn of section.fns) {
      parts.push(emitFn(section, fn));
      parts.push("");
    }
  }

  const raw = parts.join("\n");
  const prettier = await import("prettier");
  const config = await prettier.resolveConfig(outputPath);
  return prettier.format(raw, { ...config, filepath: outputPath });
};

// --- main ---

const main = async () => {
  const generated = await generate();
  const checkMode = process.argv.includes("--check");

  if (checkMode) {
    let current = "";
    try {
      current = readFileSync(outputPath, "utf8");
    } catch {
      // missing file counts as drift
    }
    if (current !== generated) {
      console.error(
        "gen-rpc: app/actions/index.ts is out of date with scripts/gen-rpc.ts — run `bun run gen:rpc`",
      );
      process.exit(1);
    }
    console.log("gen-rpc: app/actions/index.ts is up to date");
    return;
  }

  writeFileSync(outputPath, generated);
  console.log("gen-rpc: wrote app/actions/index.ts");
};

await main();
