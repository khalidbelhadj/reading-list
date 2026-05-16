# Open issues sorted by severity

Top of list = highest priority. Pick the first one.

## #42 — CRITICAL

**[CRITICAL] SSRF in fetchPageTitle via DNS TOCTOU + follow-redirects**

## Where
- `app/actions/items.ts:84` → `lib/url.server.ts:26`

## What
`assertPublicUrl` resolves DNS and rejects private IPs; the subsequent `fetch(url, { redirect: "follow" })` re-resolves DNS independently and silently follows redirects to private IPs.

## Why it matters
Authenticated users can ask the server to fetch arbitrary URLs. An attacker controls the URL and returns a 302 to `http://169.254.169.254/...` (cloud metadata) or `http://localhost:5432/...` (Postgres). The 5s `AbortSignal.timeout` doesn't help — the redirect happens within that window. DNS rebinding is also feasible since `assertPublicUrl` and `fetch` do independent lookups.

`assertPublicUrl` also misses several private-IP encodings:
- IPv4-mapped IPv6 (`::ffff:127.0.0.1`)
- Octal (`0177.0.0.1`)
- Decimal (`2130706433`)
- CGNAT (`100.64.0.0/10`)
- Most of IPv6 ULA range (only checks `fc`/`fd` prefix on first 2 chars)

## Manifests in
- `fetchPageTitle` at `app/actions/items.ts:98` (`redirect: "follow"`)
- `fetchOembedTitle` at `app/actions/items.ts:55-65` — called *before* `assertPublicUrl` on YouTube hostnames; oembed proxy itself can follow redirects to private IPs
- `isPrivateIP` at `lib/url.server.ts:8-24` — incomplete encoding coverage

## Fix
- Use `redirect: "manual"`, resolve hostname once, pin to that IP via `Host` header
- Or use a hardened HTTP client (e.g. `undici` with a dispatcher intercepting on each connect)
- Re-check the destination on every hop of the redirect chain
- Block CGNAT (`100.64.0.0/10`), IPv4-mapped IPv6 (`::ffff:0:0/96`), and the full ULA range (`fc00::/7`)

---

## #43 — CRITICAL

**[CRITICAL] Unbounded response body in fetchPageTitle can OOM the server**

## Where
`app/actions/items.ts:107`

## What
`await res.text()` reads the entire HTTP response into memory with no size cap.

## Why it matters
Any authenticated user creating an item with a URL pointing at a multi-GB endpoint will OOM the Node process. `AbortSignal.timeout(5000)` only limits time-to-first-byte-style stalls; once the stream is flowing, 5 seconds is enough to push hundreds of MB. On Vercel's serverless this kills the function; on a long-lived server it can crash siblings.

## Manifests in
`app/actions/items.ts:107` only.

## Fix
Stream-read up to a fixed cap (~512 KB is plenty for `<title>`/`og:title` extraction), then abort:

```ts
const reader = res.body!.getReader();
let received = 0;
const chunks: Uint8Array[] = [];
const MAX = 512 * 1024;
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  received += value.byteLength;
  if (received > MAX) { reader.cancel(); break; }
  chunks.push(value);
}
const text = new TextDecoder().decode(concatChunks(chunks));
```

---

## #44 — CRITICAL

**[CRITICAL] tabItems useMemo mutates the React Query items array via .sort()**

## Where
`components/items-list/use-filters.ts:155-160`

## What
```ts
const tabItems = React.useMemo(
  () =>
    (items ?? [])
      .sort((a, b) => a.position - b.position),
  [items],
);
```

No `.slice()`. `Array.prototype.sort` mutates in place, so the items array inside React Query's cache is reordered on every render.

## Why it matters
Mutating cache-owned data violates React Query's invariants and React's rule that `useMemo` computations must be pure. The data comes back from the server already sorted by position (`fetchItems` uses `orderBy: [asc(items.position)]`), so this sort is redundant — but the mutation breaks reference equality for optimistic-update consumers:

- `useMutation.onMutate` callbacks use `setQueryData(["items"], (old) => …)` where `old` is the same array reference. If a previous render mutated `old` via sort, the optimistic input is the post-sort array; any downstream consumer holding a snapshot reads new content.
- This is the kind of bug that surfaces as "sometimes the drag reverts" or "the optimistic title flicker shows old data" — hard to reproduce, easy to misattribute.

