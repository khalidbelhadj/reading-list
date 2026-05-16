CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS items_title_trgm_idx
  ON items USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS items_notes_trgm_idx
  ON items USING gin (notes gin_trgm_ops);

CREATE INDEX IF NOT EXISTS flashcards_front_trgm_idx
  ON flashcards USING gin (front gin_trgm_ops);

CREATE INDEX IF NOT EXISTS flashcards_back_trgm_idx
  ON flashcards USING gin (back gin_trgm_ops);
