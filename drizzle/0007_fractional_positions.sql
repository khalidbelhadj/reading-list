ALTER TABLE "items"
  ALTER COLUMN "position" TYPE double precision
  USING "position"::double precision;

ALTER TABLE "items"
  ALTER COLUMN "position" SET DEFAULT 0;
