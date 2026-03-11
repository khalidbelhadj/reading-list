import { create } from "zustand";
import { toast } from "sonner";
import type { Item, DbTag } from "@/lib/types";
import type { ReadingListStore, QueuedMutation, UndoEntry, MutationPayload } from "./types";
import { executeMutation } from "./queue-processor";

const UNDO_CAP = 50;
const LS_KEY = "reading-list-store";

/** Debug: artificial delay (ms) before each mutation is sent to the server. */
export const __debugQueueDelay = { ms: 0 };

/** Debug: when true, setOnline() calls from StoreHydrator are ignored. */
export const __debugOfflineOverride = { active: false };

// Helper: resolve tags from tag names using known tags in the items Map
function resolveTagsFromNames(tagNames: string[], knownTags: DbTag[]): DbTag[] {
  const tagMap = new Map(knownTags.map((t) => [t.name, t]));
  let nextTempId = -1;
  // find lowest existing temp id
  for (const t of knownTags) {
    if (t.id < nextTempId) nextTempId = t.id - 1;
  }
  return tagNames.map((name) => {
    const existing = tagMap.get(name);
    if (existing) return existing;
    const newTag: DbTag = { id: nextTempId--, name };
    tagMap.set(name, newTag);
    return newTag;
  });
}

function getAllKnownTags(itemsMap: Map<string, Item>): DbTag[] {
  const seen = new Map<string, DbTag>();
  for (const item of itemsMap.values()) {
    for (const tag of item.tags) {
      if (!seen.has(tag.name)) seen.set(tag.name, tag);
    }
  }
  return Array.from(seen.values());
}

function renumberPositions(allItems: Item[], type: string): void {
  const typeItems = allItems
    .filter((i) => i.type === type)
    .sort((a, b) => a.position - b.position);
  typeItems.forEach((item, idx) => {
    item.position = idx;
  });
}

/**
 * Push compensating mutations onto a queue array for undo/redo.
 * "undo" restores `before` state, "redo" restores `after` state.
 */