## Manifests in
`components/items-list/use-filters.ts:158` only. (Other `.sort()` calls — `components/items-list.tsx:364`, `components/items-list/use-keyboard-navigation.ts:137` — correctly use `.slice()` first.)

## Fix
`[...(items ?? [])].sort(...)` or just drop the sort — the SSR query and `fetchItems` already order by position. The drag-end optimistic update is the only place that needs to re-sort, and it already does.

---

## #45 — HIGH

**[HIGH] MutationCache.onError invalidates the entire query cache**

## Where
`components/query-provider.tsx:18-27`

## What
Any failed mutation calls `queryClient.invalidateQueries()` with no key argument → marks every query stale → refetches everything currently mounted.

```ts
mutationCache: new MutationCache({
  onError: (error) => {
    if (error instanceof Error && error.message === "Unauthorized") {
      window.location.href = "/login";
      return;
    }
    toast.error(error instanceof Error ? error.message : "Something went wrong");
    queryClient.invalidateQueries();
  },
}),
```

## Why it matters
A single transient error (e.g. a flaky `toggleRead`) triggers refetches for `items`, `all-flashcards`, `review-status`, `current-user`, plus any per-item flashcards currently mounted. With React Query's default network mode each refetch hits the server. The `withUser` setup logs ~25ms per query plus the actual query cost — that's a thundering herd against Supabase right after one user action fails. The toast says "Something went wrong" while the UI starts refetching aggressively, masking the original failure mode.

## Manifests in
`components/query-provider.tsx:25` — only call site.

## Fix
Drop the invalidate or scope it. Each optimistic-update mutation already has its own `onError` rollback; the global handler should just toast.

---

## #46 — HIGH

**[HIGH] safeAction swallows zod validation errors and shows generic 'try again' message**

## Where
- `lib/safe-action.ts:10-25`
- `lib/schemas.ts:5-7`

## What
`parseInput` throws plain `Error(message)`:
```ts
if (!result.success) {
  throw new Error(result.error.issues[0].message);
}
```

`safeAction` catches everything that isn't `ActionError`/`UnauthorizedError` and re-throws `new ActionError(errorMessage)` with the function's generic message:
```ts
if (error instanceof ActionError || error instanceof UnauthorizedError) {
  throw error;
}
throw new ActionError(errorMessage);
```

## Why it matters
Every validation message the schemas carefully construct ("URL must be under 2048 characters", "Cannot delete more than 100 items at once", "Rating must be 1-4 (again, hard, good, easy)") is replaced with "Could not create item. Please try again." The user retries — same error. This guts validation UX across every server action and the MCP route.

## Manifests in
Every `safeAction`-wrapped function in `app/actions/*.ts`:
- `createItem`, `updateItem`, `bulkDeleteItems`, `bulkTag`, `bulkMarkRead`
- `renameTag`, `deleteTag`
- `createFlashcard`, `updateFlashcard`, `deleteFlashcard`
- `startReviewSession`, `rateCard`, `skipCard`, `endReviewSession`, `logSessionEvent`
- ~20 actions total

## Fix
One-line change — make `parseInput` throw `ActionError`:
```ts
if (!result.success) throw new ActionError(result.error.issues[0].message);
```

---

## #47 — HIGH

**[HIGH] N+1 query bursts in tag and flashcard library functions**

## Where
Across `lib/tags.ts`, `lib/flashcards.ts`, `app/actions/items.ts:bulkTag`.

## What
Hot paths do per-iteration queries inside loops. Inside `withUser` (a single transaction that holds the Postgres connection state), this is sequential and round-trip-bound.

## Why it matters
With Supabase's network latency (~10-25ms RTT), creating one item with 5 tags is `2 (item insert + position shift) + 2*5 (tag upsert+select) + 5 (item_tags insert) = ~17 round trips`. `bulkTag(100 items, 10 tags)` is **1000+ round trips**. Visible as 5-15s server actions for what should be sub-second batches.

