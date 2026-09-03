// The worker's API: the stateless storage side of the index, called by the
// client worker (lib/index-worker/worker.ts) over same-origin fetch. The
// request guard has already checked the session; every handler resolves the
// user again and runs inside its RLS transaction.
//
//   POST /api/index/jobs        reconcile, then lease jobs + chunks to embed
//   POST /api/index/content     store an extracted document
//   POST /api/index/failure     record a failed extraction
//   POST /api/index/embeddings  store vectors for chunks
import { z } from "zod";

import { withUser } from "@/db";
import { EMBEDDING_DIMENSIONS } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import {
  claimContentJobs,
  pendingChunks,
  reconcileIndex,
  recordFailure,
  storeContent,
  storeEmbeddings,
} from "@/lib/index/indexer.server";
import { indexStatus } from "@/lib/index/item-context.server";

const modelSchema = z.string().min(1).max(200);

const jobsSchema = z.object({
  model: modelSchema,
  jobLimit: z.number().int().min(0).max(5),
  chunkLimit: z.number().int().min(0).max(64),
});

const contentSchema = z.object({
  itemId: z.string().min(1),
  extractor: z.string().min(1).max(40),
  title: z.string().max(500).nullable(),
  markdown: z.string().max(400_000),
  model: modelSchema,
});

const failureSchema = z.object({
  itemId: z.string().min(1),
  message: z.string().max(500),
  permanent: z.boolean(),
});

const embeddingsSchema = z.object({
  model: modelSchema,
  vectors: z
    .array(
      z.object({
        id: z.string().min(1),
        embedding: z.array(z.number()).length(EMBEDDING_DIMENSIONS),
      }),
    )
    .max(64),
});

const readJson = async (request: Request): Promise<unknown> => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

const badRequest = (error: z.ZodError) =>
  Response.json(
    { error: error.issues[0]?.message ?? "Invalid input" },
    { status: 400 },
  );

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  const action = new URL(request.url).pathname.split("/").pop();
  const body = await readJson(request);

  if (action === "jobs") {
    const parsed = jobsSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error);
    const { model, jobLimit, chunkLimit } = parsed.data;
    const result = await withUser(
      userId,
      async (tx) => {
        await reconcileIndex(tx, userId);
        const [chunks, jobs, status] = await Promise.all([
          pendingChunks(tx, userId, model, chunkLimit),
          claimContentJobs(tx, userId, jobLimit),
          indexStatus(tx, userId, model),
        ]);
        return { chunks, jobs, status };
      },
      "index:jobs",
    );
    return Response.json(result);
  }

  if (action === "content") {
    const parsed = contentSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error);
    const { model, ...extracted } = parsed.data;
    const status = await withUser(userId, async (tx) => {
      await storeContent(tx, userId, extracted);
      return indexStatus(tx, userId, model);
    });
    return Response.json({ status });
  }

  if (action === "failure") {
    const parsed = failureSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error);
    const { itemId, message, permanent } = parsed.data;
    await withUser(userId, (tx) =>
      recordFailure(tx, userId, itemId, message, permanent),
    );
    return Response.json({ ok: true });
  }

  if (action === "embeddings") {
    const parsed = embeddingsSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error);
    const { model, vectors } = parsed.data;
    const status = await withUser(userId, async (tx) => {
      await storeEmbeddings(tx, userId, model, vectors);
      return indexStatus(tx, userId, model);
    });
    return Response.json({ status });
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}
