import type { Item } from "@/lib/types";

// ── Mutation payloads (discriminated union for all mutation kinds) ──

export type MutationPayload =
  | { kind: "create"; id: string; title: string; url: string; tagNames: string[]; faviconUrl?: string; type: string; notes?: string; position?: number }
  | { kind: "update"; id: string; fields: { title?: string; url?: string; faviconUrl?: string; type?: string; starred?: boolean; notes?: string; read?: boolean; tagNames?: string[] } }
  | { kind: "delete"; id: string }
  | { kind: "reorder"; id: string; type: string; newPosition: number }
  | { kind: "toggleRead"; id: string; read: boolean }
  | { kind: "bulkDelete"; ids: string[] }
  | { kind: "bulkMove"; ids: string[]; newType: string }
  | { kind: "bulkTag"; ids: string[]; tagNames: string[] }
  | { kind: "bulkMarkRead"; ids: string[]; read: boolean }
  | { kind: "importBookmarks"; html: string };

export type QueuedMutation = {
  id: number;
  payload: MutationPayload;
  status: "pending" | "in-flight" | "done" | "failed";
  retryCount: number;
};

export type UndoEntry = {
  /** Description for potential UI display */
  label: string;
  /** Item snapshots before the mutation */
  before: Map<string, Item>;
  /** Item snapshots after the mutation */
  after: Map<string, Item>;
  /** IDs that were added by this mutation */
  addedIds: string[];
  /** IDs that were removed by this mutation */
  removedIds: string[];
  /** Corresponding mutation queue entry ID (used to check if still cancellable) */
  mutationId: number;
};

export type ReadingListStore = {
  // ── Data ──
  items: Map<string, Item>;
  isHydrated: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: number | null;

  // ── Mutation queue ──
  mutationQueue: QueuedMutation[];
  nextMutationId: number;

  // ── Undo/Redo ──
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];

  // ── Data accessors ──
  getAllItems: () => Item[];

  // ── Mutation actions ──
  createItem: (params: { title: string; url: string; tagNames: string[]; faviconUrl?: string; type: string; notes?: string }) => string;
  updateItem: (id: string, fields: { title?: string; url?: string; faviconUrl?: string; type?: string; starred?: boolean; notes?: string; read?: boolean; tagNames?: string[] }) => void;
  deleteItem: (id: string) => void;
  reorderItem: (id: string, type: string, newPosition: number) => void;
  toggleRead: (id: string, read: boolean) => void;
  bulkDelete: (ids: string[]) => void;
  bulkMove: (ids: string[], newType: string) => void;
  bulkTag: (ids: string[], tagNames: string[]) => void;
  bulkMarkRead: (ids: string[], read: boolean) => void;
  importBookmarks: (html: string) => void;

  // ── Undo/Redo actions ──
  undo: () => void;
  redo: () => void;

  // ── Sync ──
  hydrateFromServer: (items: Item[]) => void;
  fullSync: () => Promise<void>;
  processQueue: () => void;
  setOnline: (online: boolean) => void;

  // ── Persistence ──
  persistToLocalStorage: () => void;
  loadFromLocalStorage: () => void;
};