## Manifests in
- `ensureTagsLinked` at `lib/tags.ts:29-51` — loop: insert tag → select tag → insert items_tags. ~3 round trips per tag name.
- `syncItemTags` at `lib/tags.ts:53-97` — same N+1, plus a separate loop to delete removed links one-by-one.
- `createFlashcards` at `lib/flashcards.ts:20-59` — per-input ownership SELECT then INSERT.
- `updateFlashcards` at `lib/flashcards.ts:67-100` — per-input ownership SELECT then UPDATE.
- `deleteFlashcards` at `lib/flashcards.ts:102-127` — per-id ownership SELECT then DELETE.
- `bulkTag` at `app/actions/items.ts:218-235` — owned-items SELECT (good), then per-item `ensureTagsLinked` (which is itself N+1).
- `createItems` at `lib/items.ts:30-46` — per-input INSERT, then ensureTagsLinked.

## Fix
Batch each pattern. Example for `ensureTagsLinked`:

```ts
// 1 round trip: insert all names with ON CONFLICT DO NOTHING
await tx.insert(tags).values(tagNames.map(name => ({ userId, name }))).onConflictDoNothing();

// 1 round trip: select all matching tag ids
const found = await tx.select({ id: tags.id, name: tags.name })
  .from(tags).where(and(eq(tags.userId, userId), inArray(tags.name, tagNames)));

// 1 round trip: bulk insert links
await tx.insert(itemsTags).values(found.map(t => ({ itemId, tagId: t.id }))).onConflictDoNothing();
```

For flashcards: batch ownership check with `inArray(items.id, inputIds)` then run inserts/updates/deletes via single statements. For `bulkTag`, hoist the tag upsert/select out of the per-item loop.

---

## #48 — HIGH

**[HIGH] reorderItem and recompactPositions rewrite every item position on each drag/delete**

## Where
- `app/actions/items.ts:159-197` (reorderItem)
- `lib/items.ts:135-148` (recompactPositions, called by deleteItems)

## What
`reorderItem` reads `id, position` for every item the user owns, splices in JS, then UPDATEs every changed row in one statement.

`deleteItems` calls `recompactPositions` after every delete, which performs the same full rewrite.

## Why it matters
Even one-position swaps re-emit the whole reindex. With `withUser` adding ~25ms setup per transaction, each drag costs SELECT-all + UPDATE-all. For 1000+ items this is hundreds of ms per drag — and the user drags rapidly during reorganization. `recompactPositions` after every single-item delete has the same cost.

## Manifests in
- `reorderItem` at `app/actions/items.ts:166-194`
- `recompactPositions` called from `deleteItems` at `lib/items.ts:130` — runs after every delete, including single-item

## Fix
Use a fractional-position scheme (sparse floats, or LexoRank/Mudder-style strings). A reorder becomes a single UPDATE setting one item's position to the midpoint between its new neighbors. Recompact lazily (e.g. when positions get too dense).

Migration caveat: requires a column type change + one-time backfill. Short-term: skip the work when `newPosition === currentIndex` and fix the broken post-splice diff (see separate issue on the no-op filter).

---

## #49 — HIGH

**[HIGH] createItems shifts every existing position then inserts in a loop**

## Where
`lib/items.ts:15-49`

## What
```ts
await tx
  .update(items)
  .set({ position: sql`${items.position} + ${inputs.length}` })
  .where(eq(items.userId, userId));

for (let idx = 0; idx < inputs.length; idx++) {
  await tx.insert(items).values({...});
  await ensureTagsLinked(tx, userId, itemId, input.tagNames ?? []);
}
```

`UPDATE items SET position = position + N` rewrites every existing row, then per-input INSERT in a loop.

## Why it matters
Adding one item rewrites N rows. Adding via MCP `create_items` with 50 items is still one full rewrite (`+ 50`), but the per-item INSERT loop is 50 sequential round trips plus 50× `ensureTagsLinked` (each itself N+1). Becomes the bottleneck for bulk-import flows.

## Manifests in
- The global position shift at `lib/items.ts:25-29`
- The per-input insert loop at `lib/items.ts:30-46`

## Fix
With fractional positions (see related reorder issue), insertion at the top is a single INSERT with `position = min(existing) - 1`. Short-term: batch the INSERT into one statement (`tx.insert(items).values(rows)`) and call `ensureTagsLinked` once per tag-set rather than per item.

---

## #50 — HIGH

