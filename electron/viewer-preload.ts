// Preload injected into the viewer <webview> guest (a third-party page).
// Enforced from the main process via will-attach-webview — the renderer
// can't opt out of it. Talks ONLY to the embedding app renderer via
// ipcRenderer.sendToHost / VIEWER_CHANNELS; nothing is exposed to the
// guest page itself (contextIsolation stays on and we never touch
// contextBridge here).
import { ipcRenderer } from "electron";

import { VIEWER_CHANNELS, type ViewerRpcMethod } from "./channels";

const CONTEXT_CHARS = 200;

type Selection = { text: string; prefix: string; suffix: string };

// Mirrored in lib/viewer/selection.ts (describeSelection) — keep the
// algorithm in sync. The preload build's rootDir (electron/) can't reach
// lib/, so the two copies can't share a module; the lib copy additionally
// scopes the selection to a container element.
const describeSelection = (): Selection | null => {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }
  const text = selection.toString().trim();
  if (!text) return null;
  const range = selection.getRangeAt(0);
  const root = document.body ?? document.documentElement;

  const before = document.createRange();
  before.selectNodeContents(root);
  before.setEnd(range.startContainer, range.startOffset);
  const after = document.createRange();
  after.selectNodeContents(root);
  after.setStart(range.endContainer, range.endOffset);

  return {
    text,
    prefix: before.toString().slice(-CONTEXT_CHARS),
    suffix: after.toString().slice(0, CONTEXT_CHARS),
  };
};

const getState = () => {
  const scroller = document.scrollingElement;
  return {
    url: window.location.href,
    title: document.title,
    scroll: scroller
      ? {
          y: scroller.scrollTop,
          max: Math.max(0, scroller.scrollHeight - scroller.clientHeight),
        }
      : undefined,
    selection: describeSelection(),
  };
};

// Text of elements currently intersecting the viewport — coarse but honest
// "what's on screen" for session context.
const getVisibleText = (): string => {
  const blocks = document.querySelectorAll(
    "p, h1, h2, h3, h4, h5, h6, li, pre, blockquote, td, figcaption",
  );
  const parts: string[] = [];
  let total = 0;
  for (const block of blocks) {
    const rect = block.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
    if (rect.width === 0 || rect.height === 0) continue;
    const text = (block as HTMLElement).innerText?.trim();
    if (!text) continue;
    parts.push(text);
    total += text.length;
    if (total > 8000) break;
  }
  return parts.join("\n\n");
};

// ---------------------------------------------------------------------------
// Element picker (captureNode): hover overlay → click → bounding rect back to
// the host, which screenshots that rect via webview.capturePage.
// ---------------------------------------------------------------------------

let pickerCleanup: (() => void) | null = null;

const stopPicker = () => {
  pickerCleanup?.();
  pickerCleanup = null;
};

const startPicker = () => {
  stopPicker();
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;z-index:2147483647;pointer-events:none;" +
    "background:rgba(59,130,246,0.18);outline:2px solid rgba(59,130,246,0.9);" +
    "border-radius:3px;transition:all 40ms linear;display:none;";
  document.documentElement.appendChild(overlay);

  let target: Element | null = null;

  const onMove = (event: MouseEvent) => {
    target = document.elementFromPoint(event.clientX, event.clientY);
    if (!target || target === overlay) return;
    const rect = target.getBoundingClientRect();
    overlay.style.display = "block";
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
  };
  const onClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const text = (target as HTMLElement).innerText?.slice(0, 2000) ?? "";
    stopPicker();
    ipcRenderer.sendToHost(VIEWER_CHANNELS.nodePicked, {
      rect: {
        x: Math.max(0, Math.round(rect.left)),
        y: Math.max(0, Math.round(rect.top)),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      text,
    });
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      stopPicker();
      ipcRenderer.sendToHost(VIEWER_CHANNELS.nodePicked, {
        rect: null,
        text: "",
      });
    }
  };

  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKey, true);
  pickerCleanup = () => {
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKey, true);
    overlay.remove();
  };
};

// ---------------------------------------------------------------------------
// Host RPC + pushed events
// ---------------------------------------------------------------------------

ipcRenderer.on(
  VIEWER_CHANNELS.request,
  (_event, payload: { id: number; method: ViewerRpcMethod }) => {
    const { id, method } = payload;
    let result: unknown = null;
    try {
      switch (method) {
        case "getState":
          result = getState();
          break;
        case "getVisibleText":
          result = getVisibleText();
          break;
        case "getSelection":
          result = describeSelection();
          break;
        case "extract":
          result = {
            html: document.documentElement.outerHTML,
            url: window.location.href,
            title: document.title,
          };
          break;
        case "startNodePicker":
          startPicker();
          result = true;
          break;
        default:
          // Exhaustiveness: a new ViewerRpcMethod member fails to compile
          // here until it's handled.
          void (method satisfies never);
          break;
      }
    } catch {
      result = null;
    }
    ipcRenderer.sendToHost(VIEWER_CHANNELS.response, { id, result });
  },
);
