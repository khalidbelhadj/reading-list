# analysis

Python data-analysis sandbox managed with [uv](https://docs.astral.sh/uv/).

## Stack

- **polars** — fast dataframes (primary)
- **pandas** — interop (seaborn needs it)
- **numpy / scipy** — numerics & stats
- **seaborn / matplotlib** — plotting
- **scikit-learn** — modelling
- **pyarrow** — parquet / arrow IO
- dev: **jupyterlab**, **ipykernel**

## Embedding pipeline

A snapshot of the reading-list items, embedded locally (default `bge-m3`, 1024-d)
for clustering / similarity analysis. Each step re-runnable:

```sh
uv run dump.py      # Supabase -> data/items.parquet + items.csv  (read-only)
uv run fetch_content.py # fetch URL content -> data/content.parquet (cached per item)
uv run embed.py     # -> data/items_embedded.parquet + embeddings.npy (L2-normalized)
uv run explore.py   # NN sanity check + KMeans + UMAP -> figures/clusters.png
uv run hierarchy.py # HDBSCAN condensed tree, LLM-labeled -> data/topic_tree.json + figures
uv run zoom.py      # multi-resolution Ward zoom grid -> figures/zoom_grid.png + dendrogram
uv run zoom_labeled.py # same grid, every cluster LLM-named -> figures/zoom_grid_labeled.png
uv run viz3d.py     # interactive 3-D map w/ zoom-level dropdown -> figures/viz3d.html
```

### Clustering views

- **`hierarchy.py`** — HDBSCAN in high-d (10-d UMAP), exposes the *condensed tree*
  and labels every node with one Gemini call (`gemini-2.5-flash-lite`; override
  with `GEMINI_MODEL`). Faithful but the big ML blob forms a deep "spine".
- **`zoom.py`** — one Ward tree cut at increasing `k` (2…26) over the shared 2-D
  UMAP map, so each panel is a clean *refinement* of the coarser one. Built for
  legibility (clusters the map itself); writes `level_k` columns to
  `data/items_levels.parquet`.

- **Embedding model** (`EMBED_MODEL=...` to override; default `BAAI/bge-m3`):
  big chunks are O(n²) without flash-attention, so `embed.py` uses short windows
  + chunk mean-pooling — keeping even billion-param models tractable on MPS.
  Tiers tried on an M4 Pro / 24GB: `bge-m3` (1024-d, fast, the sweet spot) ·
  `Qwen/Qwen3-Embedding-4B` (best quality, ~20 min/run, MPS is compute-bound) ·
  `Qwen/Qwen3-Embedding-0.6B` (fast). Note: `gte-Qwen2-1.5B`'s bundled remote
  code is **incompatible with transformers 5.x** (`rope_theta`), so it won't load.
- **Decoupled design:** raw text (`embed_text`) and vectors live in separate
  files, so swapping the embedding model is just a re-run of `embed.py`.
- **Content enrichment** (`fetch_content.py`): pulls the real text behind each
  URL — arXiv abstracts (API, serial/rate-limited), YouTube transcripts, PDF
  text (PyMuPDF), and web main-text (trafilatura; Wikipedia via its API).
  Results cache per item in `data/content_cache/`, so reruns only retry misses
  (`--force` to refetch, `--sample N` to validate). `embed.py` folds this in and
  **chunk + mean-pools** long docs so the whole document shapes the vector.
- `dump.py` filters to `MOCK_USER_ID` and reads `DATABASE_URL` from `../.env.local`.
- Embeddings are L2-normalized → dot product == cosine similarity.
- `textprep.py` strips inline `<card>` flashcard markup from notes (keeps the Q&A
  prose), mirroring the tag grammar in `../lib/card-parse.ts`.

## Usage

```sh
uv run jupyter lab      # interactive notebooks (use notebooks/)
uv add <package>        # add a dependency
uv run main.py          # toolchain smoke test
```

## Layout

```
data/        snapshot parquet/csv + embeddings.npy (gitignored)
notebooks/   exploratory notebooks
figures/     generated plots (gitignored)
dump.py      DB -> parquet snapshot
embed.py     parquet -> embeddings
explore.py   clustering / UMAP / nearest-neighbors
textprep.py  embedding-text construction (shared)
```