**[HIGH] Fuzzy search ILIKE %token% patterns underutilize the trigram GIN indexes**

## Where
- `lib/search.ts:104-125` (fuzzySearch)
- `lib/search.ts:229-247` (fuzzySearchFlashcards)

## What
The WHERE clause builds `i.title ILIKE %token%` predicates. Trigram GIN indexes (`items_title_trgm_idx`, etc.) speed up `%>` and `ILIKE` when the planner picks them, but mixing `ILIKE '%foo%'` with `OR i.title %> token` on the same column may produce bitmap scans that still touch every row for tokens with very common trigrams. Short tokens (<3 chars) can't use trigram at all.

## Why it matters
As item count grows past a few thousand, fuzzy search degrades toward seq-scan cost. The 10s `statement_timeout` is a backstop, not a performance fix. Compounded by `withUser` holding the Postgres connection.

## Manifests in
- `fuzzySearch` at `lib/search.ts:95`
- `fuzzySearchFlashcards` at `lib/search.ts:220`

## Fix
Run `EXPLAIN ANALYZE` against representative data — the user already has perf instrumentation. Drop `ILIKE` for tokens under 3 chars (trigram ineffective anyway) and require `pattern.length >= 3` for trigram-based fuzzy. Long-term: Postgres FTS (`tsvector` + `tsquery`) is what the schema is missing.

---

## #51 — HIGH

**[HIGH] URL scheme not validated; javascript:/data: URLs accepted on items and reach window.open**

## Where
- `lib/schemas.ts:14` (`urlSchema`)
- `components/items-list/item-dropdown.tsx:131`
- `components/items-list/use-keyboard-navigation.ts:181`
- `components/item-page.tsx:241`

## What
`urlSchema = z.string().max(2048)` — only checks length. `createItem`, `updateItem`, MCP `create_items`, and `update_items` all accept any string ≤ 2048 chars.

`URL.canParse("javascript:alert(1)")` returns `true`, so the canOpenUrl check at `item-dropdown.tsx:131` passes, and `window.open(item.url, "_blank", "noopener,noreferrer")` is called.

## Why it matters
Modern Chrome/Firefox block top-level `javascript:` URL navigation from `window.open`, so the realistic blast radius is browsers that don't (older mobile WebViews, embedded contexts) plus the *signal* — the field is supposed to hold http(s) only per its UX. The MCP server is the realistic injection point: any client (or LLM agent) can save items with non-URL strings that the user later clicks.

## Manifests in
- `urlSchema` at `lib/schemas.ts:14` — used by every create/update path
- `window.open(item.url, ...)` at `components/items-list/item-dropdown.tsx:129`
- `window.open(item.url, ...)` at `components/items-list/use-keyboard-navigation.ts:181`
- `window.open(item.url, "_blank")` at `components/item-page.tsx:241`

## Fix
Reject non-http(s) at the schema layer:
```ts
const urlSchema = z.string().max(2048).refine(
  (s) => /^https?:\/\//i.test(s),
  "URL must use http or https"
);
```

One zod change, no migration needed (existing items remain; future writes are bounded).

---

## #52 — MEDIUM

**[MEDIUM] Tag rename/delete logic duplicated between tag-filters and grouped-list**

## Where
- `components/items-list/tag-filters.tsx:127-186`
- `components/items-list/grouped-list.tsx:116-192`

## What
`renameMutation`, `deleteMutation`, `confirmDelete`, `startRename`, `commitRename`, `cancelRename`, `pendingDeleteCount` — all duplicated verbatim across both files. `RenameInput` (`tag-filters.tsx:52-95`) is also partially duplicated as an inline input in `grouped-list.tsx:233-250`.

## Why it matters
The optimistic update sequence (cancelQueries → snapshot previous → setQueryData with mapped tags → rollback on error → invalidate on settled) is non-obvious. Future bug fixes to one file won't apply to the other.

Already drifting: `tag-filters.tsx`'s `pendingDeleteCount` filters from the `items` prop; `grouped-list.tsx`'s filters from `groups.flatMap(g => g.items)` — the two paths can disagree on count if filtered views differ.

## Manifests in
Both files listed above.

