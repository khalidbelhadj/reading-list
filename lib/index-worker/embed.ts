// The embedding model, in the worker: nomic-embed-text v1.5 (768 dims) via
// transformers.js, fp16 on WebGPU when the browser has it and 8-bit on wasm
// otherwise. Downloaded once from Hugging Face and cached by the browser;
// nothing leaves the machine.
//
// The model id is stored on every chunk it embeds; the server only ranks
// chunks whose model matches the query's, so changing this constant means
// the index re-embeds itself over time rather than mixing spaces.
import {
  env,
  type FeatureExtractionPipeline,
  pipeline,
} from "@huggingface/transformers";

const MODEL_NAME = "nomic-ai/nomic-embed-text-v1.5";
// Device-independent on purpose: WebGPU runs fp16 weights and wasm runs 8-bit
// ones, whose vectors differ only by quantisation noise. Encoding the dtype
// here would make two devices with different backends re-embed each other's
// chunks forever.
export const MODEL_ID = "browser:nomic-embed-text-v1.5";
const EMBEDDING_DIMENSIONS = 768;

// The ONNX runtime's wasm loader is fetched from transformers.js's pinned
// CDN path on first use (the loader variant must match the bundle it picks,
// which is why it is not served from here) and cached by the browser, like
// the model weights from Hugging Face.
env.allowLocalModels = false;

type Device = "webgpu" | "wasm";

type ProgressEvent = {
  status?: string;
  file?: string;
  loaded?: number;
  total?: number;
};

const detectDevice = async (): Promise<Device> => {
  const gpu = (
    navigator as { gpu?: { requestAdapter: () => Promise<unknown> } }
  ).gpu;
  if (!gpu) return "wasm";
  try {
    return (await gpu.requestAdapter()) ? "webgpu" : "wasm";
  } catch {
    return "wasm";
  }
};

let loading: Promise<FeatureExtractionPipeline> | null = null;

// Load (and cache) the pipeline. `onProgress` reports the download in 0..1.
export const loadEmbedder = (
  onProgress?: (fraction: number) => void,
): Promise<FeatureExtractionPipeline> => {
  if (!loading) {
    loading = (async () => {
      const device = await detectDevice();
      // Per-file download progress, folded into one fraction by bytes.
      const files = new Map<string, { loaded: number; total: number }>();
      const report = () => {
        let loaded = 0;
        let total = 0;
        for (const file of files.values()) {
          loaded += file.loaded;
          total += file.total;
        }
        if (total > 0) onProgress?.(Math.min(1, loaded / total));
      };
      // Quantised weights are the right size for wasm but map poorly onto
      // GPU kernels (8-bit ran at under one chunk a second); fp16 is the
      // fast path on WebGPU.
      const build = (target: Device) =>
        pipeline("feature-extraction", MODEL_NAME, {
          dtype: target === "webgpu" ? "fp16" : "q8",
          device: target,
          progress_callback: (event: ProgressEvent) => {
            if (event.status === "progress" && event.file && event.total) {
              files.set(event.file, {
                loaded: event.loaded ?? 0,
                total: event.total,
              });
              report();
            }
          },
        });
      try {
        return await build(device);
      } catch (error) {
        if (device === "webgpu") {
          console.warn("[index] WebGPU failed, falling back to wasm:", error);
          return build("wasm");
        }
        throw error;
      }
    })();
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
};

// nomic-embed-text is trained with task prefixes; leaving them off costs
// real retrieval quality.
export const embedTexts = async (
  texts: string[],
  kind: "document" | "query",
  onProgress?: (fraction: number) => void,
): Promise<number[][]> => {
  const embedder = await loadEmbedder(onProgress);
  const prefix = kind === "query" ? "search_query: " : "search_document: ";
  const output = await embedder(
    texts.map((text) => prefix + text),
    { pooling: "mean", normalize: true },
  );
  const rows = output.tolist() as number[][];
  for (const row of rows) {
    if (row.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Embedding has ${row.length} dims, expected ${EMBEDDING_DIMENSIONS}`,
      );
    }
  }
  return rows;
};
