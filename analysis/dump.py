"""Snapshot the reading-list items from Supabase into a local parquet/csv.

Read-only. Filters to the user in MOCK_USER_ID. Re-runnable — overwrites the
snapshot each time. Run with: `uv run dump.py`.
"""

from __future__ import annotations

import os
from pathlib import Path

import polars as pl
import psycopg
from dotenv import load_dotenv

from textprep import build_embed_text, domain_of

ROOT = Path(__file__).parent
DATA = ROOT / "data"

# items + aggregated tag names + flashcard count, for one user.
QUERY = """
select
  i.id,
  i.title,
  i.url,
  i.notes,
  i.starred,
  i.read,
  i.read_at,
  i.created_at,
  i.updated_at,
  coalesce(
    array_agg(distinct t.name) filter (where t.name is not null),
    '{}'
  ) as tags,
  (select count(*) from flashcards f where f.item_id = i.id) as flashcard_count
from items i
left join items_tags it on it.item_id = i.id
left join tags t on t.id = it.tag_id
where i.user_id = %s
group by i.id
order by i.created_at
"""


def main() -> None:
    load_dotenv(ROOT.parent / ".env.local")
    database_url = os.environ["DATABASE_URL"]
    user_id = os.environ["MOCK_USER_ID"]

    with psycopg.connect(database_url) as conn, conn.cursor() as cur:
        cur.execute(QUERY, (user_id,))
        cols = [d.name for d in cur.description]
        rows = cur.fetchall()

    df = pl.DataFrame([dict(zip(cols, r)) for r in rows], infer_schema_length=None)

    # Derived columns used downstream.
    df = df.with_columns(
        pl.struct(["title", "url", "notes", "tags"])
        .map_elements(
            lambda s: build_embed_text(s["title"], s["url"], s["notes"], s["tags"]),
            return_dtype=pl.String,
        )
        .alias("embed_text"),
        pl.col("url")
        .map_elements(domain_of, return_dtype=pl.String)
        .alias("domain"),
        pl.col("notes").fill_null("").str.len_chars().alias("notes_chars"),
        pl.col("tags").list.len().alias("tag_count"),
    )

    DATA.mkdir(exist_ok=True)
    df.write_parquet(DATA / "items.parquet")
    # CSV can't hold list columns; stringify tags for the human-readable copy.
    df.with_columns(pl.col("tags").list.join(", ")).write_csv(DATA / "items.csv")

    print(f"dumped {df.height} items -> data/items.parquet")
    print(f"  with notes:      {df.filter(pl.col('notes_chars') > 0).height}")
    print(f"  with tags:       {df.filter(pl.col('tag_count') > 0).height}")
    print(f"  with flashcards: {df.filter(pl.col('flashcard_count') > 0).height}")
    print(f"  median embed_text chars: "
          f"{int(df['embed_text'].str.len_chars().median())}")


if __name__ == "__main__":
    main()