## Fix
Extract a `useTagMutations()` hook returning `{ renameMutation, deleteMutation, startRename, commitRename, cancelRename, renamingTagId, renameDraft, pendingDeleteTag, setPendingDeleteTag }` and have both components consume it. Extract the rename input as a shared component.

---

## #53 — MEDIUM

**[MEDIUM] getMockUserId fallback in getCurrentUserIdFromRequest is unreachable**

## Where
- `lib/auth.ts:56-58`
- `middleware.ts:81-87`

## What
`middleware.ts` rejects every `/api/*` request without a Bearer or cookie session with `401`. The `getMockUserId()` branch in `getCurrentUserIdFromRequest` runs only after a Bearer header was present but failed verification — at which point MOCK_USER_ID would still grant access.

## Why it matters
The dev bypass for the MCP route doesn't work as documented. A developer hitting `/api/mcp` with `MOCK_USER_ID` set but no Bearer/cookie just gets 401.

More importantly, this is a *latent* risk: if anyone refactors middleware to allow `/api/*` through without auth, the `getCurrentUserIdFromRequest` MOCK_USER_ID branch silently grants real access to the configured user.

## Manifests in
- Dead branch at `lib/auth.ts:56-58`
- The bypass that *only* applies to non-API routes at `middleware.ts:81-87`

## Fix
Pick one:
1. Delete the mock-user fallback in `getCurrentUserIdFromRequest` since middleware already 401s.
2. Add the `/api/*` exemption in middleware when `NODE_ENV === 'development' && MOCK_USER_ID` is set, mirroring the non-API branch.

The current half-state is the worst option.

---

## #54 — MEDIUM

**[MEDIUM] TooltipProvider repeatedly mounted and nested**

## Where
- `app/layout.tsx:30` (root)
- `components/item-page.tsx:216`
- `components/items-list/detail-panel.tsx:405`
- `components/items-list/review-nudge.tsx:102`
- `components/new-item-page.tsx:138`

## What
`TooltipProvider` is wrapped both at the app root and again locally inside multiple components.

## Why it matters
@base-ui's tooltip provider sets up listeners + a shared delay timer; multiple providers in the tree cause tooltips to use the inner provider's delay (intentional?) and double-binding of keyboard listeners. Whether intentional or not, the wrapping is inconsistent and hard to reason about.

## Manifests in
Each file above plus the root layout.

## Fix
Use only the root provider. Remove local `TooltipProvider` wrappers unless they need a different `delay` — in which case, document why.

---

## #55 — MEDIUM

**[MEDIUM] Module-level confettiInstance + lingering canvas never cleaned up**

## Where
`app/review/[sessionId]/review-session.tsx:63-76`

## What
```ts
let confettiInstance: confetti.CreateTypes | null = null;

const getConfetti = (): confetti.CreateTypes => {
  if (confettiInstance) return confettiInstance;
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;...z-index:100;";
  document.body.appendChild(canvas);
  confettiInstance = confetti.create(canvas, {...});
  return confettiInstance;
};
```

Module-level mutable state. Lazily creates a `<canvas>` attached to `document.body` and never removes it.

## Why it matters
- Once a user finishes one review, a persistent fixed-position canvas stays in the DOM forever.
- It's `pointer-events: none` so it doesn't block interaction, but z-index 100 sits above modals.
- Every subsequent route mount inherits it.
- Module-level mutable state breaks SSR/HMR: the variable persists across hot reloads, referencing a stale canvas after the body re-renders.

## Manifests in
- Lines 63 (module-level let)
- Lines 66-76 (lazy init)
- Lines 78-87 (use)
- Never cleaned up

## Fix
Move the canvas + confetti instance into a `useRef` inside `SessionSummaryView` and remove the canvas on unmount.

---

## #56 — MEDIUM

**[MEDIUM] Unsafe 'as unknown as' casts in search.ts mask query result shape**

## Where
- `lib/search.ts:92`
- `lib/search.ts:158`
- `lib/search.ts:217`
- `lib/search.ts:272`

## What
```ts
return (rows as unknown as Array<Record<string, unknown>>).map(toResult);
```

Each `tx.execute(sql\`...\`)` returns drizzle's `Record<string, unknown>` already; the double cast just silences TypeScript. The downstream `toResult` / `toFlashcardResult` then casts each field individually (`r.id as string`).