function enqueueCompensating(
  queue: QueuedMutation[],
  entry: UndoEntry,
  nextId: number,
  direction: "undo" | "redo",
) {
  const restoreSnap = direction === "undo" ? entry.before : entry.after;
  const idsToRestore = direction === "undo" ? entry.removedIds : entry.addedIds;
  const idsToRemove = direction === "undo" ? entry.addedIds : entry.removedIds;

  // Re-create items that were removed (use original ID so server/client stay in sync)
  for (const id of idsToRestore) {
    const item = restoreSnap.get(id);
    if (item) {
      queue.push({
        id: nextId++,
        payload: {
          kind: "create",
          id: item.id,
          title: item.title,
          url: item.url,
          tagNames: item.tags.map((t) => t.name),
          faviconUrl: item.faviconUrl ?? undefined,
          type: item.type,
          notes: item.notes ?? undefined,
          position: item.position,
        },
        status: "pending",
        retryCount: 0,
      });
    }
  }

  // Delete items that shouldn't exist
  if (idsToRemove.length > 0) {
    queue.push({
      id: nextId++,
      payload: idsToRemove.length === 1
        ? { kind: "delete", id: idsToRemove[0] }
        : { kind: "bulkDelete", ids: idsToRemove },
      status: "pending",
      retryCount: 0,
    });
  }

  // For position/field changes (reorder, update, toggleRead, bulkMove, bulkMarkRead):
  // Find items that exist in both snapshots but changed, and send targeted fixes
  if (idsToRestore.length === 0 && idsToRemove.length === 0) {
    // Detect what changed: positions, type, read status, or fields
    const changedItems: { id: string; item: Item }[] = [];
    for (const [id, targetItem] of restoreSnap) {
      changedItems.push({ id, item: targetItem });
    }

    if (changedItems.length === 0) return;

    // Check if this is purely a position change (reorder)
    const oppositeSnap = direction === "undo" ? entry.after : entry.before;
    const isPositionOnly = changedItems.every(({ id, item }) => {
      const other = oppositeSnap.get(id);
      if (!other) return false;
      return item.title === other.title && item.url === other.url &&
        item.type === other.type && item.starred === other.starred &&
        item.notes === other.notes && (item as any).read === (other as any).read;
    });

    if (isPositionOnly && changedItems.length > 0) {
      // Find the item that actually moved (its relative position changed most)
      // For single-item reorder, find the one that changed position
      const moved = changedItems.find(({ id, item }) => {
        const other = oppositeSnap.get(id);
        return other && item.position !== other.position && item.type === other.type;
      });
      if (moved) {
        queue.push({
          id: nextId++,
          payload: {
            kind: "reorder",
            id: moved.id,
            type: moved.item.type,
            newPosition: moved.item.position,
          },
          status: "pending",
          retryCount: 0,
        });
        return;
      }
    }

    // Check if this is a type change (bulkMove)
    const typeChanges = changedItems.filter(({ id, item }) => {
      const other = oppositeSnap.get(id);
      return other && item.type !== other.type;
    });
    if (typeChanges.length > 0) {
      // Group by target type
      const byType = new Map<string, string[]>();
      for (const { id, item } of typeChanges) {
        const ids = byType.get(item.type) ?? [];
        ids.push(id);
        byType.set(item.type, ids);
      }
      for (const [newType, ids] of byType) {
        queue.push({
          id: nextId++,
          payload: { kind: "bulkMove", ids, newType },
          status: "pending",
          retryCount: 0,
        });
      }
      return;
    }

    // Check if this is a read status change
    const readChanges = changedItems.filter(({ id, item }) => {
      const other = oppositeSnap.get(id);
      return other && (item as any).read !== (other as any).read;
    });
    if (readChanges.length > 0) {
      const read = (readChanges[0].item as any).read as boolean;
      if (readChanges.length === 1) {
        queue.push({
          id: nextId++,
          payload: { kind: "toggleRead", id: readChanges[0].id, read },
          status: "pending",
          retryCount: 0,
        });
      } else {
        queue.push({
          id: nextId++,
          payload: { kind: "bulkMarkRead", ids: readChanges.map((c) => c.id), read },
          status: "pending",
          retryCount: 0,
        });
      }
      return;
    }

    // Generic fallback: send update for each changed item
    for (const { id, item } of changedItems) {
      queue.push({
        id: nextId++,
        payload: {
          kind: "update",
          id,
          fields: {
            title: item.title,
            url: item.url,
            faviconUrl: item.faviconUrl ?? undefined,
            type: item.type,
            starred: item.starred,
            notes: item.notes ?? undefined,
            read: (item as any).read,
            tagNames: item.tags.map((t) => t.name),
          },
        },
        status: "pending",
        retryCount: 0,
      });
    }
  }
}

// Read localStorage synchronously at module load so the first render already has data.
// Runs once; returns null if SSR or no cached data.
function loadCachedState(): {
  items: Map<string, Item>;
  mutationQueue: QueuedMutation[];
  nextMutationId: number;
  lastSyncedAt: number | null;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.items || !Array.isArray(data.items)) return null;
    const items = new Map<string, Item>();
    for (const item of data.items) {
      items.set(item.id, item);
    }
    return {
      items,
      mutationQueue: data.mutationQueue ?? [],
      nextMutationId: data.nextMutationId ?? 1,
      lastSyncedAt: data.lastSyncedAt ?? null,
    };
  } catch {
    return null;
  }
}

const cachedState = loadCachedState();

