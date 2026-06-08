"""Multi-resolution view of the reading list: one UMAP map, re-clustered at
increasing granularity so you can "zoom in" from a few big topics to many.

A single Ward linkage tree is cut at each level, so every level is a clean
refinement of the coarser one above it (big clusters split, never reshuffle).

Outputs:
  - figures/zoom_grid.png   grid of UMAP panels, one per cluster count
  - figures/dendrogram.png  the full Ward merge tree
  - data/items_levels.parquet  items + a cluster column per level (level_k)

Run with: `uv run zoom.py`.
"""

from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import polars as pl
import seaborn as sns
from scipy.cluster.hierarchy import dendrogram, fcluster, linkage
from umap import UMAP

ROOT = Path(__file__).parent
DATA = ROOT / "data"
FIGURES = ROOT / "figures"

# Cluster counts to show, coarse -> fine. Each is a deeper cut of the same tree.
LEVELS = [2, 3, 4, 6, 8, 11, 15, 20, 26]


def main() -> None:
    df = pl.read_parquet(DATA / "items_embedded.parquet")
    emb = np.load(DATA / "embeddings.npy")

    # One shared 2-D map for every panel (so points never move between zooms).
    coords = UMAP(
        n_components=2, n_neighbors=15, min_dist=0.1, metric="cosine", random_state=42
    ).fit_transform(emb)

    # Cluster the 2-D map itself so each zoom level reads as clean, contiguous
    # regions. The map is a faithful semantic projection of the embeddings
    # (neighbors sit together), so these clusters stay meaningful — and the
    # nesting is visually legible, which is the whole point of the zoom grid.
    # (hierarchy.py clusters in high-D instead, trading legibility for fidelity.)
    Z = linkage(coords, method="ward")

    # Cut the tree at each level -> nested labelings.
    level_labels = {k: fcluster(Z, t=k, criterion="maxclust") for k in LEVELS}

    # --- Grid of zoom panels ---------------------------------------------------
    sns.set_theme(style="white")
    cols = 3
    rows = (len(LEVELS) + cols - 1) // cols
    fig, axes = plt.subplots(rows, cols, figsize=(cols * 5, rows * 4.3))
    for ax, k in zip(axes.flat, LEVELS):
        labels = level_labels[k]
        palette = np.array(sns.color_palette("husl", k))
        ax.scatter(coords[:, 0], coords[:, 1], c=palette[labels - 1], s=22, linewidths=0)
        ax.set_title(f"{k} clusters", fontsize=12, fontweight="bold")
        ax.set_xticks([]); ax.set_yticks([])
    # Blank any unused cells.
    for ax in axes.flat[len(LEVELS):]:
        ax.axis("off")
    fig.suptitle(
        "Reading list — zoom levels (Ward tree cut at increasing k, shared UMAP map)",
        fontsize=15, fontweight="bold",
    )
    fig.tight_layout(rect=(0, 0, 1, 0.98))
    fig.savefig(FIGURES / "zoom_grid.png", dpi=120, bbox_inches="tight")
    plt.close(fig)

    # --- Full dendrogram -------------------------------------------------------
    plt.figure(figsize=(16, 7))
    dendrogram(Z, no_labels=True, color_threshold=Z[-(LEVELS[3] - 1), 2])
    plt.title(f"Ward merge tree (colors ≈ {LEVELS[3]} clusters)")
    plt.ylabel("merge distance")
    plt.savefig(FIGURES / "dendrogram.png", dpi=130, bbox_inches="tight")
    plt.close()

    # --- Persist per-level labels ---------------------------------------------
    out = df.with_columns(
        [pl.Series(f"level_{k}", level_labels[k]) for k in LEVELS]
    )
    out.write_parquet(DATA / "items_levels.parquet")

    print(f"levels: {LEVELS}")
    for k in LEVELS:
        sizes = np.bincount(level_labels[k])[1:]
        print(f"  k={k:>2}: sizes {sorted(sizes, reverse=True)}")
    print("\nwrote figures/zoom_grid.png, figures/dendrogram.png")
    print("wrote data/items_levels.parquet")


if __name__ == "__main__":
    main()