## Why it matters
If the SELECT list ever loses a column (e.g. `m_url` renamed) the type system won't help — silently produces `undefined` for `matchedIn`. Schemas like the items list specify expected shapes via `select({...})`; the raw `sql` queries here don't.

## Manifests in
All four search helpers in `lib/search.ts`:
- `regexSearch`
- `fuzzySearch`
- `regexSearchFlashcards`
- `fuzzySearchFlashcards`

## Fix
Parse rows with zod (a small `SearchRow` schema) or restructure the queries to use drizzle's `tx.select(...)` with a derived select shape so the types come from the schema. The trigram operators force raw SQL for the GIN access, but the projections can still be typed.

---

## #57 — MEDIUM

**[MEDIUM] localStorage useEffect writes on every keystroke-derived state change**

## Where
`components/items-list/use-filters.ts:142-153`

## What
Four effects, each writing `localStorage.setItem(...)` whenever `activeTagsMap`/`tagsOpen`/`showRead`/`groupBy` changes — including the initial render after `useState`'s lazy initializer already populated state from `localStorage`.

```ts
React.useEffect(() => {
  localStorage.setItem("activeTagsMap", JSON.stringify(activeTagsMap));
}, [activeTagsMap]);
React.useEffect(() => {
  localStorage.setItem("tagsOpen", String(tagsOpen));
}, [tagsOpen]);
// ...two more
```

## Why it matters
First render writes the same value back to localStorage that it just read — harmless but wasted work. More importantly, `activeTagsMap` is updated frequently as users toggle tags, and `JSON.stringify(activeTagsMap)` runs on every change synchronously in render commit. For large filter sets this can add up.

## Manifests in
`components/items-list/use-filters.ts:142`, `:145`, `:148`, `:151`.

## Fix
Combine the four effects into one debounced effect that writes all four keys, or use a custom `useLocalStorage` hook.

---

## #58 — MEDIUM

**[MEDIUM] CSP script-src 'unsafe-inline' is broader than needed**

## Where
`next.config.ts:6`

## What
```ts
"script-src 'self' 'unsafe-inline'"
```

The only inline script in the app is the theme bootstrap in `app/layout.tsx:22`.

## Why it matters
`'unsafe-inline'` disables any XSS-via-injected-`<script>` mitigation. Given the markdown notes are user-controlled (mitigated by TipTap with `html: false`), this is acceptable today but adds risk for any future feature that renders user input.

## Manifests in
`next.config.ts:6` only.

## Fix
Move the theme bootstrap to a `<Script strategy="beforeInteractive">` with a sha-256 hash or per-request nonce, then drop `'unsafe-inline'` from CSP. Slightly more setup; meaningful hardening.

---

## #59 — MEDIUM

**[MEDIUM] reorderItem post-splice diff filter is a no-op — every drag UPDATEs every row**

## Where
`app/actions/items.ts:179-181`

## What
```ts
const [movedItem] = typeItems.splice(currentIndex, 1);
const clamped = Math.max(0, Math.min(newPosition, typeItems.length));
typeItems.splice(clamped, 0, movedItem);

const updates = typeItems
  .map((item, i) => ({ id: item.id, position: i }))
  .filter((u, i) => typeItems[i].position !== u.position);
```

After the in-place splice on `typeItems`, the comparison `typeItems[i].position !== u.position` is between the *current* (already-mutated) array index and `u.position` (which is `i`). It's comparing the row's old `position` field against the new index — which can differ for every row that was rearranged. But the filter never excludes rows whose position is genuinely unchanged because the comparison isn't against a pre-mutation snapshot.

## Why it matters
Drag-and-drop UPDATEs every row every time, even when only two positions changed. Latent perf bug — compounds with the broader reorder cost.

## Manifests in
`app/actions/items.ts:179-181` only.

## Fix
Compare against the pre-splice snapshot:
```ts
const originalPositions = new Map(typeItems.map(i => [i.id, i.position])); // BEFORE splice
// ... do the splice ...
const updates = typeItems
  .map((item, i) => ({ id: item.id, position: i }))
  .filter(u => originalPositions.get(u.id) !== u.position);
```

---

## #60 — MEDIUM

**[MEDIUM] MOCK_USER_ID prod safety guard missing**

## Where
`lib/auth.ts:12-15`

