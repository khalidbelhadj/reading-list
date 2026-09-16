// Derives the OpenAPI document from lib/api/contract.ts. The web shell never
// reads it (it has the typed client); the native apps do — the Mac target
// generates its Swift client from the copy in mac/Sources/ReadingListAPI.
//
//   bun run gen:openapi          write openapi/openapi.json (+ the Swift copy)
//   bun run gen:openapi --check  fail when the files on disk are stale
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { z } from "zod";

import {
  contract,
  createdItemSchema,
  createItemResultSchema,
  duplicateItemSchema,
  flashcardSchema,
  itemSchema,
  type RouteKey,
  searchResultSchema,
  semanticCardResultSchema,
  semanticItemResultSchema,
  updateItemFieldsSchema,
  versionInfoSchema,
} from "@/lib/api/contract";
import { settingsPatchSchema, settingsSchema } from "@/lib/settings";

const ROOT = join(import.meta.dir, "..");
const OUTPUTS = [
  join(ROOT, "openapi", "openapi.json"),
  join(ROOT, "mac", "Sources", "ReadingListAPI", "openapi.json"),
];

type JsonSchema = Record<string, unknown>;

// The schemas that become named components (Components.Schemas.Item in
// Swift). Everything else is inlined into its operation.
const namedSchemas: Record<string, z.ZodType> = {
  Item: itemSchema,
  Flashcard: flashcardSchema,
  SearchResult: searchResultSchema,
  SemanticItemResult: semanticItemResultSchema,
  SemanticCardResult: semanticCardResultSchema,
  VersionInfo: versionInfoSchema,
  CreateItemInput: contract.createItem.input,
  RateCardInput: contract.rateCard.input,
  RequestImageUploadInput: contract.requestImageUpload.input,
  UpdateFlashcardInput: contract.updateFlashcard.input,
  CreatedItem: createdItemSchema,
  DuplicateItem: duplicateItemSchema,
  CreateItemResult: createItemResultSchema,
  UpdateItemFields: updateItemFieldsSchema,
  Settings: settingsSchema,
  SettingsPatch: settingsPatchSchema,
};

const errorSchema: JsonSchema = {
  type: "object",
  properties: { error: { type: "string" } },
  required: ["error"],
};

const uri = (id: string) => `#/components/schemas/${id}`;

// Every named schema is registered once; zod then emits `$ref`s for them
// wherever they appear inside another schema. Each route schema is converted
// on its own (request bodies as the schema's input side, so defaults are
// optional; responses as its output side).
const registry = z.registry<{ id: string }>();
for (const [id, schema] of Object.entries(namedSchemas)) {
  registry.add(schema, { id });
}
const nameOf = (schema: z.ZodType) =>
  Object.keys(namedSchemas).find((id) => namedSchemas[id] === schema);

const isObject = (value: unknown): value is JsonSchema =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Walks a schema, knowing which keys hold schemas and which hold names.
// Along the way: OpenAPI 3.0 has no $schema/$id/id keywords; the strictness
// zod adds to every object (additionalProperties: false) would make a
// generated client reject a response the moment the server adds a field,
// while the server strips unknown request keys rather than rejecting them;
// boolean literals (`ok: true`) become plain booleans, because code
// generators only know string and integer enums and a boolean can't serve
// as a discriminator either (the members are told apart by their required
// fields); and extracted definitions move to the components section.
const SCHEMA_MAPS = new Set(["properties", "$defs", "definitions"]);
const SCHEMA_LISTS = new Set(["anyOf", "oneOf", "allOf", "prefixItems"]);
const SCHEMA_VALUES = new Set(["items", "additionalProperties", "not"]);
const clean = (schema: JsonSchema, root = false): JsonSchema => {
  const copy: JsonSchema = {};
  for (const [key, value] of Object.entries(schema)) {
    if (root && (key === "$schema" || key === "$id" || key === "id")) continue;
    if (key === "$defs" || key === "definitions" || key === "components")
      continue;
    if (key === "additionalProperties" && value === false) continue;
    if (key === "enum" && schema.type === "boolean") continue;
    if (key === "discriminator") continue;
    if (key === "$ref" && typeof value === "string") {
      copy[key] = value.replace(
        /^#\/(\$defs|definitions)\//,
        "#/components/schemas/",
      );
    } else if (SCHEMA_MAPS.has(key) && isObject(value)) {
      copy[key] = Object.fromEntries(
        Object.entries(value).map(([name, child]) => [
          name,
          isObject(child) ? clean(child) : child,
        ]),
      );
    } else if (SCHEMA_LISTS.has(key) && Array.isArray(value)) {
      copy[key] = value.map((child) =>
        isObject(child) ? clean(child) : child,
      );
    } else if (SCHEMA_VALUES.has(key)) {
      copy[key] = Array.isArray(value)
        ? value.map((child) => (isObject(child) ? clean(child) : child))
        : isObject(value)
          ? clean(value)
          : value;
    } else {
      copy[key] = value;
    }
  }
  return copy;
};

