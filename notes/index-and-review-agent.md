# The index and the review agent (2026-09-03)

A second attempt at semantic indexing, after the July pipeline was ripped
out with the old frontend (see 2026-08-30-old-frontend-removal.md). The
shape is deliberately smaller than the first one, and every piece is
disposable: `item_content` and `chunks` can be dropped without the app
noticing.

## What it is

- **`item_content`** is one row per linked item: the extracted markdown and,
  in the same row, the extraction job (status, attempts, `next_retry_at`, a
  short `claimed_until` lease). `source_url` is what was extracted; a changed
  item url reopens the job. Row-is-the-job, no queue table.
- **`chunks`** carries the embeddings, from three sources: the extracted
  content (`kind = content`, split by heading then paragraph,
  `lib/index/chunk.ts`), the item's notes with the `<card>` blocks stripped
  (`notes`), and each flashcard (`card`, front + back). Every chunk stores
  the text, a context line (`heading`: title / heading path), a content hash,
  the vector, and the model id that produced it.
- **Everything runs in the client.** A Web Worker (`lib/index-worker/`)
  owns the loop, the extractor ladder, and the embedding model; the server
  is storage only (`app/api/index/server.ts`: reconcile + lease jobs, store
  content, store embeddings, record failures) plus a fetch proxy
  (`app/api/fetch/server.ts`, SSRF-guarded) because browsers can't read
  other origins. Nothing schedules on the server, so it runs on Vercel's
  free tier. The app starts the worker once (`lib/index-client.ts`), every
  successful mutation and every sync ping kicks it, and the settings menu
  reads its progress through `useIndexProgress`. React never owns the loop.
- **The extractor ladder** (`lib/index-worker/extract.ts`): YouTube (oEmbed
  + the watch page's description; transcripts are still blocked upstream),
  arXiv (API abstract + PDF text), PDF (pdfjs text layer, in a nested
  worker), and Readability + turndown over a linkedom DOM for everything
  else (workers have no DOMParser). `UnsupportedContentError` is terminal
  (403, cookie walls, no text layer); anything else retries with backoff
  (1h, 6h, then failed), bookkept by the server.
- **Embeddings** (`lib/index-worker/embed.ts`): nomic-embed-text v1.5 via
  transformers.js, fp16 on WebGPU (about 12 chunks/s on an M4 Pro) and 8-bit
  on wasm (under 1/s). Weights come from Hugging Face on first use and are
  cached by the browser. The model id stored on chunks is device-independent
  (`browser:nomic-embed-text-v1.5`) so two devices with different backends
  never re-embed each other's work. Search only ranks chunks whose model
  matches the query's, and the worker re-embeds mismatches, so changing the
  model is a slow re-embed, not a broken index.
- **Query embeddings come from the same worker.** That is why the agent's
  `semantic_search` is a client-executed tool: the server defines it without
  `execute`, `use-ask.ts` catches the call, embeds the query in the worker,
  runs the `semanticSearch` action (vector in, ranked rows out), and sends
  the output back with `addToolOutput`; `sendAutomaticallyWhen` resumes the
  agent. The MCP server has no semantic tool for the same reason.
- **Semantic search** (`lib/semantic-search.server.ts`): cosine over
  `chunks`, folded to items (best chunk wins, all matching kinds reported)
  or to cards. HNSW index in `db/setup.sql`.
- **The agents** (`app/api/ask/*`): one route, two modes. `search` is the old
  Ask with `semantic_search` and `read_item` added; `review` compiles a
  stack and ends on `present_review` (title, summary, whole item ids,
  individual card ids). The client turns that into a `ReviewStack`
  (`components/shell/review-queues.ts#buildReviewStack`) and the review pane
  runs it in Topic mode. Rating a due or new card in a stack schedules it;
  rating one that isn't due yet is a cram pass.

## Things learned

- **NUL bytes.** PDF text layers contain U+0000 and other control
  characters, and Postgres `text` rejects NUL: the first backfill lost 8 items
  to "Failed query: update item_content". Strip control characters at the
  extractor boundary (`sanitize` in extract.ts), not at the DB.
- **`db:push` handled the `vector` column fine** on the local stack (pgvector
  0.8 was already installed). The HNSW index, grants, RLS and policies for
  the two new tables live in `db/setup.sql` as usual: push first, setup
  second.
- **Scores from nomic compress.** A strong hit is ~0.6, a loose one ~0.5,
  noise below ~0.45. The prompts say so; without that the model treats 0.6 as
  weak.
- **The model gives up too easily.** With flash-lite, "distributed systems"
  found the right sources but presented an empty stack because none of them
  had cards. The prompt now tells it to include on-topic sources regardless
  (the stack card lists them with "no cards" so the gap is visible) and to be
  generous with neighbouring cards. `REVIEW_MODEL` / `ASK_MODEL` override the
  model per mode when a stronger one is worth its rate limit.
- **Three schedulers were tried in one day.** A React Query interval in the
  shell (worked, but lived in React and stopped with the window), then a
  server-side worker kicked by writes with a cron heartbeat (clean, but the
  cron needs Vercel Pro), then this: a Web Worker in the client with the
  server as dumb storage. The last one is the design.
- **ONNX runtime assets can't be bundled by hand.** Importing
  `onnxruntime-web/dist/*.mjs?url` fails on the package's exports map, and a
  relative import loads a loader variant that doesn't match the bundle
  transformers.js picks ("webgpuInit is not a function"). Leave `wasmPaths`
  alone: transformers.js fetches the matching loader from its pinned CDN
  path once, and the browser caches it.
- **8-bit weights are the wrong dtype for WebGPU.** q8 ran at 0.8 chunks/s
  on the GPU; fp16 runs at 12/s. Keep q8 for the wasm fallback.
- **Vite needs `worker: { format: "es" }`** for the worker's dynamic imports,
  and `@huggingface/transformers` must be excluded from `optimizeDeps`.
- **Local verification without a password.** `.env.localdev` carries
  `MOCK_USER_ID` for the `db:setup-local` user, so the local Electron window
  is signed in as that user with no session. Check which stack `.env.local`
  points at before any CLI database command.
- **Commit early.** The whole first build of this lived uncommitted in a
  worktree that was deleted, and was rebuilt from the session transcript.
