"""Gemini-backed topic labeling for the whole cluster tree in ONE call.

Labeling each node with its own request hammered the free-tier rate limit
(~10 req/min) and stalled in backoff. Instead we send the entire tree —
every node's child ids + a sample of its member titles — in a single prompt
and get back one topic+summary per node. Falls back to TF-IDF keyword
extraction per node if the key is missing or the call fails.
"""

from __future__ import annotations

import os
import time
from functools import lru_cache

from dotenv import load_dotenv
from pydantic import BaseModel

# Per-model free-tier quotas; flash-lite has the most headroom for this.
MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash-lite")


class Topic(BaseModel):
    topic: str  # 2-5 word noun phrase
    summary: str  # one sentence


class NodeLabel(BaseModel):
    id: int
    topic: str
    summary: str


@lru_cache(maxsize=1)
def _client():
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))
    key = os.environ.get("GOOGLE_GENERATIVE_AI_API_KEY")
    if not key:
        return None
    from google import genai

    return genai.Client(api_key=key)


def _tfidf_fallback(texts: list[str]) -> Topic:
    from sklearn.feature_extraction.text import TfidfVectorizer

    try:
        vec = TfidfVectorizer(stop_words="english", max_features=2000, ngram_range=(1, 2))
        scores = vec.fit_transform(texts).sum(axis=0).A1
        terms = vec.get_feature_names_out()
        top = [terms[i] for i in scores.argsort()[::-1][:4]]
        return Topic(topic=", ".join(top), summary="(keyword fallback)")
    except Exception:  # noqa: BLE001 - e.g. empty vocabulary
        return Topic(topic="(unlabeled)", summary="")


def _build_prompt(nodes: list[dict]) -> str:
    blocks = []
    for nd in nodes:
        kids = nd["child_ids"]
        head = f"[node {nd['id']}]" + (f" children={kids}" if kids else " (leaf)")
        titles = "\n".join(f"  - {t}" for t in nd["titles"][:15])
        blocks.append(f"{head}\n{titles}")
    return (
        "I clustered a person's saved reading list (articles, papers, videos) "
        "into a topic hierarchy with HDBSCAN. Label EVERY node below.\n\n"
        "For each node id, return:\n"
        "  - topic: a concise 2-5 word noun phrase\n"
        "  - summary: one sentence on what unifies its items\n"
        "Nodes that list children are broader — give them a label that subsumes "
        "their child nodes. Leaf nodes are labeled from their item titles.\n\n"
        "Nodes:\n\n" + "\n\n".join(blocks)
    )


def label_tree(nodes: list[dict], retries: int = 4) -> dict[int, Topic]:
    """Label every node in one call. `nodes`: [{id, child_ids, titles}]."""
    client = _client()
    if client is not None:
        prompt = _build_prompt(nodes)
        delay = 5.0
        for attempt in range(retries):
            try:
                resp = client.models.generate_content(
                    model=MODEL,
                    contents=prompt,
                    config={
                        "response_mime_type": "application/json",
                        "response_schema": list[NodeLabel],
                        "temperature": 0.2,
                    },
                )
                labels = {nl.id: Topic(topic=nl.topic, summary=nl.summary)
                          for nl in (resp.parsed or [])}
                if labels:
                    # Backfill any node the model skipped.
                    for nd in nodes:
                        labels.setdefault(nd["id"], _tfidf_fallback(nd["titles"]))
                    return labels
                break
            except Exception as exc:  # noqa: BLE001
                msg = str(exc)
                transient = any(
                    s in msg for s in ("429", "RESOURCE_EXHAUSTED", "503", "UNAVAILABLE")
                )
                if attempt < retries - 1 and transient:
                    time.sleep(delay)
                    delay = min(delay * 2, 30)
                    continue
                print(f"  [llm fallback: {type(exc).__name__}: {msg[:120]}]")
                break
    return {nd["id"]: _tfidf_fallback(nd["titles"]) for nd in nodes}