const convert = (schema: z.ZodType, io: "input" | "output"): JsonSchema => {
  const raw = z.toJSONSchema(schema, {
    metadata: registry,
    io,
    target: "openapi-3.0",
    unrepresentable: "any",
  }) as JsonSchema;
  // A named root comes back as a reference to its own definition.
  const definitions = {
    ...(raw.$defs as Record<string, JsonSchema> | undefined),
    ...(raw.definitions as Record<string, JsonSchema> | undefined),
    ...(raw.components as { schemas?: Record<string, JsonSchema> } | undefined)
      ?.schemas,
  };
  const self =
    typeof raw.$ref === "string" ? raw.$ref.split("/").pop() : undefined;
  const root = self && definitions[self] ? definitions[self] : raw;
  return clean(root, true);
};

/** A `$ref` for a named schema, the converted schema otherwise. */
const reference = (schema: z.ZodType, io: "input" | "output"): JsonSchema => {
  const name = nameOf(schema);
  return name ? { $ref: uri(name) } : convert(schema, io);
};

const componentSchemas: Record<string, JsonSchema> = {
  ErrorResponse: errorSchema,
};
for (const [id, schema] of Object.entries(namedSchemas)) {
  componentSchemas[id] = convert(schema, "output");
}

const jsonContent = (schema: JsonSchema) => ({
  "application/json": { schema },
});

const paths: Record<string, Record<string, unknown>> = {};
for (const key of Object.keys(contract) as RouteKey[]) {
  const definition = contract[key];
  const operation: Record<string, unknown> = {
    operationId: key,
    summary: definition.summary,
  };
  if (definition.params) {
    const params = convert(definition.params, "output");
    const properties = (params.properties ?? {}) as Record<string, JsonSchema>;
    operation.parameters = Object.entries(properties).map(([name, schema]) => ({
      name,
      in: "path",
      required: true,
      schema,
    }));
  }
  if (definition.input) {
    operation.requestBody = {
      required: true,
      content: jsonContent(reference(definition.input, "input")),
    };
  }
  operation.responses = {
    "200": {
      description: "OK",
      content: jsonContent(reference(definition.output, "output")),
    },
    default: {
      description: "Error",
      content: jsonContent({ $ref: uri("ErrorResponse") }),
    },
  };
  const path = (paths[definition.path] ??= {});
  path[definition.method.toLowerCase()] = operation;
}

const packageJson = JSON.parse(
  readFileSync(join(ROOT, "package.json"), "utf8"),
) as { version: string };

const document = {
  openapi: "3.0.3",
  info: {
    title: "Reading List API",
    version: packageJson.version,
    description:
      "The reading list's HTTP API. Authenticate with a Supabase access token as a bearer, or the web session cookie.",
  },
  servers: [{ url: "/" }],
  security: [{ bearerAuth: [] }],
  paths,
  components: {
    schemas: componentSchemas,
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
};

const text = `${JSON.stringify(document, null, 2)}\n`;
const check = process.argv.includes("--check");
let stale = false;
for (const output of OUTPUTS) {
  const current = existsSync(output) ? readFileSync(output, "utf8") : null;
  if (current === text) continue;
  if (check) {
    stale = true;
    console.error(`${output} is stale; run \`bun run gen:openapi\``);
    continue;
  }
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, text);
  console.log(`wrote ${output}`);
}
if (stale) process.exit(1);
