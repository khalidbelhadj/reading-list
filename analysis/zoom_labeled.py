"""Labeled multi-resolution zoom: name every cluster of the Ward tree.

Each cluster at each zoom level is a subtree (node) of one Ward linkage. We
collect the distinct nodes that show up across the chosen levels, label them
all in a SINGLE Gemini call, then reuse those names on:
  - figures/zoom_grid_labeled.png  panels with topic names at each cluster
  - the printed nested topic tree + data/topic_tree_ward.json

Run with: `uv run zoom_labeled.py`.
"""

from __future__ import annotations

import json
import textwrap
from collections import defaultdict
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import polars as pl
import seaborn as sns
from scipy.cluster.hierarchy import fcluster, linkage
from umap import UMAP

import llm

ROOT = Path(__file__).parent
DATA = ROOT / "data"
FIGURES = ROOT / "figures"

# Levels to label (kept modest so names stay legible on the panels).
LEVELS = [2, 3, 4, 6, 9, 12]


def main() -> None:
    df = pl.read_parquet(DATA / "items_embedded.parquet")
    emb = np.load(DATA / "embeddings.npy")
    titles = df["title"].to_list()
    n = emb.shape[0]

    coords = UMAP(
        n_components=2, n_neighbors=15, min_dist=0.1, metric="cosine", random_state=42
    ).fit_transform(emb)
    Z = linkage(coords, method="ward")  # same tree as zoom.py

    # Leaf set under every tree node (leaves are 0..n-1, merges are n..2n-2).
    node_leaves: dict[int, frozenset[int]] = {i: frozenset([i]) for i in range(n)}
    for j, (a, b, *_), in enumerate(zip(Z[:, 0], Z[:, 1], Z[:, 2], Z[:, 3])):
        node_leaves[n + j] = node_leaves[int(a)] | node_leaves[int(b)]
    leafset_to_node = {fs: nid for nid, fs in node_leaves.items()}
    root = 2 * n - 2

    # Map each level's flat clusters back to tree nodes.
    level_clusters: dict[int, tuple[np.ndarray, list[tuple[int, int]]]] = {}
    needed: set[int] = {root}
    for k in LEVELS:
        labels = fcluster(Z, t=k, criterion="maxclust")
        pairs = []
        for c in range(1, k + 1):
            node = leafset_to_node[frozenset(np.where(labels == c)[0])]
            needed.add(node)
            pairs.append((c, node))
        level_clusters[k] = (labels, pairs)

    # Parent of each needed node = smallest *larger* needed node containing it.
    by_size = sorted(needed, key=lambda nd: len(node_leaves[nd]))
    children: dict[int, list[int]] = defaultdict(list)
    for i, nd in enumerate(by_size):
        leaves = node_leaves[nd]
        for bigger in by_size[i + 1:]:
            if leaves < node_leaves[bigger]:
                children[bigger].append(nd)
                break

    # Representative titles (closest to the node centroid) for labeling.
    def rep_titles(node: int, k: int = 12) -> list[str]:
        idx = np.array(sorted(node_leaves[node]))
        if len(idx) <= k:
            return [titles[i] for i in idx]
        centroid = emb[idx].mean(axis=0)
        order = idx[np.argsort(-(emb[idx] @ centroid))]
        return [titles[i] for i in order[:k]]

    payload = [
        {"id": nd, "child_ids": sorted(children.get(nd, [])), "titles": rep_titles(nd)}
        for nd in by_size
    ]
    print(f"labeling {len(payload)} Ward-tree nodes in one call...")
    node_topic = llm.label_tree(payload)

    # --- Labeled zoom grid -----------------------------------------------------
    sns.set_theme(style="white")
    cols = 3
    rows = (len(LEVELS) + cols - 1) // cols
    fig, axes = plt.subplots(rows, cols, figsize=(cols * 6.2, rows * 5.2))
    for ax, k in zip(axes.flat, LEVELS):
        labels, pairs = level_clusters[k]
        palette = np.array(sns.color_palette("husl", k))
        ax.scatter(coords[:, 0], coords[:, 1], c=palette[labels - 1], s=26, linewidths=0)
        for c, node in pairs:
            pts = coords[labels == c]
            name = "\n".join(textwrap.wrap(node_topic[node].topic, 18))
            ax.annotate(
                name, (pts[:, 0].mean(), pts[:, 1].mean()),
                fontsize=8, fontweight="bold", ha="center", va="center",
                bbox=dict(boxstyle="round,pad=0.25", fc="white", ec="grey", alpha=0.8),
            )
        ax.set_title(f"{k} clusters", fontsize=13, fontweight="bold")
        ax.set_xticks([]); ax.set_yticks([])
    for ax in axes.flat[len(LEVELS):]:
        ax.axis("off")
    fig.suptitle("Reading list — labeled zoom levels (Ward tree)", fontsize=16, fontweight="bold")
    fig.tight_layout(rect=(0, 0, 1, 0.98))
    fig.savefig(FIGURES / "zoom_grid_labeled.png", dpi=120, bbox_inches="tight")
    plt.close(fig)

    # --- Nested topic tree -----------------------------------------------------
    print("\n=== Ward topic tree ===")

    def render(node: int, depth: int = 0) -> None:
        t = node_topic[node]
        print(f"{'  ' * depth}• {t.topic} (n={len(node_leaves[node])}) — {t.summary}")
        for c in sorted(children.get(node, []), key=lambda c: -len(node_leaves[c])):
            render(c, depth + 1)

    render(root)

    def to_json(node: int) -> dict:
        t = node_topic[node]
        return {
            "id": node,
            "topic": t.topic,
            "summary": t.summary,
            "size": len(node_leaves[node]),
            "children": [
                to_json(c)
                for c in sorted(children.get(node, []), key=lambda c: -len(node_leaves[c]))
            ],
        }

    (DATA / "topic_tree_ward.json").write_text(json.dumps(to_json(root), indent=2))
    print("\nwrote figures/zoom_grid_labeled.png, data/topic_tree_ward.json")


if __name__ == "__main__":
    main()
