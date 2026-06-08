"""Build the text we feed the embedding model for each item.

Notes can contain inline flashcard blocks using standalone-line tags:

    <card id="...">
    <front>
    question
    </front>
    <back>
    answer
    </back>
    </card>

We keep the question/answer prose (it's good semantic signal) but drop the
structural tags so the model doesn't waste attention on markup. Mirrors the
tag grammar in lib/card-parse.ts (tags match only as whole, trimmed lines).
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

# Standalone structural tags to remove (line must be exactly the tag, trimmed).
_STRUCT_TAG = re.compile(
    r"^(?:</?card\b[^>]*>|</?front>|</?back>)$",
    re.IGNORECASE,
)


def strip_card_markup(notes: str | None) -> str:
    """Remove `<card>/<front>/<back>` structural lines, keep inner prose."""
    if not notes:
        return ""
    kept = [ln for ln in notes.splitlines() if not _STRUCT_TAG.match(ln.strip())]
    text = "\n".join(kept)
    # Collapse the blank-line runs the tag removal leaves behind.
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def domain_of(url: str | None) -> str:
    """Bare host for a URL, e.g. 'arxiv.org' (no www, no scheme)."""
    if not url:
        return ""
    host = (urlparse(url).netloc or "").lower()
    return host[4:] if host.startswith("www.") else host


def build_embed_text(
    title: str | None,
    url: str | None,
    notes: str | None,
    tags: list[str] | None,
) -> str:
    """Compose one document string per item for embedding.

    Order matters a little for short-context models: title first (strongest
    signal), then tags + domain as light topical hints, then the notes body.
    """
    parts: list[str] = []
    if title:
        parts.append(title.strip())
    if tags:
        parts.append("Tags: " + ", ".join(tags))
    domain = domain_of(url)
    if domain:
        parts.append(f"Source: {domain}")
    body = strip_card_markup(notes)
    if body:
        parts.append(body)
    return "\n".join(parts)
