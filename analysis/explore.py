"""First pass over the embedded snapshot: NN sanity check + clustering + UMAP.

Run with: `uv run explore.py`. Writes figures/clusters.png.
"""

from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import polars as pl
import seaborn as sns
from sklearn.cluster import KMeans

ROOT = Path(__file__).parent
DATA = ROOT / "data"
FIGURES = ROOT / "figures"
N_CLUSTERS = 8


def nearest_neighbors(titles: list[str], emb: np.ndarray, query: int, k: int = 5):
    # emb is L2-normalized, so the dot product is cosine similarity.
    sims = emb @ emb[query]
    order = np.argsort(-sims)
    return [(titles[j], float(sims[j])) for j in order if j != query][:k]


def main() -> None:
    df = pl.read_parquet(DATA / "items_embedded.parquet")
    emb = np.load(DATA / "embeddings.npy")
    titles = df["title"].to_list()

    # --- 1. Nearest-neighbor sanity check -------------------------------------
    print("=== nearest-neighbor sanity check ===")
    for q in (0, len(titles) // 2, len(titles) - 1):
        print(f"\n[{titles[q]}]")
        for title, sim in nearest_neighbors(titles, emb, q):
            print(f"  {sim:.3f}  {title}")

    # --- 2. KMeans clustering -------------------------------------------------
    km = KMeans(n_clusters=N_CLUSTERS, random_state=42, n_init=10)
    labels = km.fit_predict(emb)
    df = df.with_columns(pl.Series("cluster", labels))

    print(f"\n=== {N_CLUSTERS} KMeans clusters ===")
    for c in range(N_CLUSTERS):
        members = df.filter(pl.col("cluster") == c)
        # The 3 items closest to the centroid = the cluster's "theme".
        idx = np.where(labels == c)[0]
        centroid = emb[idx].mean(axis=0)
        closest = idx[np.argsort(-(emb[idx] @ centroid))[:3]]
        print(f"\ncluster {c}  (n={members.height})")
        for j in closest:
            print(f"  - {titles[j]}")

    # --- 3. UMAP 2-D projection ----------------------------------------------
    from umap import UMAP

    coords = UMAP(
        n_neighbors=15, min_dist=0.1, metric="cosine", random_state=42
    ).fit_transform(emb)

    FIGURES.mkdir(exist_ok=True)
    sns.set_theme(style="white")
    plt.figure(figsize=(11, 8))
    sns.scatterplot(
        x=coords[:, 0],
        y=coords[:, 1],
        hue=labels,
        palette="tab10",
        s=60,
        legend="full",
    )
    plt.title(f"Reading list — {len(titles)} items, {N_CLUSTERS} clusters (bge-base + UMAP)")
    plt.xlabel("UMAP-1")
    plt.ylabel("UMAP-2")
    plt.legend(title="cluster", bbox_to_anchor=(1.02, 1), loc="upper left")
    out = FIGURES / "clusters.png"
    plt.savefig(out, dpi=130, bbox_inches="tight")
    print(f"\nwrote {out}")


if __name__ == "__main__":
    main()
