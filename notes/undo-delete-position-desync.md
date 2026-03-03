# Undo-Delete Position Desync Bug

**Date:** 2026-03-03
**Area:** Local-first store, undo/redo, mutation queue, position management
**Files changed:** `lib/store/types.ts`, `lib/store/index.ts`, `lib/store/queue-processor.ts`, `app/actions.ts`

## Symptoms

1. Undoing a deletion restores items in the correct position initially, then they jump to the top of the list.
2. After that, dragging items down one-by-one gets "stuck" partway through, as if phantom items occupy positions in the list.

## Root Cause

When undoing a delete whose mutation has already reached the server (status `done` or `in-flight`), the store can't cancel it. Instead it enqueues a **compensating "create"** mutation to re-create the item on the server. This create payload had **no position field**.

The server's `createItem` action always:
1. Shifts ALL existing items of the same type down by 1 (`position = position + 1`)
2. Inserts the new item at position 0

So an item originally at position 5 would be recreated at position 0, and every other item's position gets shifted +1.

**Locally** the undo correctly restores the "before" snapshot with original positions, so items appear correct immediately. But when `fullSync` fires (every 30s or on window focus), the server's divergent position state overwrites the client, causing the jump-to-top.

The phantom item problem follows from this: after the server shifts all positions +1, the position space on the server no longer matches the client's expectation. Subsequent reorder mutations send `newPosition` values that the server interprets against a shifted position space, causing items to land in wrong places or appear stuck.

## Options Considered

### Option A: Add position to the compensating create (chosen)
Add an optional `position` field to the `create` mutation payload. When provided, the server inserts at that specific position and only shifts items at `>= position` (not all items). `enqueueCompensating` passes `item.position` from the undo snapshot.

- Smallest change
- Fixes both symptoms
- No extra roundtrips
- Backward compatible (normal creates still default to position 0)

### Option B: Follow compensating create with a reorder
After the create, enqueue a separate `reorder` mutation to move the item from 0 to the snapshot position.

- Avoids changing the create action
- Extra server roundtrip
- Brief visual glitch possible if fullSync fires between the two mutations
- More fragile under concurrent operations

### Option C: Full position sync mutation
A new mutation kind `syncPositions` that sends the entire position map for a type. Server sets all positions at once.

- Most robust for complex undo scenarios (bulk operations)
- Requires new mutation kind, new server action, new queue processor case
- Overkill for this specific bug
- Could be useful in the future if more position-related bugs appear

## Implementation (Option A)

1. **`lib/store/types.ts`** — Added optional `position?: number` to the `create` variant of `MutationPayload`.

2. **`lib/store/index.ts`** (`enqueueCompensating`) — When building the compensating create payload for restored items, now includes `position: item.position` from the snapshot.

3. **`lib/store/queue-processor.ts`** — Passes `payload.position` as the new argument to the `createItem` server action.

4. **`app/actions.ts`** (`createItem`) — New optional `position` parameter. When provided, only shifts items with `position >= insertAt` (using `gte` filter) instead of all items of the type. Inserts at `insertAt` instead of hardcoded 0.

## Key Insight

In a local-first architecture with optimistic updates and compensating mutations, **every field that affects ordering must be preserved in compensating payloads**. The undo system restores local state from snapshots (which include positions), but compensating mutations sent to the server must carry the same position data or the server will diverge.
