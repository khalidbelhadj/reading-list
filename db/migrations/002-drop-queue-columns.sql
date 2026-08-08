-- Follow-up to 001. NOT part of the switch — run this only once the new
-- pipeline has been running long enough that rolling back is off the table,
-- because these columns are the rollback.
--
-- Everything here was bookkeeping for a lease-and-backoff queue protocol that
-- no longer exists: one loop claims a row, does the work, and records the
-- outcome. There are no attempts to count and no retry to schedule — retrying
-- is a button.

ALTER TABLE public.item_content
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS attempts,
  DROP COLUMN IF EXISTS next_retry_at,
  DROP COLUMN IF EXISTS error,
  DROP COLUMN IF EXISTS embedding_error;
