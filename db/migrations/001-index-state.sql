-- Collapse item_content's job bookkeeping into one state column with a typed
-- failure reason.
--
-- Before: status (pending/ok/failed/unsupported) × embedding IS NULL ×
-- embedding_model != active × error × embedding_error — five columns whose
-- combinations had to be decoded to answer "is this item searchable?", and
-- which had no name for the most common state (extracted, but no vector, so
-- invisible to search).
--
-- After: state is the answer. `ready` means extracted AND embedded on the
-- current model. Everything else is pending, running, or failed-with-a-reason.
--
-- ADDITIVE ON PURPOSE. The old columns are left in place and still populated
-- with whatever they last held, so this is reversible by pointing the code
-- back at them. 002 drops them once the new pipeline has run for a while.

ALTER TABLE public.item_content
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS failure_detail text;

-- Backfill. Ordered most-settled first so each UPDATE only touches rows the
-- previous ones didn't claim.

-- Extracted and carrying a vector: ready. The model check is deliberately
-- omitted here — a row on a previous model is handled by the re-embed pass,
-- and marking the whole corpus pending during a migration would be a worse
-- first impression than letting it converge.
UPDATE public.item_content
   SET state = 'ready'
 WHERE status = 'ok' AND embedding IS NOT NULL;

-- Extracted but never embedded: back in the queue. The extracted text is
-- kept, so these skip straight to the embed step.
UPDATE public.item_content
   SET state = 'pending'
 WHERE status = 'ok' AND embedding IS NULL;

-- "unsupported" was always exactly one thing: nothing article-shaped there.
UPDATE public.item_content
   SET state = 'failed',
       failure_reason = 'not_readable',
       failure_detail = error
 WHERE status = 'unsupported';

-- Terminal extraction failures. This is the one and only place the old
-- free-text errors are pattern-matched — the whole point of the change is
-- that nothing has to do this again.
UPDATE public.item_content
   SET state = 'failed',
       failure_detail = error,
       failure_reason = CASE
         WHEN error ILIKE '%status 401%'
           OR error ILIKE '%status 403%'
           OR error ILIKE '%status 429%'       THEN 'blocked'
         WHEN error ILIKE '%status 404%'
           OR error ILIKE '%status 410%'
           OR error ILIKE '%no readable article%'
           OR error ILIKE '%no extractable text%'
           OR error ILIKE '%unsupported content type%' THEN 'not_readable'
         WHEN error ILIKE '%size cap%'          THEN 'too_large'
         WHEN error ILIKE '%invalid url%'
           OR error ILIKE '%invalid scheme%'
           OR error ILIKE '%blocked hostname%'
           OR error ILIKE '%private ip%'
           OR error ILIKE '%resolve hostname%'  THEN 'invalid_url'
         WHEN error ILIKE '%timeout%'
           OR error ILIKE '%aborted%'
           OR error ILIKE '%status 5%'          THEN 'unreachable'
         ELSE 'internal'
       END
 WHERE status = 'failed';

-- Anything still pending stays pending; attempts/next_retry_at no longer mean
-- anything, so rows that were mid-backoff or out of attempts simply rejoin the
-- queue. That includes the rows that were permanently unclaimable.
UPDATE public.item_content
   SET state = 'pending', failure_reason = NULL, failure_detail = NULL
 WHERE status = 'pending';

-- The claim index keyed on (status, next_retry_at); the loop keys on state.
CREATE INDEX IF NOT EXISTS item_content_state_idx
  ON public.item_content (state);

-- Nothing reads (status, next_retry_at) any more.
DROP INDEX IF EXISTS public.item_content_claim_idx;
