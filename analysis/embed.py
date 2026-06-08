"""Embed each item with a local bge-base model, enriched with fetched content.

The embedding text is title + tags + domain + notes, plus the fetched page /
abstract / transcript (from fetch_content.py) when available. Because fetched
docs exceed bge-base's 512-token window, long text is split into chunks, each
chunk embedded, and the chunk vectors mean-pooled into one document vector — so
the whole document informs the embedding, not just its first 512 tokens.

Reads data/items.parquet (+ data/content.parquet if present), writes:
  - data/items_embedded.parquet  (item columns + an `embedding` list column)
  - data/embeddings.npy          (float32 [n, dim], row-aligned to the parquet)

Embeddings are L2-normalized, so dot product == cosine similarity downstream.
Run with: `uv run embed.py`.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
import polars as pl
import torch
from sentence_transformers import SentenceTransformer

ROOT = Path(__file__).parent
DATA = ROOT / "data"
# Override with EMBED_MODEL=... . Default is bge-m3: strong, 1024-dim, native
# (no remote code), and fast on Apple MPS. Heavier options that also work:
# Qwen/Qwen3-Embedding-4B (best quality, ~20 min on MPS), Qwen/Qwen3-Embedding-0.6B.
# (gte-Qwen2-1.5B's bundled code is incompatible with transformers 5.x.)
MODEL_NAME = os.environ.get("EMBED_MODEL", "BAAI/bge-m3")
MAX_CHUNKS = 16        # cap chunks per item to bound compute


def chunk_words(text: str, size: int, cap: int = MAX_CHUNKS) -> list[str]:
    words = text.split()
    if not words:
        return [text]
    chunks = [" ".join(words[i:i + size]) for i in range(0, len(words), size)]
    return chunks[:cap]


def main() -> None:
    df = pl.read_parquet(DATA / "items.parquet")

    content_path = DATA / "content.parquet"
    if content_path.exists():
        content = (
            pl.read_parquet(content_path)
            .filter(pl.col("ok"))
            .select("id", pl.col("text").alias("content"))
        )
        df = df.join(content, on="id", how="left")
        df = df.with_columns(pl.col("content").fill_null(""))
        n_with = df.filter(pl.col("content").str.len_chars() > 0).height
        print(f"joined fetched content: {n_with}/{df.height} items enriched")
    else:
        df = df.with_columns(pl.lit("").alias("content"))
        print("no content.parquet — embedding title/notes only")

    # Combined document text per item.
    full_texts = [
        (et + ("\n\n" + c if c else "")).strip()
        for et, c in zip(df["embed_text"].to_list(), df["content"].to_list())
    ]

    # Load the model. Big transformer embedders (Qwen/gte) run in fp16 on the
    # Mac's GPU (MPS); small BGE models are fine in fp32.
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    is_big = any(t in MODEL_NAME for t in ("Qwen", "gte-Qwen", "bge-m3", "e5-large"))
    model_kwargs = {"torch_dtype": torch.float16} if (is_big and device == "mps") else {}
    print(f"loading {MODEL_NAME} on {device}{' (fp16)' if model_kwargs else ''} ...")
    model = SentenceTransformer(
        MODEL_NAME, device=device, trust_remote_code=True, model_kwargs=model_kwargs
    )
    # Without flash-attention on MPS, attention is O(n^2): many small chunks are
    # far cheaper than one long pass (4*1024^2 << 4096^2). So we cap the window
    # short and mean-pool chunks, even for long-context models.
    if is_big:
        model.max_seq_length, chunk_size, batch_size = 1024, 384, 8
    else:
        model.max_seq_length, chunk_size, batch_size = 512, 307, 64

    chunk_texts: list[str] = []
    owner: list[int] = []
    for i, text in enumerate(full_texts):
        for ch in chunk_words(text, chunk_size):
            chunk_texts.append(ch)
            owner.append(i)
    owner_arr = np.array(owner)
    print(f"max_seq_len={model.max_seq_length}, ~{chunk_size} words/chunk -> "
          f"{len(chunk_texts)} chunks across {len(full_texts)} items")

    chunk_vecs = model.encode(
        chunk_texts, batch_size=batch_size, normalize_embeddings=True,
        show_progress_bar=True, convert_to_numpy=True,
    ).astype(np.float32)

    # Mean-pool each item's chunk vectors, then re-normalize.
    dim = chunk_vecs.shape[1]
    embeddings = np.zeros((len(full_texts), dim), dtype=np.float32)
    for i in range(len(full_texts)):
        pooled = chunk_vecs[owner_arr == i].mean(axis=0)
        norm = np.linalg.norm(pooled)
        embeddings[i] = pooled / norm if norm else pooled

    np.save(DATA / "embeddings.npy", embeddings)
    (DATA / "embed_meta.json").write_text(
        json.dumps({"model": MODEL_NAME, "dim": int(dim)})
    )
    out = df.drop("content").with_columns(
        pl.Series("embedding", embeddings.tolist(), dtype=pl.Array(pl.Float32, dim)),
        pl.Series("n_chunks", [int((owner_arr == i).sum()) for i in range(len(full_texts))]),
    )
    out.write_parquet(DATA / "items_embedded.parquet")

    print(f"\nembedded {embeddings.shape[0]} items, dim={dim}")
    print("wrote data/items_embedded.parquet + data/embeddings.npy")


if __name__ == "__main__":
    main()
