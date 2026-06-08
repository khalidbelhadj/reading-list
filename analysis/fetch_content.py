"""Fetch the actual content behind each item's URL to enrich the embeddings.

Per-type handlers:
  - arxiv    -> title + abstract via the arXiv API
  - youtube  -> video title + transcript (youtube-transcript-api)
  - pdf      -> text of the first pages (PyMuPDF)
  - web      -> main article text (trafilatura); auto-routes to PDF if the URL
               actually serves application/pdf

Robust by design: every fetch is wrapped, results (including failures) are
cached per item under data/content_cache/<id>.json, so reruns are cheap and
only missing/failed items are retried. Concurrency via a thread pool.

Usage:
  uv run fetch_content.py            # fetch all (uses cache)
  uv run fetch_content.py --sample 3 # 3 of each kind, for validation
  uv run fetch_content.py --force    # ignore cache, refetch everything
"""

from __future__ import annotations

import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

import httpx
import polars as pl

ROOT = Path(__file__).parent
DATA = ROOT / "data"
CACHE = DATA / "content_cache"

MAX_CHARS = 20_000  # cap stored text per item
PDF_PAGES = 8
TIMEOUT = 30.0
WORKERS = 8
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
}


def classify(url: str) -> str:
    host = (urlparse(url).netloc or "").lower().replace("www.", "")
    low = url.lower()
    if "arxiv.org" in host:
        return "arxiv"
    if "youtube.com" in host or "youtu.be" in host:
        return "youtube"
    if low.endswith(".pdf"):
        return "pdf"
    return "web"


def _clip(text: str) -> str:
    text = re.sub(r"[ \t]+", " ", (text or "").strip())
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text[:MAX_CHARS]


# --- per-type handlers (each returns extracted text or raises) ----------------

# One shared, rate-limited arXiv client (the API 429s on concurrent hits, so
# arXiv items are fetched serially through this; it sleeps 3s between calls).
_ARXIV = None


def _arxiv_client():
    global _ARXIV
    if _ARXIV is None:
        import arxiv

        _ARXIV = arxiv.Client(delay_seconds=3.0, num_retries=5)
    return _ARXIV


def fetch_arxiv(url: str) -> str:
    import arxiv

    m = re.search(r"(\d{4}\.\d{4,5})", url) or re.search(r"(?:abs|pdf)/([^?#]+?)(?:v\d+)?$", url)
    if not m:
        raise ValueError("could not parse arxiv id")
    arxiv_id = m.group(1)
    result = next(_arxiv_client().results(arxiv.Search(id_list=[arxiv_id])))
    cats = ", ".join(result.categories)
    return f"{result.title}\n\nCategories: {cats}\n\n{result.summary}"


def fetch_wikipedia(url: str, client: httpx.Client) -> str:
    """Wikipedia blocks scraping its HTML (403); use the action API instead."""
    parts = urlparse(url)
    title = unquote(parts.path.split("/wiki/", 1)[1])
    r = client.get(f"https://{parts.netloc}/w/api.php", params={
        "action": "query", "prop": "extracts", "explaintext": 1,
        "redirects": 1, "titles": title, "format": "json",
    })
    r.raise_for_status()
    page = next(iter(r.json()["query"]["pages"].values()))
    extract = page.get("extract", "")
    if not extract:
        raise ValueError("no wiki extract")
    return f"{page.get('title', '')}\n\n{extract}"


def _youtube_id(url: str) -> str | None:
    host = urlparse(url).netloc.lower()
    if "youtu.be" in host:
        return urlparse(url).path.lstrip("/").split("/")[0] or None
    qs = parse_qs(urlparse(url).query)
    if "v" in qs:
        return qs["v"][0]
    m = re.search(r"/(?:embed|shorts|live|v)/([^/?#]+)", url)
    return m.group(1) if m else None


def _get(client: httpx.Client, url: str) -> httpx.Response:
    """GET with one retry on transient network timeouts."""
    last: Exception | None = None
    for _ in range(2):
        try:
            return client.get(url, follow_redirects=True)
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            last = exc
    raise last  # type: ignore[misc]


def fetch_youtube(url: str, client: httpx.Client) -> str:
    from youtube_transcript_api import YouTubeTranscriptApi

    vid = _youtube_id(url)
    if not vid:
        raise ValueError("could not parse youtube id")
    title = ""
    try:
        r = client.get("https://www.youtube.com/oembed",
                       params={"url": url, "format": "json"})
        if r.status_code == 200:
            title = r.json().get("title", "")
    except Exception:  # noqa: BLE001 - title is best-effort
        pass
    fetched = YouTubeTranscriptApi().fetch(vid, languages=["en", "en-US", "en-GB"])
    transcript = " ".join(snippet.text for snippet in fetched)
    return f"{title}\n\n{transcript}".strip()


