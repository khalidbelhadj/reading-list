"""Interactive 3-D map of the reading list, with a zoom-level switcher.

3-D UMAP of the embeddings, clustered with one Ward tree (cut at several
levels). Every cluster is LLM-named in a single call; the names appear in the
legend and on hover. A dropdown switches the coloring between zoom levels.

Outputs:
  - figures/viz3d.html   self-contained, open in a browser to rotate/zoom
  - figures/viz3d.png    static preview of the default level

Run with: `uv run viz3d.py`.
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

import numpy as np
import plotly.graph_objects as go
import polars as pl
from plotly.colors import qualitative
from scipy.cluster.hierarchy import fcluster, linkage
from umap import UMAP

import llm

ROOT = Path(__file__).parent
DATA = ROOT / "data"
FIGURES = ROOT / "figures"

LEVELS = [4, 6, 9, 12]
DEFAULT = 6
PALETTE = qualitative.Dark24 + qualitative.Light24


def model_tag() -> str:
    meta = DATA / "embed_meta.json"
    if meta.exists():
        return json.loads(meta.read_text()).get("model", "?").split("/")[-1]
    return "?"


def main() -> None:
    df = pl.read_parquet(DATA / "items_embedded.parquet")
    emb = np.load(DATA / "embeddings.npy")
    titles = df["title"].to_list()
    urls = df["url"].to_list()
    n = emb.shape[0]

    coords = UMAP(
        n_components=3, n_neighbors=15, min_dist=0.1, metric="cosine", random_state=42
    ).fit_transform(emb)
    Z = linkage(coords, method="ward")

    # Leaf sets per node + level->labels, then collect the nodes we'll name.
    node_leaves: dict[int, frozenset[int]] = {i: frozenset([i]) for i in range(n)}
    for j in range(len(Z)):
        a, b = int(Z[j, 0]), int(Z[j, 1])
        node_leaves[n + j] = node_leaves[a] | node_leaves[b]
    leafset_to_node = {fs: nd for nd, fs in node_leaves.items()}
    root = 2 * n - 2

    level_labels: dict[int, np.ndarray] = {}
    cluster_node: dict[tuple[int, int], int] = {}
    needed: set[int] = {root}
    for k in LEVELS:
        labels = fcluster(Z, t=k, criterion="maxclust")
        level_labels[k] = labels
        for c in range(1, k + 1):
            nd = leafset_to_node[frozenset(np.where(labels == c)[0])]
            cluster_node[(k, c)] = nd
            needed.add(nd)

    by_size = sorted(needed, key=lambda nd: len(node_leaves[nd]))
    children: dict[int, list[int]] = defaultdict(list)
    for i, nd in enumerate(by_size):
        for bigger in by_size[i + 1:]:
            if node_leaves[nd] < node_leaves[bigger]:
                children[bigger].append(nd)
                break

    def rep_titles(node: int, k: int = 12) -> list[str]:
        idx = np.array(sorted(node_leaves[node]))
        if len(idx) <= k:
            return [titles[i] for i in idx]
        centroid = emb[idx].mean(axis=0)
        return [titles[i] for i in idx[np.argsort(-(emb[idx] @ centroid))][:k]]

    payload = [
        {"id": nd, "child_ids": sorted(children.get(nd, [])), "titles": rep_titles(nd)}
        for nd in by_size
    ]
    print(f"labeling {len(payload)} Ward-tree nodes in one call...")
    node_topic = llm.label_tree(payload)

    # One Scatter3d trace per (level, cluster); only DEFAULT level visible first.
    fig = go.Figure()
    trace_level: list[int] = []
    for k in LEVELS:
        labels = level_labels[k]
        for c in range(1, k + 1):
            mask = labels == c
            topic = node_topic[cluster_node[(k, c)]].topic
            fig.add_trace(go.Scatter3d(
                x=coords[mask, 0], y=coords[mask, 1], z=coords[mask, 2],
                mode="markers",
                name=f"{topic} ({int(mask.sum())})",
                marker=dict(size=4, color=PALETTE[(c - 1) % len(PALETTE)], opacity=0.85),
                text=[f"<b>{titles[i]}</b><br>{topic}<br>{urls[i]}"
                      for i in np.where(mask)[0]],
                hoverinfo="text",
                visible=(k == DEFAULT),
            ))
            trace_level.append(k)

    # Dropdown: toggle which level's traces are visible.
    buttons = [
        dict(
            label=f"{k} clusters",
            method="update",
            args=[{"visible": [lv == k for lv in trace_level]},
                  {"title": f"Reading list — 3-D map, {k} clusters (Ward / {model_tag()} + UMAP)"}],
        )
        for k in LEVELS
    ]
    fig.update_layout(
        title=f"Reading list — 3-D map, {DEFAULT} clusters (Ward / {model_tag()} + UMAP)",
        updatemenus=[dict(buttons=buttons, active=LEVELS.index(DEFAULT),
                          x=0.0, xanchor="left", y=1.08, yanchor="top")],
        legend=dict(itemsizing="constant", title="cluster"),
        scene=dict(xaxis_title="UMAP-1", yaxis_title="UMAP-2", zaxis_title="UMAP-3"),
        margin=dict(l=0, r=0, t=60, b=0),
    )

    FIGURES.mkdir(exist_ok=True)
    fig.write_html(FIGURES / "viz3d.html", include_plotlyjs=True)
    print("wrote figures/viz3d.html")
    try:
        fig.write_image(FIGURES / "viz3d.png", width=1300, height=950, scale=2)
        print("wrote figures/viz3d.png")
    except Exception as exc:  # noqa: BLE001 - kaleido is optional for the preview
        print(f"(static png skipped: {type(exc).__name__})")


if __name__ == "__main__":
    main()