## What
```ts
const getMockUserId = (): string | null => {
  if (process.env.NODE_ENV !== "development") return null;
  return process.env.MOCK_USER_ID ?? null;
};
```

Returns null in production, else `process.env.MOCK_USER_ID ?? null`. Fine, but the env var must be unset in prod builds — there's no build-time guard.

## Why it matters
A misconfigured production deploy with `MOCK_USER_ID=<some-uuid>` and `NODE_ENV=development` (mistakes happen, especially on accidental staging promotions) would grant anyone access to the configured user's data. The check needs defense-in-depth.

## Manifests in
`lib/auth.ts:12-15` plus the bypass in `middleware.ts:81-87` that gates on the same envs.

## Fix
Throw at app startup if `process.env.MOCK_USER_ID` is set and `process.env.NODE_ENV` isn't `"development"`. For example, in `db/index.ts` or a `lib/env.ts` module imported early:

```ts
if (process.env.MOCK_USER_ID && process.env.NODE_ENV !== "development") {
  throw new Error("MOCK_USER_ID is only allowed in development");
}
```

---

## #61 — LOW

**[LOW] Date/duration formatters duplicated across components**

## Where
- `components/items-list/utils.ts:10-25` (`relativeTime`)
- `components/items-list/review-nudge.tsx:26-32` (`formatRelative`)
- `app/review/[sessionId]/review-session.tsx:51-61` (`formatInterval`)

## What
Three near-identical date/duration formatters across three files.

## Why it matters
Low priority but they'll drift. Already inconsistent: reviews use `Math.round`, items-list uses `Math.floor` — different bucket boundaries for the same conceptual function.

## Manifests in
The three files listed above.

## Fix
Single `lib/format-time.ts` exporting `relative()`, `interval()`, `duration()`. Decide once whether to round or floor.

---

## #62 — LOW

**[LOW] CreateArgs/CreateCallbacks + duplicate-dialog wiring redeclared in two components**

## Where
- `components/items-list.tsx:199-243`
- `components/new-item-page.tsx:34-52`

## What
Same `CreateArgs`/`CreateCallbacks` types, same duplicate-dialog state, same `requestCreate`/`handleDuplicateOpenExisting`/`handleDuplicateCreateAnyway` handlers — copy-pasted between the two components.

## Why it matters
Two places to keep in sync. Already drifted slightly: `items-list.tsx` includes the typing animation flow (`animateTitle`), `new-item-page.tsx` does not.

## Manifests in
Both files listed above. The `DuplicateDialog` component itself is shared (`components/items-list/duplicate-dialog.tsx`) — only the surrounding state plumbing is duplicated.

## Fix
Extract a `useCreateItem` hook that returns `{ requestCreate, duplicateDialog, dismissDuplicateDialog, openExisting, createAnyway, isCreating }`. Optionally accept an `animateTitle` callback for the list view's typing flow.

---

## #63 — LOW

**[LOW] Inline-arrow onClick handlers on hot list rows**

## Where
- `components/items-list.tsx:528-531` (PlainItemRow callbacks)
- `components/items-list.tsx:598-603` (pinned SortableItemRow)
- `components/items-list.tsx:619-624` (unpinned SortableItemRow)
- Similar patterns in `components/items-list/grouped-list.tsx`

## What
Each row gets fresh inline arrow functions on every render:
```tsx
onSelect={() => handleOpenItem(item.id)}
onDelete={() => requestDeleteItem(item.id)}
onToggleRead={() => handleToggleRead(item.id, !item.read)}
onTogglePin={() => handleTogglePin(item.id, !item.starred)}
```

## Why it matters
Low impact — `react/jsx-no-bind` is set to `warn` and React Compiler is enabled, so the compiler should hoist these. But:
- The lint signal is muted (`warn`, not `error`)
- For very long lists the per-render allocation still adds up
- If React Compiler bails out for any reason, perf degrades silently

## Manifests in
Several rows in `items-list.tsx` and `grouped-list.tsx`.

## Fix
Either:
1. Pull row callbacks up into a memoized factory keyed by item id, or
2. Trust the compiler and set `react/jsx-no-bind` to `off` to make the intent explicit.

Currently the rule is `warn` which is the worst middle ground.

---

