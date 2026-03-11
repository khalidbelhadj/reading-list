"use client";

import React from "react";
import { useStore, __debugQueueDelay, __debugOfflineOverride } from "@/lib/store";
import { Switch } from "@/components/ui/switch";
import type { QueuedMutation, UndoEntry } from "@/lib/store/types";
import { IconBug, IconChevronDown, IconChevronRight, IconX, IconPinned, IconList } from "@tabler/icons-react";
import { Slider } from "@/components/ui/slider";

// ── LocalStorage persistence for debug view state ──

const DEBUG_LS_KEY = "debug-panel-state";

type DebugPersistedState = {
  open: boolean;
  size: { width: number; height: number };
  queueLogOpen: boolean;
  queueLogPosition: { x: number; y: number };
  queueLogSize: { width: number; height: number };
  queueDelay: number;
};

function loadDebugState(): Partial<DebugPersistedState> {
  try {
    const raw = localStorage.getItem(DEBUG_LS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveDebugState(state: DebugPersistedState) {
  try {
    localStorage.setItem(DEBUG_LS_KEY, JSON.stringify(state));
  } catch {}
}

// ── Helpers ──

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 1000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

function formatAbsoluteTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

const statusColors: Record<string, string> = {
  pending: "text-yellow-400",
  "in-flight": "text-blue-400",
  done: "text-green-400",
  failed: "text-red-400",
};

const PANEL_BG = "bg-neutral-900/80";
const SCREEN_PAD = 16;

function clampPosition(x: number, y: number, w: number, h: number): { x: number; y: number } {
  const maxX = window.innerWidth - w - SCREEN_PAD;
  const maxY = window.innerHeight - h - SCREEN_PAD;
  return {
    x: Math.max(SCREEN_PAD, Math.min(x, maxX)),
    y: Math.max(SCREEN_PAD, Math.min(y, maxY)),
  };
}

function payloadSummary(payload: QueuedMutation["payload"]): string {
  switch (payload.kind) {
    case "create":
      return `create ${payload.id.slice(0, 8)}…`;
    case "update":
      return `update ${payload.id.slice(0, 8)}… [${Object.keys(payload.fields).join(", ")}]`;
    case "delete":
      return `delete ${payload.id.slice(0, 8)}…`;
    case "reorder":
      return `reorder ${payload.id.slice(0, 8)}… → pos ${payload.newPosition}`;
    case "toggleRead":
      return `toggleRead ${payload.id.slice(0, 8)}… → ${payload.read}`;
    case "bulkDelete":
      return `bulkDelete ${payload.ids.length} items`;
    case "bulkMove":
      return `bulkMove ${payload.ids.length} → ${payload.newType}`;
    case "bulkTag":
      return `bulkTag ${payload.ids.length} [${payload.tagNames.join(", ")}]`;
    case "bulkMarkRead":
      return `bulkMarkRead ${payload.ids.length} → ${payload.read}`;
    case "importBookmarks":
      return `importBookmarks (${payload.html.length} chars)`;
  }
}

// ── Shared components ──

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(true);
  return (
    <div className="border-b border-white/10 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 w-full px-3 py-1.5 text-left text-[11px] font-semibold text-white/80 hover:text-white hover:bg-white/5 transition-colors"
      >
        {open ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
        {title}
        {badge && (
          <span className="ml-auto text-[10px] font-mono text-white/50">{badge}</span>
        )}
      </button>
      {open && <div className="px-3 pb-2 text-[11px]">{children}</div>}
    </div>
  );
}

function Dot({ color }: { color: "green" | "red" | "yellow" }) {
  const bg = color === "green" ? "bg-green-400" : color === "red" ? "bg-red-400" : "bg-yellow-400";
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${bg}`} />;
}

// ── Queue entry row ──

function QueueEntry({ m, selected, onSelect, onFloat, isFloating }: { m: QueuedMutation; selected: boolean; onSelect: (e: React.MouseEvent) => void; onFloat: () => void; isFloating: boolean }) {
  return (
    <div
      className={`group flex items-center gap-2 py-0.5 font-mono text-[10px] w-full text-left rounded px-0.5 transition-colors ${
        selected ? "bg-white/10" : "hover:bg-white/5"
      }`}
    >
      <button onClick={onSelect} className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-white/40 w-4 text-right shrink-0">#{m.id}</span>
        <span className={`shrink-0 ${statusColors[m.status]}`}>{m.status}</span>
        <span className="text-white/70 truncate">{payloadSummary(m.payload)}</span>
        {m.retryCount > 0 && (
          <span className="text-orange-400 shrink-0">r{m.retryCount}</span>
        )}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onFloat(); }}
        className={`shrink-0 transition-opacity ${isFloating ? "text-blue-400 opacity-100" : "text-white/30 opacity-0 group-hover:opacity-100 hover:text-white/60"}`}
        title="Float this mutation"
      >
        <IconPinned size={10} />
      </button>
    </div>
  );
}

// ── Mutation detail popup (inline, non-floating) ──

function MutationDetail({ m, onClose }: { m: QueuedMutation; onClose: () => void }) {
  return (
    <div className={`rounded-lg ${PANEL_BG} backdrop-blur-sm border border-white/10 shadow-2xl font-mono w-[320px] max-h-[60vh] flex flex-col`}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 shrink-0">
        <span className="text-[11px] font-semibold text-white/60">
          Mutation #{m.id}
        </span>
        <button onClick={onClose} className="text-white/40 hover:text-white">
          <IconX size={12} />
        </button>
      </div>
      <div className="overflow-y-auto flex-1 min-h-0 p-3 text-[10px] debug-scrollbar">
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 mb-2">
          <span className="text-white/50">Status</span>
          <span className={statusColors[m.status]}>{m.status}</span>
          <span className="text-white/50">Kind</span>
          <span className="text-white/80">{m.payload.kind}</span>
          <span className="text-white/50">Retries</span>
          <span className="text-white/80">{m.retryCount}</span>
        </div>
        <div className="border-t border-white/10 pt-2 mt-1">
          <div className="text-white/50 mb-1">Payload</div>
          <pre className="text-white/70 whitespace-pre-wrap break-all leading-relaxed">
            {JSON.stringify(m.payload, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ── Floating mutation window ──

type FloatingEntry = {
  mutationId: number;
  position: { x: number; y: number };
  snapshot: QueuedMutation;
};

const FLOAT_W = 320;
const FLOAT_H = 300;

function FloatingMutation({ mutationId, initialSnapshot, position, onClose, onPositionChange }: {
  mutationId: number;
  initialSnapshot: QueuedMutation;
  position: { x: number; y: number };
  onClose: () => void;
  onPositionChange: (pos: { x: number; y: number }) => void;
}) {
  const live = useStore((s) => s.mutationQueue.find((q) => q.id === mutationId));
  const snapshotRef = React.useRef<QueuedMutation>(initialSnapshot);

  if (live) {
    snapshotRef.current = live;
  }
  const m = live ?? snapshotRef.current;
  const isGone = !live;

  const dragRef = React.useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);

  React.useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const d = dragRef.current;
      if (!d) return;
      e.preventDefault();
      const raw = { x: d.startPosX + (e.clientX - d.startX), y: d.startPosY + (e.clientY - d.startY) };
      onPositionChange(clampPosition(raw.x, raw.y, FLOAT_W, FLOAT_H));
    }
    function onMouseUp() {
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onPositionChange]);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position.x,
      startPosY: position.y,
    };
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  };

  return (
    <div
      className={`fixed z-[52] rounded-lg ${PANEL_BG} backdrop-blur-sm border border-white/10 shadow-2xl font-mono w-[320px] max-h-[60vh] flex flex-col`}
      style={{ left: position.x, top: position.y }}
    >
      <div
        onMouseDown={startDrag}
        className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 shrink-0 cursor-grab active:cursor-grabbing select-none"
      >
        <span className="text-[11px] font-semibold text-white/60">
          Mutation #{m.id}{" "}
          <span className={statusColors[m.status]}>{m.status}</span>
          {isGone && <span className="text-white/30 ml-1">(done)</span>}
        </span>
        <button onClick={onClose} className="text-white/40 hover:text-white">
          <IconX size={12} />
        </button>
      </div>
      <div className="overflow-y-auto flex-1 min-h-0 p-3 text-[10px] debug-scrollbar">
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 mb-2">
          <span className="text-white/50">Status</span>
          <span className={statusColors[m.status]}>
            {m.status}{isGone ? " (removed from queue)" : ""}
          </span>
          <span className="text-white/50">Kind</span>
          <span className="text-white/80">{m.payload.kind}</span>
          <span className="text-white/50">Retries</span>
          <span className="text-white/80">{m.retryCount}</span>
        </div>
        <div className="border-t border-white/10 pt-2 mt-1">
          <div className="text-white/50 mb-1">Payload</div>
          <pre className="text-white/70 whitespace-pre-wrap break-all leading-relaxed">
            {JSON.stringify(m.payload, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ── Full queue log (floating, shows all status transitions) ──

type MutationLogEntry = {
  id: number;
  payload: QueuedMutation["payload"];
  status: QueuedMutation["status"];
  retryCount: number;
  timestamp: number;
};

function useMutationLog() {
  const logRef = React.useRef<MutationLogEntry[]>([]);
  const seenRef = React.useRef<Map<number, QueuedMutation["status"]>>(new Map());
  const mutationQueue = useStore((s) => s.mutationQueue);
  const [, forceRender] = React.useState(0);

  React.useEffect(() => {
    let changed = false;
    const now = Date.now();

    for (const m of mutationQueue) {
      const prevStatus = seenRef.current.get(m.id);
      if (prevStatus !== m.status) {
        seenRef.current.set(m.id, m.status);
        logRef.current.push({
          id: m.id,
          payload: m.payload,
          status: m.status,
          retryCount: m.retryCount,
          timestamp: now,
        });
        changed = true;
      }
    }

    if (changed) {
      forceRender((n) => n + 1);
    }
  }, [mutationQueue]);

  const clear = React.useCallback(() => {
    logRef.current = [];
    seenRef.current.clear();
    forceRender((n) => n + 1);
  }, []);

  return { log: logRef.current, clear };
}

const LOG_MIN_W = 380;
const LOG_MIN_H = 200;

function FullQueueLog({ position, onClose, onPositionChange, onFloat, size, onSizeChange }: {
  position: { x: number; y: number };
  onClose: () => void;
  onPositionChange: (pos: { x: number; y: number }) => void;
  onFloat: (id: number, snapshot?: QueuedMutation) => void;
  size: { width: number; height: number };
  onSizeChange: (size: { width: number; height: number }) => void;
}) {
  const { log, clear } = useMutationLog();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const resizingRef = React.useRef<{ edge: string; startX: number; startY: number; startW: number; startH: number } | null>(null);

  // Auto-scroll to bottom when new entries arrive
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [log.length]);

  const resizeStartPos = React.useRef({ x: 0, y: 0 });

  React.useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const d = dragRef.current;
      if (d) {
        e.preventDefault();
        const raw = { x: d.startPosX + (e.clientX - d.startX), y: d.startPosY + (e.clientY - d.startY) };
        onPositionChange(clampPosition(raw.x, raw.y, size.width, size.height));
        return;
      }
      const r = resizingRef.current;
      if (r) {
        e.preventDefault();
        let newW = r.startW;
        let newH = r.startH;
        let newX = resizeStartPos.current.x;
        let newY = resizeStartPos.current.y;
        const dx = e.clientX - r.startX;
        const dy = e.clientY - r.startY;

        if (r.edge.includes("right")) {
          newW = Math.max(LOG_MIN_W, r.startW + dx);
        }
        if (r.edge.includes("left")) {
          const proposed = r.startW - dx;
          if (proposed >= LOG_MIN_W) {
            newW = proposed;
            newX = resizeStartPos.current.x + dx;
          }
        }
        if (r.edge.includes("bottom")) {
          newH = Math.max(LOG_MIN_H, r.startH + dy);
        }
        if (r.edge.includes("top")) {
          const proposed = r.startH - dy;
          if (proposed >= LOG_MIN_H) {
            newH = proposed;
            newY = resizeStartPos.current.y + dy;
          }
        }

        // Clamp to screen
        newX = Math.max(SCREEN_PAD, newX);
        newY = Math.max(SCREEN_PAD, newY);
        newW = Math.min(newW, window.innerWidth - newX - SCREEN_PAD);
        newH = Math.min(newH, window.innerHeight - newY - SCREEN_PAD);

        onSizeChange({ width: newW, height: newH });
        onPositionChange({ x: newX, y: newY });
      }
    }
    function onMouseUp() {
      dragRef.current = null;
      resizingRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onPositionChange, size.width, size.height]);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position.x,
      startPosY: position.y,
    };
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  };

  const resizeCursors: Record<string, string> = {
    top: "ns-resize", bottom: "ns-resize",
    left: "ew-resize", right: "ew-resize",
    "top-left": "nwse-resize", "bottom-right": "nwse-resize",
    "top-right": "nesw-resize", "bottom-left": "nesw-resize",
  };

  const startResize = (edge: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    resizeStartPos.current = position;
    resizingRef.current = {
      edge,
      startX: e.clientX,
      startY: e.clientY,
      startW: size.width,
      startH: size.height,
    };
    document.body.style.cursor = resizeCursors[edge] || "nwse-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div
      className={`fixed z-[52] rounded-lg ${PANEL_BG} backdrop-blur-sm border border-white/10 shadow-2xl font-mono flex flex-col`}
      style={{ left: position.x, top: position.y, width: size.width, height: size.height }}
    >
      {/* Resize handles — all edges and corners */}
      <div onMouseDown={startResize("top")} className="absolute -top-1 left-2 right-2 h-2 cursor-ns-resize" />
      <div onMouseDown={startResize("bottom")} className="absolute -bottom-1 left-2 right-2 h-2 cursor-ns-resize" />
      <div onMouseDown={startResize("left")} className="absolute top-2 -left-1 bottom-2 w-2 cursor-ew-resize" />
      <div onMouseDown={startResize("right")} className="absolute top-2 -right-1 bottom-2 w-2 cursor-ew-resize" />
      <div onMouseDown={startResize("top-left")} className="absolute -top-1 -left-1 w-4 h-4 cursor-nwse-resize" />
      <div onMouseDown={startResize("top-right")} className="absolute -top-1 -right-1 w-4 h-4 cursor-nesw-resize" />
      <div onMouseDown={startResize("bottom-left")} className="absolute -bottom-1 -left-1 w-4 h-4 cursor-nesw-resize" />
      <div onMouseDown={startResize("bottom-right")} className="absolute -bottom-1 -right-1 w-4 h-4 cursor-nwse-resize" />

      <div
        onMouseDown={startDrag}
        className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 shrink-0 cursor-grab active:cursor-grabbing select-none"
      >
        <span className="text-[11px] font-semibold text-white/60">
          Queue Log <span className="text-white/30">({log.length})</span>
        </span>
        <div className="flex items-center gap-1.5">
          <button onClick={clear} className="text-[10px] text-white/30 hover:text-white/60">
            clear
          </button>
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <IconX size={12} />
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="overflow-y-auto flex-1 min-h-0 debug-scrollbar">
        {log.length === 0 ? (
          <div className="p-3 text-[10px] text-white/30">No mutations recorded yet. Perform an action to see entries here.</div>
        ) : (
          <div className="flex flex-col">
            {log.map((entry, i) => (
              <button
                key={i}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey) {
                    onFloat(entry.id, { id: entry.id, status: entry.status, retryCount: entry.retryCount, payload: entry.payload } as QueuedMutation);
                  }
                }}
                onDoubleClick={() => onFloat(entry.id, { id: entry.id, status: entry.status, retryCount: entry.retryCount, payload: entry.payload } as QueuedMutation)}
                className="flex items-start gap-2 px-3 py-1 text-[10px] border-b border-white/5 hover:bg-white/5 w-full text-left"
              >
                <span className="text-white/20 w-5 text-right shrink-0">#{entry.id}</span>
                <span className={`shrink-0 w-12 whitespace-nowrap ${statusColors[entry.status]}`}>{entry.status}</span>
                <span className="text-white/60 truncate flex-1">{payloadSummary(entry.payload)}</span>
                {entry.retryCount > 0 && (
                  <span className="text-orange-400 shrink-0">r{entry.retryCount}</span>
                )}
                <span className="text-white/20 shrink-0 w-16 text-right tabular-nums">
                  {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Undo entry row ──

function UndoEntryRow({ entry, index }: { entry: UndoEntry; index: number }) {
  return (
    <div className="flex items-start gap-2 py-0.5 font-mono text-[10px]">
      <span className="text-white/40 w-4 text-right shrink-0">{index}</span>
      <span className="text-white/70 truncate">{entry.label}</span>
      <span className="text-white/40 shrink-0">
        m#{entry.mutationId} b{entry.before.size} a{entry.after.size}
        {entry.addedIds.length > 0 && ` +${entry.addedIds.length}`}
        {entry.removedIds.length > 0 && ` -${entry.removedIds.length}`}
      </span>
    </div>
  );
}

// ── Font picker (integrated) ──

const FONTS = [
  { label: "Inter", value: '"Inter Variable", sans-serif' },
  { label: "Lora", value: '"Lora Variable", serif' },
  { label: "Crimson Pro", value: '"Crimson Pro Variable", serif' },
  { label: "Source Serif 4", value: '"Source Serif 4 Variable", serif' },
];

function FontSection() {
  const [uiFont, setUiFont] = React.useState(
    () => FONTS.find((f) => f.label === "Source Serif 4")?.value ?? FONTS[0].value,
  );
  const [itemFont, setItemFont] = React.useState(
    () => FONTS.find((f) => f.label === "Source Serif 4")?.value ?? FONTS[0].value,
  );

  React.useEffect(() => {
    document.body.style.fontFamily = uiFont;
  }, [uiFont]);

  React.useEffect(() => {
    document.querySelectorAll<HTMLElement>("[data-item-title]").forEach((el) => {
      el.style.fontFamily = itemFont;
    });
    document.body.style.setProperty("--font-item", itemFont);
  }, [itemFont]);

  function pickUi(value: string) {
    setUiFont(value);
  }

  function pickItem(value: string) {
    setItemFont(value);
  }

  return (
    <div className="flex gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-[9px] font-medium text-white/40 uppercase tracking-wide mb-0.5">UI</span>
        {FONTS.map((font) => (
          <button
            key={font.label}
            onClick={() => pickUi(font.value)}
            className={`text-left text-[10px] px-1.5 py-0.5 rounded transition-colors ${
              uiFont === font.value
                ? "bg-white/15 text-white"
                : "text-white/50 hover:text-white/80"
            }`}
            style={{ fontFamily: font.value }}
          >
            {font.label}
          </button>
        ))}
      </div>
      <div className="w-px bg-white/10" />
      <div className="flex flex-col gap-0.5">
        <span className="text-[9px] font-medium text-white/40 uppercase tracking-wide mb-0.5">Items</span>
        {FONTS.map((font) => (
          <button
            key={font.label}
            onClick={() => pickItem(font.value)}
            className={`text-left text-[10px] px-1.5 py-0.5 rounded transition-colors ${
              itemFont === font.value
                ? "bg-white/15 text-white"
                : "text-white/50 hover:text-white/80"
            }`}
            style={{ fontFamily: font.value }}
          >
            {font.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main panel content ──

function DebugPanelContent({ selectedMutationId, onSelectMutation, floatingIds, onFloat, onToggleQueueLog, queueLogOpen, queueDelay, onQueueDelayChange, forceOffline, onForceOfflineChange }: {
  selectedMutationId: number | null;
  onSelectMutation: (id: number | null) => void;
  floatingIds: Set<number>;
  onFloat: (id: number, snapshot?: QueuedMutation) => void;
  onToggleQueueLog: () => void;
  queueLogOpen: boolean;
  queueDelay: number;
  onQueueDelayChange: (v: number) => void;
  forceOffline: boolean;
  onForceOfflineChange: (v: boolean) => void;
}) {
  const store = useStore();
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const allItems = Array.from(store.items.values());
  const bookmarkCount = allItems.filter((i) => i.type === "bookmark").length;
  const readingListCount = allItems.filter((i) => i.type === "reading-list").length;
  const readCount = allItems.filter((i) => "read" in i && i.read).length;

  const pendingCount = store.mutationQueue.filter((m) => m.status === "pending").length;
  const inFlightCount = store.mutationQueue.filter((m) => m.status === "in-flight").length;
  const doneCount = store.mutationQueue.filter((m) => m.status === "done").length;
  const failedCount = store.mutationQueue.filter((m) => m.status === "failed").length;

  const activeQueue = store.mutationQueue.filter((m) => m.status !== "done");

  return (
    <div className="flex flex-col text-white/90">
      {/* Store Overview */}
      <Section title="Store" badge={`${allItems.length} items`}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <span className="text-white/50">Bookmarks</span>
          <span className="font-mono">{bookmarkCount}</span>
          <span className="text-white/50">Reading List</span>
          <span className="font-mono">{readingListCount}</span>
          <span className="text-white/50">Read</span>
          <span className="font-mono">{readCount}</span>
          <span className="text-white/50">Hydrated</span>
          <span className="flex items-center gap-1">
            <Dot color={store.isHydrated ? "green" : "red"} />
            {store.isHydrated ? "yes" : "no"}
          </span>
          <span className="text-white/50">Online</span>
          <span className="flex items-center gap-1">
            <Dot color={store.isOnline ? "green" : "red"} />
            {store.isOnline ? "yes" : "no"}
          </span>
          <span className="text-white/50">Force offline</span>
          <Switch
            checked={forceOffline}
            onCheckedChange={(checked) => {
              onForceOfflineChange(checked);
            }}
            className="scale-75 origin-left data-[checked]:bg-blue-400 data-[unchecked]:bg-white/20"
          />
        </div>
      </Section>

      {/* Mutation Queue */}
      <Section
        title="Queue"
        badge={`${pendingCount}p ${inFlightCount}f ${doneCount}d ${failedCount}e`}
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mb-1">
          <span className="text-white/50">Syncing</span>
          <span className="flex items-center gap-1">
            <Dot color={store.isSyncing ? "yellow" : "green"} />
            {store.isSyncing ? "yes" : "no"}
          </span>
          <span className="text-white/50">Next ID</span>
          <span className="font-mono">{store.nextMutationId}</span>
          <span className="text-white/50">Total in queue</span>
          <span className="font-mono">{store.mutationQueue.length}</span>
        </div>
        <button
          onClick={onToggleQueueLog}
          className={`flex items-center gap-1 text-[10px] mt-1 mb-1 transition-colors ${queueLogOpen ? "text-blue-400" : "text-white/40 hover:text-white/70"}`}
        >
          <IconList size={10} />
          Full queue log
        </button>
        <div className="flex items-center gap-2 mt-1 mb-1">
          <span className="text-white/50 text-[10px] shrink-0">Delay</span>
          <Slider
            min={0}
            max={10000}
            step={100}
            value={[queueDelay]}
            onValueChange={(v) => {
              const val = Array.isArray(v) ? v[0] : v;
              onQueueDelayChange(val);
            }}
            className="flex-1 [&_[data-slot=slider-track]]:h-1.5 [&_[data-slot=slider-track]]:bg-white/10 [&_[data-slot=slider-range]]:bg-blue-400 [&_[data-slot=slider-thumb]]:size-3 [&_[data-slot=slider-thumb]]:border-blue-400 [&_[data-slot=slider-thumb]]:bg-blue-400"
          />
          <span className="font-mono text-[10px] text-white/70 w-10 text-right shrink-0">
            {queueDelay >= 1000 ? `${(queueDelay / 1000).toFixed(1)}s` : `${queueDelay}ms`}
          </span>
        </div>
        {activeQueue.length > 0 ? (
          <div className="mt-1 border-t border-white/10 pt-1">
            {activeQueue.map((m) => (
              <QueueEntry
                key={m.id}
                m={m}
                selected={selectedMutationId === m.id}
                isFloating={floatingIds.has(m.id)}
                onSelect={(e: React.MouseEvent) => {
                  if (e.metaKey || e.ctrlKey) {
                    onFloat(m.id);
                  } else {
                    onSelectMutation(selectedMutationId === m.id ? null : m.id);
                  }
                }}
                onFloat={() => onFloat(m.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-white/30 text-[10px] mt-1">Queue empty</div>
        )}
      </Section>

      {/* Undo/Redo */}
      <Section
        title="Undo / Redo"
        badge={`${store.undoStack.length}u ${store.redoStack.length}r`}
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mb-1">
          <span className="text-white/50">Undo depth</span>
          <span className="font-mono">{store.undoStack.length} / {UNDO_CAP}</span>
          <span className="text-white/50">Redo depth</span>
          <span className="font-mono">{store.redoStack.length}</span>
        </div>
        {store.undoStack.length > 0 && (
          <div className="mt-1 border-t border-white/10 pt-1">
            <div className="text-white/40 text-[10px] mb-0.5">Undo stack (newest first):</div>
            {[...store.undoStack].reverse().map((entry, i) => (
              <UndoEntryRow key={store.undoStack.length - 1 - i} entry={entry} index={store.undoStack.length - 1 - i} />
            ))}
          </div>
        )}
        {store.redoStack.length > 0 && (
          <div className="mt-1 border-t border-white/10 pt-1">
            <div className="text-white/40 text-[10px] mb-0.5">Redo stack (newest first):</div>
            {[...store.redoStack].reverse().map((entry, i) => (
              <UndoEntryRow key={store.redoStack.length - 1 - i} entry={entry} index={store.redoStack.length - 1 - i} />
            ))}
          </div>
        )}
      </Section>

      {/* Sync Info */}
      <Section title="Sync">
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <span className="text-white/50">Last synced</span>
          <span
            className="font-mono cursor-help"
            title={store.lastSyncedAt ? formatAbsoluteTime(store.lastSyncedAt) : "never"}
          >
            {store.lastSyncedAt ? formatRelativeTime(store.lastSyncedAt) : "never"}
          </span>
          {store.lastSyncedAt && (
            <>
              <span className="text-white/50">Elapsed</span>
              <span className="font-mono">{Math.floor((now - store.lastSyncedAt) / 1000)}s</span>
            </>
          )}
        </div>
      </Section>

      {/* Font Picker */}
      <Section title="Fonts">
        <FontSection />
      </Section>
    </div>
  );
}

// ── Constants ──

const UNDO_CAP = 50;
const MIN_WIDTH = 350;
const MIN_HEIGHT = 300;

// ── Main export ──

export function DebugPanel() {
  const [enabled, setEnabled] = React.useState(false);

  React.useEffect(() => {
    setEnabled(new URLSearchParams(window.location.search).get("debug") === "true");
  }, []);

  // Load persisted state on mount
  const [initialized, setInitialized] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [size, setSize] = React.useState({ width: MIN_WIDTH, height: 450 });
  const [queueDelay, setQueueDelay] = React.useState(0);
  const [forceOffline, setForceOffline] = React.useState(false);
  const [selectedMutationId, setSelectedMutationId] = React.useState<number | null>(null);
  const [floatingEntries, setFloatingEntries] = React.useState<FloatingEntry[]>([]);
  const [queueLogOpen, setQueueLogOpen] = React.useState(false);
  const [queueLogPosition, setQueueLogPosition] = React.useState({ x: 800, y: 60 });
  const [queueLogSize, setQueueLogSize] = React.useState({ width: LOG_MIN_W, height: 500 });
  const mutationQueue = useStore((s) => s.mutationQueue);
  const selectedMutation = selectedMutationId !== null ? mutationQueue.find((m) => m.id === selectedMutationId) ?? null : null;
  const floatingIds = React.useMemo(() => new Set(floatingEntries.map((f) => f.mutationId)), [floatingEntries]);
  const resizingRef = React.useRef<{ edge: string; startX: number; startY: number; startW: number; startH: number } | null>(null);
  const nextFloatOffset = React.useRef(0);

  // Restore from localStorage on mount
  React.useEffect(() => {
    const saved = loadDebugState();
    if (saved.open !== undefined) setOpen(saved.open);
    if (saved.size) setSize(saved.size);
    if (saved.queueLogOpen !== undefined) setQueueLogOpen(saved.queueLogOpen);
    if (saved.queueLogPosition) setQueueLogPosition(saved.queueLogPosition);
    if (saved.queueLogSize) setQueueLogSize(saved.queueLogSize);
    if (saved.queueDelay !== undefined) {
      setQueueDelay(saved.queueDelay);
      __debugQueueDelay.ms = saved.queueDelay;
    }
    setInitialized(true);
  }, []);

  // Persist to localStorage on change
  React.useEffect(() => {
    if (!initialized) return;
    saveDebugState({ open, size, queueLogOpen, queueLogPosition, queueLogSize, queueDelay });
  }, [initialized, open, size, queueLogOpen, queueLogPosition, queueLogSize, queueDelay]);

  // Clamp size to viewport
  React.useEffect(() => {
    function clamp() {
      setSize((prev) => ({
        width: Math.min(prev.width, window.innerWidth - 32),
        height: Math.min(prev.height, window.innerHeight - 80),
      }));
    }
    clamp();
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, []);

  const handleQueueDelayChange = React.useCallback((v: number) => {
    setQueueDelay(v);
    __debugQueueDelay.ms = v;
  }, []);

  const setOnline = useStore((s) => s.setOnline);
  const handleForceOfflineChange = React.useCallback((offline: boolean) => {
    setForceOffline(offline);
    if (offline) {
      __debugOfflineOverride.active = true;
      setOnline(false);
    } else {
      __debugOfflineOverride.active = false;
      setOnline(navigator.onLine);
    }
  }, [setOnline]);

  const handleFloat = React.useCallback((mutationId: number, providedSnapshot?: QueuedMutation) => {
    const queue = useStore.getState().mutationQueue;
    const live = queue.find((m) => m.id === mutationId);
    setFloatingEntries((prev) => {
      if (prev.some((f) => f.mutationId === mutationId)) {
        return prev.filter((f) => f.mutationId !== mutationId);
      }
      const snapshot: QueuedMutation = live ?? providedSnapshot ?? { id: mutationId, status: "done", retryCount: 0, payload: { kind: "delete", id: "unknown" } } as QueuedMutation;
      const offset = nextFloatOffset.current * 24;
      nextFloatOffset.current = (nextFloatOffset.current + 1) % 10;
      return [...prev, { mutationId, position: { x: 400 + offset, y: 100 + offset }, snapshot }];
    });
  }, []);

  const handleFloatPositionChange = React.useCallback((mutationId: number, pos: { x: number; y: number }) => {
    setFloatingEntries((prev) =>
      prev.map((f) => (f.mutationId === mutationId ? { ...f, position: pos } : f))
    );
  }, []);

  const handleFloatClose = React.useCallback((mutationId: number) => {
    setFloatingEntries((prev) => prev.filter((f) => f.mutationId !== mutationId));
  }, []);

  React.useEffect(() => {
    if (!open) return;

    function onMouseMove(e: MouseEvent) {
      const r = resizingRef.current;
      if (!r) return;
      e.preventDefault();

      let newW = r.startW;
      let newH = r.startH;
      const maxW = window.innerWidth - 32;
      const maxH = window.innerHeight - 80;

      if (r.edge.includes("right")) {
        newW = Math.max(MIN_WIDTH, Math.min(maxW, r.startW + (e.clientX - r.startX)));
      }
      if (r.edge.includes("top")) {
        newH = Math.max(MIN_HEIGHT, Math.min(maxH, r.startH - (e.clientY - r.startY)));
      }

      setSize({ width: newW, height: newH });
    }

    function onMouseUp() {
      resizingRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [open]);

  const startResize = (edge: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = {
      edge,
      startX: e.clientX,
      startY: e.clientY,
      startW: size.width,
      startH: size.height,
    };
    document.body.style.cursor =
      edge === "top" ? "ns-resize" : edge === "right" ? "ew-resize" : "nesw-resize";
    document.body.style.userSelect = "none";
  };

  if (!enabled) return null;

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-4 left-4 z-50 w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-colors ${
          open
            ? "bg-white/20 text-white"
            : "bg-neutral-800 text-white/60 hover:text-white hover:bg-neutral-700"
        }`}
        title="Toggle debug panel"
      >
        <IconBug size={16} />
      </button>

      {/* Panel */}
      {open && (
        <div
          className={`fixed bottom-14 left-4 z-50 rounded-lg ${PANEL_BG} backdrop-blur-sm border border-white/10 shadow-2xl font-mono flex flex-col`}
          style={{ width: size.width, height: size.height }}
        >
          {/* Resize handles */}
          <div
            onMouseDown={startResize("top")}
            className="absolute -top-1 left-2 right-2 h-2 cursor-ns-resize"
          />
          <div
            onMouseDown={startResize("right")}
            className="absolute top-2 -right-1 bottom-2 w-2 cursor-ew-resize"
          />
          <div
            onMouseDown={startResize("top-right")}
            className="absolute -top-1 -right-1 w-4 h-4 cursor-nesw-resize"
          />

          <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 shrink-0">
            <span className="text-[11px] font-semibold text-white/60">Store Debug</span>
          </div>
          <div className="overflow-y-auto flex-1 min-h-0 debug-scrollbar">
            <DebugPanelContent
              selectedMutationId={selectedMutationId}
              onSelectMutation={setSelectedMutationId}
              floatingIds={floatingIds}
              onFloat={handleFloat}
              onToggleQueueLog={() => setQueueLogOpen((v) => !v)}
              queueLogOpen={queueLogOpen}
              queueDelay={queueDelay}
              onQueueDelayChange={handleQueueDelayChange}
              forceOffline={forceOffline}
              onForceOfflineChange={handleForceOfflineChange}
            />
          </div>
        </div>
      )}

      {/* Mutation detail popup — positioned to the right of the panel */}
      {open && selectedMutation && (
        <div style={{ left: size.width + 32, bottom: 56 }} className="fixed z-[51]">
          <MutationDetail m={selectedMutation} onClose={() => setSelectedMutationId(null)} />
        </div>
      )}

      {/* Full queue log */}
      {open && queueLogOpen && (
        <FullQueueLog
          position={queueLogPosition}
          onClose={() => setQueueLogOpen(false)}
          onPositionChange={setQueueLogPosition}
          onFloat={handleFloat}
          size={queueLogSize}
          onSizeChange={setQueueLogSize}
        />
      )}

      {/* Floating mutation windows */}
      {open && floatingEntries.map((entry) => (
        <FloatingMutation
          key={entry.mutationId}
          mutationId={entry.mutationId}
          initialSnapshot={entry.snapshot}
          position={entry.position}
          onClose={() => handleFloatClose(entry.mutationId)}
          onPositionChange={(pos) => handleFloatPositionChange(entry.mutationId, pos)}
        />
      ))}
    </>
  );
}
