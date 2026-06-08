"""HDBSCAN topic hierarchy over the embedded reading list.

Pipeline:
  1. UMAP-reduce the 768-d embeddings to a low-d space (helps density clustering).
  2. HDBSCAN -> flat clusters + a condensed cluster tree.
  3. Walk the condensed tree into a nested hierarchy of cluster nodes.
  4. Label every node with an LLM, bottom-up (leaves from titles, internal
     nodes from their children's topics).
  5. Render the labeled tree, export JSON, and save plots.

Run with: `uv run hierarchy.py`.
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

import hdbscan
import matplotlib.pyplot as plt
import numpy as np
import polars as pl
from umap import UMAP

import llm

ROOT = Path(__file__).parent
DATA = ROOT / "data"
FIGURES = ROOT / "figures"

# Tunables.
REDUCE_DIMS = 10
MIN_CLUSTER_SIZE = 5
MIN_SAMPLES = 3


def build_tree(clusterer: hdbscan.HDBSCAN, n_points: int):
    """Turn the condensed tree into child-cluster / member maps + the root id."""
    tree = clusterer.condensed_tree_.to_pandas()
    child_clusters: dict[int, list[int]] = defaultdict(list)
    direct_points: dict[int, list[int]] = defaultdict(list)
    for row in tree.itertuples():
        parent, child, size = int(row.parent), int(row.child), int(row.child_size)
        if size == 1:
            direct_points[parent].append(child)
        else:
            child_clusters[parent].append(child)
    root = int(tree["parent"].min())

    # All point indices beneath a node (memoized).
    members_cache: dict[int, list[int]] = {}

    def members(node: int) -> list[int]:
        if node not in members_cache:
            pts = list(direct_points[node])
            for c in child_clusters[node]:
                pts.extend(members(c))
            members_cache[node] = pts
        return members_cache[node]

    # Which condensed-tree nodes did HDBSCAN select as the flat clusters?
    try:
        selected = set(int(x) for x in clusterer.condensed_tree_._select_clusters())
    except Exception:  # noqa: BLE001 - private API; degrade quietly
        selected = set()

    return root, child_clusters, direct_points, members, selected


def main() -> None:
    df = pl.read_parquet(DATA / "items_embedded.parquet")
    emb = np.load(DATA / "embeddings.npy")
    titles = df["title"].to_list()
    n = emb.shape[0]

    # 1. UMAP reduction for clustering (cosine; tight min_dist for density).
    reduced = UMAP(
        n_components=REDUCE_DIMS,
        n_neighbors=15,
        min_dist=0.0,
        metric="cosine",
        random_state=42,
    ).fit_transform(emb)

    # 2. HDBSCAN.
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=MIN_CLUSTER_SIZE,
        min_samples=MIN_SAMPLES,
        metric="euclidean",
        cluster_selection_method="eom",
    ).fit(reduced)
    labels = clusterer.labels_
    n_flat = labels.max() + 1
    n_noise = int((labels == -1).sum())
    print(f"HDBSCAN: {n_flat} flat clusters, {n_noise}/{n} noise points\n")

    # 3. Build the condensed-tree hierarchy.
    root, child_clusters, direct_points, members, selected = build_tree(clusterer, n)

    # 4. Label every cluster node in a single LLM call (one request, not ~28).
    all_nodes = set(child_clusters) | {
        c for cs in child_clusters.values() for c in cs
    } | {root}
    # For leaf nodes, send the items closest to the node centroid (most
    # representative); for internal nodes, a spread of members is fine.
    def representative_titles(node: int, k: int = 15) -> list[str]:
        idx = np.array(members(node))
        if len(idx) <= k:
            return [titles[i] for i in idx]
        centroid = emb[idx].mean(axis=0)
        order = idx[np.argsort(-(emb[idx] @ centroid))]
        return [titles[i] for i in order[:k]]

    payload = [
        {
            "id": node,
            "child_ids": sorted(child_clusters.get(node, [])),
            "titles": representative_titles(node),
        }
        for node in sorted(all_nodes)
    ]
    print(f"labeling {len(payload)} nodes in one call...")
    node_topic = llm.label_tree(payload)

    # 5a. Render the labeled tree.
    print("\n=== topic hierarchy ===")

    def render(node: int, depth: int = 0) -> None:
        t = node_topic[node]
        size = len(members(node))
        mark = " *" if node in selected else ""
        print(f"{'  ' * depth}• {t.topic} (n={size}){mark} — {t.summary}")
        for c in sorted(child_clusters.get(node, []), key=lambda c: -len(members(c))):
            render(c, depth + 1)

    render(root)
    print("\n(* = cluster HDBSCAN selected as a flat cluster)")

    # 5b. Export the nested JSON.
    def to_json(node: int) -> dict:
        t = node_topic[node]
        return {
            "id": node,
            "topic": t.topic,
            "summary": t.summary,
            "size": len(members(node)),
            "selected": node in selected,
            "children": [
                to_json(c)
                for c in sorted(child_clusters.get(node, []), key=lambda c: -len(members(c)))
            ],
        }

    FIGURES.mkdir(exist_ok=True)
    (DATA / "topic_tree.json").write_text(json.dumps(to_json(root), indent=2))

    # Persist flat cluster labels back onto the items.
    df.with_columns(pl.Series("hdbscan_cluster", labels)).write_parquet(
        DATA / "items_clustered.parquet"
    )

    # 5c. Condensed-tree plot. The cluster-selection ellipses crash on some
    # matplotlib versions, so fall back to plotting without them.
    for select in (True, False):
        try:
            plt.figure(figsize=(12, 8))
            clusterer.condensed_tree_.plot(select_clusters=select)
            plt.title("HDBSCAN condensed tree" + (" (selected clusters circled)" if select else ""))
            plt.savefig(FIGURES / "condensed_tree.png", dpi=130, bbox_inches="tight")
            plt.close()
            break
        except Exception:  # noqa: BLE001
            plt.close()

    # 5d. 2-D UMAP scatter, leaf topics annotated at cluster centroids.
    coords = UMAP(
        n_components=2, n_neighbors=15, min_dist=0.1, metric="cosine", random_state=42
    ).fit_transform(emb)
    plt.figure(figsize=(13, 9))
    noise = labels == -1
    plt.scatter(coords[noise, 0], coords[noise, 1], c="lightgrey", s=25, label="noise")
    plt.scatter(
        coords[~noise, 0], coords[~noise, 1], c=labels[~noise], cmap="tab20", s=55
    )
    for cl in range(n_flat):
        pts = coords[labels == cl]
        cx, cy = pts[:, 0].mean(), pts[:, 1].mean()
        # Find the condensed-tree node for this flat cluster to fetch its topic.
        topic = next(
            (node_topic[nd].topic for nd in selected
             if set(members(nd)) == set(np.where(labels == cl)[0])),
            f"cluster {cl}",
        )
        plt.annotate(topic, (cx, cy), fontsize=9, fontweight="bold",
                     ha="center", va="center",
                     bbox=dict(boxstyle="round,pad=0.3", fc="white", ec="grey", alpha=0.85))
    plt.title(f"HDBSCAN topics — {n_flat} clusters, {n_noise} noise (bge-base + UMAP)")
    plt.xlabel("UMAP-1"); plt.ylabel("UMAP-2")
    plt.savefig(FIGURES / "hdbscan_topics.png", dpi=130, bbox_inches="tight")
    plt.close()

    print("\nwrote data/topic_tree.json, data/items_clustered.parquet")
    print("wrote figures/condensed_tree.png, figures/hdbscan_topics.png")


if __name__ == "__main__":
    main()
