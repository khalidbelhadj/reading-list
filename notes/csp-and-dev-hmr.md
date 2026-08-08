# CSP vs. dev HMR (2026-06-18)

**Symptom.** Every edit triggered a full page reload instead of a Fast Refresh
update. Slow, and it destroyed component state on every keystroke-sized change.

**Cause.** The dev Content-Security-Policy had no `'unsafe-eval'`. Fast Refresh
applies hot updates by `eval`-ing the new module, so the CSP blocked the update
and the dev client fell back to a full reload. The reload path is silent —
nothing in the console says "your CSP broke HMR", it just looks like HMR is
slow.

**Fix.** Allow `'unsafe-eval'` in the **dev-only** branch of the CSP builder
(now `lib/request-guard.ts`, which issues the per-request nonce and static
security headers). Production keeps the strict policy — it has no HMR client to
serve.

**Watch for:** any new CSP tightening needs the same dev carve-out, and the
symptom will again be "HMR feels broken" rather than a visible CSP violation.
Check the console for `Refused to evaluate` before assuming a bundler problem.