def _pdf_text(data: bytes) -> str:
    import fitz  # PyMuPDF

    with fitz.open(stream=data, filetype="pdf") as doc:
        pages = [doc[i].get_text() for i in range(min(PDF_PAGES, doc.page_count))]
    return "\n".join(pages)


def fetch_pdf(url: str, client: httpx.Client) -> str:
    r = _get(client, url)
    r.raise_for_status()
    return _pdf_text(r.content)


def fetch_web(url: str, client: httpx.Client) -> str:
    import trafilatura

    host = urlparse(url).netloc.lower()
    if host.endswith("wikipedia.org") and "/wiki/" in url:
        return fetch_wikipedia(url, client)
    try:
        r = _get(client, url)
        r.raise_for_status()
    except httpx.HTTPStatusError as exc:
        # Some hosts 403 our client; trafilatura's own fetcher sometimes works.
        if exc.response.status_code in (403, 406):
            downloaded = trafilatura.fetch_url(url)
            extracted = trafilatura.extract(
                downloaded or "", include_comments=False, favor_recall=True
            )
            if extracted:
                return extracted
        raise
    ctype = r.headers.get("content-type", "").lower()
    if "application/pdf" in ctype or r.content[:5] == b"%PDF-":
        return _pdf_text(r.content)
    extracted = trafilatura.extract(
        r.text, include_comments=False, include_tables=True, favor_recall=True
    )
    if not extracted:
        raise ValueError("no main content extracted")
    return extracted


def fetch_one(item: dict, client: httpx.Client) -> dict:
    url, kind = item["url"], classify(item["url"])
    rec = {"id": item["id"], "url": url, "ctype": kind, "ok": False,
           "error": "", "text": "", "n_chars": 0}
    try:
        if kind == "arxiv":
            text = fetch_arxiv(url)
        elif kind == "youtube":
            text = fetch_youtube(url, client)
        elif kind == "pdf":
            text = fetch_pdf(url, client)
        else:
            text = fetch_web(url, client)
        text = _clip(text)
        if not text:
            raise ValueError("empty after extraction")
        rec.update(ok=True, text=text, n_chars=len(text))
    except Exception as exc:  # noqa: BLE001 - record failure, keep going
        rec["error"] = f"{type(exc).__name__}: {str(exc)[:160]}"
    return rec


def main() -> None:
    args = sys.argv[1:]
    force = "--force" in args
    sample = None
    if "--sample" in args:
        sample = int(args[args.index("--sample") + 1])

    df = pl.read_parquet(DATA / "items.parquet").select("id", "url", "title")
    items = df.to_dicts()
    for it in items:
        it["kind"] = classify(it["url"])

    if sample is not None:
        picked, seen = [], {}
        for it in items:
            if seen.get(it["kind"], 0) < sample:
                picked.append(it)
                seen[it["kind"]] = seen.get(it["kind"], 0) + 1
        items = picked

    CACHE.mkdir(parents=True, exist_ok=True)
    todo = []
    for it in items:
        cache_file = CACHE / f"{it['id']}.json"
        if cache_file.exists() and not force:
            rec = json.loads(cache_file.read_text())
            if rec.get("ok") or sample is not None:
                continue  # keep good results; in sample mode also skip cached
        todo.append(it)

    print(f"{len(items)} items, fetching {len(todo)} "
          f"({len(items) - len(todo)} cached)\n")

    def record(rec: dict, title: str) -> None:
        (CACHE / f"{rec['id']}.json").write_text(json.dumps(rec))
        status = "ok " if rec["ok"] else "FAIL"
        detail = f"{rec['n_chars']}c" if rec["ok"] else rec["error"][:60]
        print(f"  [{status}] {rec['ctype']:8} {title[:50]:50} {detail}")

    # arXiv must go serially through the shared rate-limited client; everything
    # else fans out across the thread pool.
    arxiv_todo = [it for it in todo if it["kind"] == "arxiv"]
    other_todo = [it for it in todo if it["kind"] != "arxiv"]
    with httpx.Client(headers=HEADERS, timeout=TIMEOUT) as client:
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futures = {pool.submit(fetch_one, it, client): it for it in other_todo}
            for fut in as_completed(futures):
                record(fut.result(), futures[fut]["title"])
        for it in arxiv_todo:
            record(fetch_one(it, client), it["title"])

    # Assemble full table from cache (all items, not just this run).
    all_recs = [json.loads((CACHE / f"{it['id']}.json").read_text())
                for it in items if (CACHE / f"{it['id']}.json").exists()]
    out = pl.DataFrame(all_recs)
    out.write_parquet(DATA / "content.parquet")

    ok = out.filter(pl.col("ok"))
    print(f"\n=== summary ===")
    print(out.group_by("ctype").agg(
        pl.len().alias("n"),
        pl.col("ok").sum().alias("ok"),
        pl.col("n_chars").filter(pl.col("ok")).median().alias("median_chars"),
    ).sort("n", descending=True))
    print(f"\noverall: {ok.height}/{out.height} ok -> data/content.parquet")


if __name__ == "__main__":
    main()