export const useStore = create<ReadingListStore>()((set, get) => {
  // Internal queue processing lock
  let isProcessing = false;

  /** Collect item IDs affected by a mutation payload. */
  function getMutationItemIds(payload: MutationPayload): string[] {
    switch (payload.kind) {
      case "create":
      case "update":
      case "delete":
      case "reorder":
      case "toggleRead":
        return [payload.id];
      case "bulkDelete":
      case "bulkMove":
      case "bulkTag":
      case "bulkMarkRead":
        return payload.ids;
      case "importBookmarks":
        return [];
    }
  }

  /**
   * Revert local state for a failed mutation and any dependent subsequent mutations.
   * Removes them from the queue, restores undo snapshots, and shows a toast.
   */
  function revertFailedMutation(failedMutation: QueuedMutation) {
    const state = get();
    const failedIds = new Set(getMutationItemIds(failedMutation.payload));

    // Find the undo entry for the failed mutation
    const undoEntry = state.undoStack.find(
      (entry) => entry.mutationId === failedMutation.id,
    );

    if (!undoEntry) {
      // No undo entry (fell off the 50-entry cap) — remove from queue and fullSync
      set((s) => ({
        mutationQueue: s.mutationQueue.filter((m) => m.id !== failedMutation.id),
      }));
      get().fullSync();
      toast.error("Failed to sync change — reloading from server");
      return;
    }

    // Find subsequent pending mutations that touch the same item IDs
    const dependentMutations: QueuedMutation[] = [];
    const dependentUndoEntries: UndoEntry[] = [];
    for (const m of state.mutationQueue) {
      if (m.id <= failedMutation.id) continue;
      if (m.status !== "pending") continue;
      const ids = getMutationItemIds(m.payload);
      if (ids.some((id) => failedIds.has(id))) {
        dependentMutations.push(m);
        const entry = state.undoStack.find((e) => e.mutationId === m.id);
        if (entry) dependentUndoEntries.push(entry);
        // Expand the affected IDs set
        for (const id of ids) failedIds.add(id);
      }
    }

    // Collect all mutation IDs to remove
    const removeIds = new Set([
      failedMutation.id,
      ...dependentMutations.map((m) => m.id),
    ]);
    const removeUndoMutationIds = new Set([
      undoEntry.mutationId,
      ...dependentUndoEntries.map((e) => e.mutationId),
    ]);

    // Revert: apply the earliest (failed) undo entry's `before` snapshot
    // and remove added items. Dependent mutations are also reverted by
    // restoring from the failed mutation's before state.
    set((s) => {
      const newItems = new Map(s.items);

      // Revert dependent mutations in reverse order first
      for (let i = dependentUndoEntries.length - 1; i >= 0; i--) {
        const entry = dependentUndoEntries[i];
        for (const id of entry.addedIds) newItems.delete(id);
        for (const [id, item] of entry.before) newItems.set(id, item);
      }

      // Revert the failed mutation itself
      for (const id of undoEntry.addedIds) newItems.delete(id);
      for (const [id, item] of undoEntry.before) newItems.set(id, item);

      return {
        items: newItems,
        mutationQueue: s.mutationQueue.filter((m) => !removeIds.has(m.id)),
        undoStack: s.undoStack.filter(
          (e) => !removeUndoMutationIds.has(e.mutationId),
        ),
      };
    });

    const label = undoEntry.label || "Unknown change";
    const depCount = dependentMutations.length;
    const depSuffix = depCount > 0 ? ` (+${depCount} dependent change${depCount > 1 ? "s" : ""})` : "";
    toast.error(`Failed to sync: ${label} — reverted${depSuffix}`);
  }

  function enqueueMutation(payload: MutationPayload): number {
    const state = get();
    const mutationId = state.nextMutationId;

    // Deduplication: consecutive reorders for the same item replace previous pending
    if (payload.kind === "reorder") {
      const queue = [...state.mutationQueue];
      const lastPending = queue.findLast(
        (m) => m.status === "pending" && m.payload.kind === "reorder" && m.payload.id === payload.id,
      );
      if (lastPending) {
        lastPending.payload = payload;
        set({ mutationQueue: queue });
        return lastPending.id;
      }
    }

    const entry: QueuedMutation = {
      id: mutationId,
      payload,
      status: "pending",
      retryCount: 0,
    };

    set((s) => ({
      mutationQueue: [...s.mutationQueue, entry],
      nextMutationId: s.nextMutationId + 1,
    }));

    return mutationId;
  }

  function pushUndo(entry: UndoEntry) {
    set((s) => ({
      undoStack: [...s.undoStack.slice(-(UNDO_CAP - 1)), entry],
      redoStack: [], // new mutation clears redo
    }));
  }

  function snapshotItems(ids: string[]): Map<string, Item> {
    const items = get().items;
    const snap = new Map<string, Item>();
    for (const id of ids) {
      const item = items.get(id);
      if (item) snap.set(id, { ...item, tags: [...item.tags] });
    }
    return snap;
  }

  function snapshotAllOfType(type: string): Map<string, Item> {
    const items = get().items;
    const snap = new Map<string, Item>();
    for (const item of items.values()) {
      if (item.type === type) {
        snap.set(item.id, { ...item, tags: [...item.tags] });
      }
    }
    return snap;
  }

  async function processQueue() {
    const state = get();
    if (isProcessing || !state.isOnline) return;
    isProcessing = true;
    set({ isSyncing: true });

    try {
      while (true) {
        const current = get();
        const next = current.mutationQueue.find((m) => m.status === "pending");
        if (!next) break;

        // Mark in-flight
        set((s) => ({
          mutationQueue: s.mutationQueue.map((m) =>
            m.id === next.id ? { ...m, status: "in-flight" as const } : m,
          ),
        }));

        try {
          if (__debugQueueDelay.ms > 0) {
            await new Promise((r) => setTimeout(r, __debugQueueDelay.ms));
          }
          await executeMutation(next.payload);

          // Mark done
          set((s) => ({
            mutationQueue: s.mutationQueue.map((m) =>
              m.id === next.id ? { ...m, status: "done" as const } : m,
            ),
          }));
        } catch (err) {
          console.error("Queue mutation failed:", err);
          const updated = get().mutationQueue.find((m) => m.id === next.id);
          if (updated && updated.retryCount >= 2) {
            // Give up after 3 attempts — revert local state and remove from queue
            revertFailedMutation({ ...next, retryCount: updated.retryCount, status: "failed" });
            break;
          } else {
            // Retry: reset to pending with incremented count
            set((s) => ({
              mutationQueue: s.mutationQueue.map((m) =>
                m.id === next.id
                  ? { ...m, status: "pending" as const, retryCount: m.retryCount + 1 }
                  : m,
              ),
            }));
            break; // stop processing, will retry on next trigger
          }
        }
      }

      // Clean up done mutations
      set((s) => ({
        mutationQueue: s.mutationQueue.filter((m) => m.status !== "done"),
      }));
    } finally {
      isProcessing = false;
      set({ isSyncing: false });
      get().persistToLocalStorage();
    }
  }

  return {
    // ── Data ──
    items: cachedState?.items ?? new Map(),
    isHydrated: false, // always false initially to match SSR; set true before first paint via useLayoutEffect
    isOnline: true, // always true initially to match SSR; StoreHydrator sets real value after mount
    isSyncing: false,
    lastSyncedAt: cachedState?.lastSyncedAt ?? null,

    // ── Queue ──
    mutationQueue: cachedState?.mutationQueue ?? [],
    nextMutationId: cachedState?.nextMutationId ?? 1,

    // ── Undo/Redo ──
    undoStack: [],
    redoStack: [],

    // ── Accessors ──
    getAllItems: () => {
      return Array.from(get().items.values()).sort((a, b) => {
        if (a.type !== b.type) return a.type === "reading-list" ? -1 : 1;
        return a.position - b.position;
      });
    },

    // ── Mutations ──

    createItem: ({ title, url, tagNames, faviconUrl, type, notes }) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const knownTags = getAllKnownTags(get().items);
      const tags = resolveTagsFromNames(tagNames, knownTags);

      // Snapshot items of this type for undo (positions will shift)
      const beforeSnap = snapshotAllOfType(type);

      set((s) => {
        const newItems = new Map(s.items);
        // Shift existing items of this type down
        for (const [, item] of newItems) {
          if (item.type === type) {
            newItems.set(item.id, { ...item, position: item.position + 1 });
          }
        }
        const newItem: Item = {
          id,
          title,
          url,
          faviconUrl: faviconUrl ?? null,
          type: type as "bookmark" | "reading-list",
          starred: false,
          notes: notes ?? null,
          read: false,
          readAt: null,
          position: 0,
          createdAt: now,
          updatedAt: now,
          tags,
        } as Item;
        newItems.set(id, newItem);
        return { items: newItems };
      });

      const afterSnap = snapshotAllOfType(type);
      afterSnap.set(id, get().items.get(id)!);

      const mutationId = enqueueMutation({
        kind: "create",
        id,
        title,
        url,
        tagNames,
        faviconUrl,
        type,
        notes,
      });

      pushUndo({
        label: `Create "${title || url}"`,
        before: beforeSnap,
        after: afterSnap,
        addedIds: [id],
        removedIds: [],
        mutationId,
      });

      get().persistToLocalStorage();
      processQueue();
      return id;
    },

    updateItem: (id, fields) => {
      const beforeSnap = snapshotItems([id]);
      if (!beforeSnap.has(id)) return;

      set((s) => {
        const newItems = new Map(s.items);
        const item = newItems.get(id);
        if (!item) return s;

        const updated = { ...item, updatedAt: new Date().toISOString() };
        if (fields.title !== undefined) updated.title = fields.title;
        if (fields.url !== undefined) updated.url = fields.url;
        if (fields.faviconUrl !== undefined) updated.faviconUrl = fields.faviconUrl;
        if (fields.starred !== undefined) updated.starred = fields.starred;
        if (fields.notes !== undefined) updated.notes = fields.notes ?? null;
        if (fields.read !== undefined) (updated as any).read = fields.read;

        if (fields.tagNames !== undefined) {
          const knownTags = getAllKnownTags(newItems);
          updated.tags = resolveTagsFromNames(fields.tagNames, knownTags);
        }

        // Type change: move to position 0 in new type, renumber old type
        if (fields.type !== undefined && fields.type !== item.type) {
          const oldType = item.type;
          const newType = fields.type as "bookmark" | "reading-list";
          // Shift items in new type
          for (const [, i] of newItems) {
            if (i.type === newType) {
              newItems.set(i.id, { ...i, position: i.position + 1 });
            }
          }
          (updated as any).type = newType;
          updated.position = 0;
          newItems.set(id, updated as Item);
          // Renumber old type
          const allArr = Array.from(newItems.values());
          renumberPositions(allArr, oldType);
          for (const i of allArr) newItems.set(i.id, i);
        } else {
          newItems.set(id, updated as Item);
        }

        return { items: newItems };
      });

      const afterSnap = snapshotItems([id]);

      const mutationId = enqueueMutation({ kind: "update", id, fields });

      pushUndo({
        label: "Update item",
        before: beforeSnap,
        after: afterSnap,
        addedIds: [],
        removedIds: [],
        mutationId,
      });

      get().persistToLocalStorage();
      processQueue();
    },

    deleteItem: (id) => {
      const item = get().items.get(id);
      if (!item) return;

      const beforeSnap = snapshotAllOfType(item.type);
      beforeSnap.set(id, { ...item, tags: [...item.tags] });

      set((s) => {
        const newItems = new Map(s.items);
        newItems.delete(id);
        // Renumber positions for this type
        const allArr = Array.from(newItems.values());
        renumberPositions(allArr, item.type);
        for (const i of allArr) newItems.set(i.id, i);
        return { items: newItems };
      });

      const afterSnap = snapshotAllOfType(item.type);

      const mutationId = enqueueMutation({ kind: "delete", id });

      pushUndo({
        label: `Delete "${item.title}"`,
        before: beforeSnap,
        after: afterSnap,
        addedIds: [],
        removedIds: [id],
        mutationId,
      });

      get().persistToLocalStorage();
      processQueue();
    },

    reorderItem: (id, type, newPosition) => {
      const beforeSnap = snapshotAllOfType(type);

      set((s) => {
        const newItems = new Map(s.items);
        const allArr = Array.from(newItems.values());
        const typeItems = allArr
          .filter((i) => i.type === type)
          .sort((a, b) => a.position - b.position);

        const currentIndex = typeItems.findIndex((i) => i.id === id);
        if (currentIndex === -1) return s;

        const [moved] = typeItems.splice(currentIndex, 1);
        const clamped = Math.max(0, Math.min(newPosition, typeItems.length));
        typeItems.splice(clamped, 0, moved);
        typeItems.forEach((item, idx) => {
          item.position = idx;
        });

        for (const item of allArr) newItems.set(item.id, item);
        return { items: newItems };
      });

      const afterSnap = snapshotAllOfType(type);

      const mutationId = enqueueMutation({ kind: "reorder", id, type, newPosition });

      pushUndo({
        label: "Reorder item",
        before: beforeSnap,
        after: afterSnap,
        addedIds: [],
        removedIds: [],
        mutationId,
      });

      get().persistToLocalStorage();
      processQueue();
    },

    toggleRead: (id, read) => {
      const beforeSnap = snapshotItems([id]);

      set((s) => {
        const newItems = new Map(s.items);
        const item = newItems.get(id);
        if (!item) return s;
        const now = new Date().toISOString();
        newItems.set(id, {
          ...item,
          read,
          readAt: read ? now : null,
          updatedAt: now,
        } as Item);
        return { items: newItems };
      });

      const afterSnap = snapshotItems([id]);
      const mutationId = enqueueMutation({ kind: "toggleRead", id, read });

      pushUndo({
        label: read ? "Mark as read" : "Mark as unread",
        before: beforeSnap,
        after: afterSnap,
        addedIds: [],
        removedIds: [],
        mutationId,
      });

      get().persistToLocalStorage();
      processQueue();
    },

    bulkDelete: (ids) => {
      if (ids.length === 0) return;
      const state = get();
      const affectedTypes = new Set<string>();
      const beforeSnap = new Map<string, Item>();
      for (const id of ids) {
        const item = state.items.get(id);
        if (item) {
          beforeSnap.set(id, { ...item, tags: [...item.tags] });
          affectedTypes.add(item.type);
        }
      }
      // Also snapshot remaining items of affected types for position tracking
      for (const item of state.items.values()) {
        if (affectedTypes.has(item.type) && !beforeSnap.has(item.id)) {
          beforeSnap.set(item.id, { ...item, tags: [...item.tags] });
        }
      }

      set((s) => {
        const newItems = new Map(s.items);
        for (const id of ids) newItems.delete(id);
        const allArr = Array.from(newItems.values());
        for (const type of affectedTypes) renumberPositions(allArr, type);
        for (const i of allArr) newItems.set(i.id, i);
        return { items: newItems };
      });

      const afterSnap = new Map<string, Item>();
      for (const item of get().items.values()) {
        if (affectedTypes.has(item.type)) {
          afterSnap.set(item.id, { ...item, tags: [...item.tags] });
        }
      }

      const mutationId = enqueueMutation({ kind: "bulkDelete", ids });

      pushUndo({
        label: `Delete ${ids.length} items`,
        before: beforeSnap,
        after: afterSnap,
        addedIds: [],
        removedIds: ids,
        mutationId,
      });

      get().persistToLocalStorage();
      processQueue();
    },

    bulkMove: (ids, newType) => {
      if (ids.length === 0) return;
      const state = get();
      // Snapshot ALL items (both types affected)
      const beforeSnap = new Map<string, Item>();
      for (const [id, item] of state.items) {
        beforeSnap.set(id, { ...item, tags: [...item.tags] });
      }

      set((s) => {
        const newItems = new Map(s.items);
        const sourceTypes = new Set<string>();
        const now = new Date().toISOString();

        // Shift existing items in target type
        for (const [, item] of newItems) {
          if (item.type === newType) {
            newItems.set(item.id, { ...item, position: item.position + ids.length });
          }
        }

        // Move items
        ids.forEach((id, idx) => {
          const item = newItems.get(id);
          if (!item) return;
          sourceTypes.add(item.type);
          newItems.set(id, {
            ...item,
            type: newType as "bookmark" | "reading-list",
            position: idx,
            updatedAt: now,
          } as Item);
        });

        // Renumber source types
        const allArr = Array.from(newItems.values());
        for (const type of sourceTypes) {
          if (type !== newType) renumberPositions(allArr, type);
        }
        for (const i of allArr) newItems.set(i.id, i);

        return { items: newItems };
      });

      const afterSnap = new Map<string, Item>();
      for (const [id, item] of get().items) {
        afterSnap.set(id, { ...item, tags: [...item.tags] });
      }

      const mutationId = enqueueMutation({ kind: "bulkMove", ids, newType });

      pushUndo({
        label: `Move ${ids.length} items`,
        before: beforeSnap,
        after: afterSnap,
        addedIds: [],
        removedIds: [],
        mutationId,
      });

      get().persistToLocalStorage();
      processQueue();
    },

    bulkTag: (ids, tagNames) => {
      if (ids.length === 0 || tagNames.length === 0) return;
      const beforeSnap = snapshotItems(ids);

      set((s) => {
        const newItems = new Map(s.items);
        const knownTags = getAllKnownTags(newItems);
        const newTags = resolveTagsFromNames(tagNames, knownTags);

        for (const id of ids) {
          const item = newItems.get(id);
          if (!item) continue;
          const existingNames = new Set(item.tags.map((t) => t.name));
          const addedTags = newTags.filter((t) => !existingNames.has(t.name));
          if (addedTags.length > 0) {
            newItems.set(id, { ...item, tags: [...item.tags, ...addedTags] });
          }
        }
        return { items: newItems };
      });

      const afterSnap = snapshotItems(ids);
      const mutationId = enqueueMutation({ kind: "bulkTag", ids, tagNames });

      pushUndo({
        label: `Tag ${ids.length} items`,
        before: beforeSnap,
        after: afterSnap,
        addedIds: [],
        removedIds: [],
        mutationId,
      });

      get().persistToLocalStorage();
      processQueue();
    },

    bulkMarkRead: (ids, read) => {
      if (ids.length === 0) return;
      const beforeSnap = snapshotItems(ids);

      set((s) => {
        const newItems = new Map(s.items);
        const now = new Date().toISOString();
        for (const id of ids) {
          const item = newItems.get(id);
          if (!item) continue;
          newItems.set(id, {
            ...item,
            read,
            readAt: read ? now : null,
            updatedAt: now,
          } as Item);
        }
        return { items: newItems };
      });

      const afterSnap = snapshotItems(ids);
      const mutationId = enqueueMutation({ kind: "bulkMarkRead", ids, read });

      pushUndo({
        label: read ? `Mark ${ids.length} as read` : `Mark ${ids.length} as unread`,
        before: beforeSnap,
        after: afterSnap,
        addedIds: [],
        removedIds: [],
        mutationId,
      });

      get().persistToLocalStorage();
      processQueue();
    },

    importBookmarks: (html) => {
      // Non-optimistic — we can't parse the HTML client-side easily
      // Just enqueue and let it sync. fullSync will pick up results.
      enqueueMutation({ kind: "importBookmarks", html });
      processQueue();
    },

    // ── Undo/Redo ──

    undo: () => {
      const state = get();
      if (state.undoStack.length === 0) return;

      const entry = state.undoStack[state.undoStack.length - 1];

      set((s) => {
        const newItems = new Map(s.items);

        // Remove items that were added
        for (const id of entry.addedIds) {
          newItems.delete(id);
        }

        // Restore items from before snapshot
        for (const [id, item] of entry.before) {
          newItems.set(id, item);
        }

        // Check the actual queue status of this mutation
        let newQueue = [...s.mutationQueue];
        const queueEntry = newQueue.find((m) => m.id === entry.mutationId);
        const canCancel = queueEntry && queueEntry.status === "pending";
        const queueLenBefore = newQueue.length;

        if (canCancel) {
          // Still pending — server never saw it, safe to just remove
          newQueue = newQueue.filter((m) => m.id !== entry.mutationId);
        } else {
          // In-flight, done, or already removed — need compensating mutations
          enqueueCompensating(newQueue, entry, s.nextMutationId, "undo");
        }

        const added = Math.max(0, newQueue.length - queueLenBefore);

        return {
          items: newItems,
          undoStack: s.undoStack.slice(0, -1),
          redoStack: [...s.redoStack, entry],
          mutationQueue: newQueue,
          nextMutationId: s.nextMutationId + added,
        };
      });

      get().persistToLocalStorage();
      processQueue();
    },

    redo: () => {
      const state = get();
      if (state.redoStack.length === 0) return;

      const entry = state.redoStack[state.redoStack.length - 1];

      set((s) => {
        const newItems = new Map(s.items);

        // Remove items that were removed by the original mutation
        for (const id of entry.removedIds) {
          newItems.delete(id);
        }

        // Apply after snapshot
        for (const [id, item] of entry.after) {
          newItems.set(id, item);
        }

        // Re-add items that were added
        for (const id of entry.addedIds) {
          const item = entry.after.get(id);
          if (item) newItems.set(id, item);
        }

        const newQueue = [...s.mutationQueue];
        const queueLenBefore = newQueue.length;
        enqueueCompensating(newQueue, entry, s.nextMutationId, "redo");
        const added = Math.max(0, newQueue.length - queueLenBefore);

        return {
          items: newItems,
          redoStack: s.redoStack.slice(0, -1),
          undoStack: [...s.undoStack, entry],
          mutationQueue: newQueue,
          nextMutationId: s.nextMutationId + added,
        };
      });

      get().persistToLocalStorage();
      processQueue();
    },

    // ── Sync ──

    hydrateFromServer: (serverItems) => {
      const state = get();
      const pendingMutations = state.mutationQueue.filter(
        (m) => m.status === "pending" || m.status === "in-flight",
      );

      // Start with server items as the base
      const merged = new Map<string, Item>();
      for (const item of serverItems) {
        merged.set(item.id, item);
      }

      if (pendingMutations.length > 0) {
        // Collect IDs affected by pending mutations
        const dirtyIds = new Set<string>();
        const pendingDeleteIds = new Set<string>();
        const pendingCreateIds = new Set<string>();

        for (const m of pendingMutations) {
          const p = m.payload;
          switch (p.kind) {
            case "create":
              dirtyIds.add(p.id);
              pendingCreateIds.add(p.id);
              break;
            case "update":
            case "delete":
            case "reorder":
            case "toggleRead":
              dirtyIds.add(p.id);
              if (p.kind === "delete") pendingDeleteIds.add(p.id);
              break;
            case "bulkDelete":
              for (const id of p.ids) { dirtyIds.add(id); pendingDeleteIds.add(id); }
              break;
            case "bulkMove":
            case "bulkTag":
            case "bulkMarkRead":
              for (const id of p.ids) dirtyIds.add(id);
              break;
            // importBookmarks has no item IDs to track
          }
        }

        // For dirty IDs: keep local store's version instead of server's
        for (const id of dirtyIds) {
          const localItem = state.items.get(id);
          if (pendingDeleteIds.has(id)) {
            // Item was deleted locally — remove from merged even if server still has it
            merged.delete(id);
          } else if (localItem) {
            // Keep the local optimistic version
            merged.set(id, localItem);
          }
          // If not in local store and not a delete, server version stands (already in merged)
        }

        // For pending creates: if item exists locally but not on server, keep local
        for (const id of pendingCreateIds) {
          if (!merged.has(id)) {
            const localItem = state.items.get(id);
            if (localItem) merged.set(id, localItem);
          }
        }
      }

      set({
        items: merged,
        isHydrated: true,
        lastSyncedAt: Date.now(),
      });
      get().persistToLocalStorage();
    },

    fullSync: async () => {
      try {
        const res = await fetch("/api/items");
        if (!res.ok) return;
        const serverItems: Item[] = await res.json();
        const state = get();

        // Only overwrite if no pending mutations
        if (state.mutationQueue.every((m) => m.status === "done" || m.status === "failed")) {
          const newItems = new Map<string, Item>();
          for (const item of serverItems) {
            newItems.set(item.id, item);
          }
          set({
            items: newItems,
            lastSyncedAt: Date.now(),
            mutationQueue: state.mutationQueue.filter((m) => m.status !== "done"),
          });
          get().persistToLocalStorage();
        }
      } catch {
        // Network error — ignore, will retry
      }
    },

    processQueue: () => {
      processQueue();
    },

    setOnline: (online) => {
      if (__debugOfflineOverride.active) return;
      set({ isOnline: online });
      if (online) processQueue();
    },

    // ── Persistence ──

    persistToLocalStorage: () => {
      try {
        const state = get();
        const data = {
          items: Array.from(state.items.values()),
          mutationQueue: state.mutationQueue.filter((m) => m.status === "pending"),
          nextMutationId: state.nextMutationId,
          lastSyncedAt: state.lastSyncedAt,
        };
        localStorage.setItem(LS_KEY, JSON.stringify(data));
      } catch {
        // localStorage full or unavailable
      }
    },

    loadFromLocalStorage: () => {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data.items && Array.isArray(data.items)) {
          const items = new Map<string, Item>();
          for (const item of data.items) {
            items.set(item.id, item);
          }
          set({
            items,
            mutationQueue: data.mutationQueue ?? [],
            nextMutationId: data.nextMutationId ?? 1,
            lastSyncedAt: data.lastSyncedAt ?? null,
            isHydrated: true,
          });
        }
      } catch {
        // Corrupt data — ignore
      }
    },
  };
});
