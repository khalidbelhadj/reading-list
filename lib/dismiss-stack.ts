import { isOverlayOpen } from "@/lib/input-context";

// ===========================================================================
// Escape / dismiss-stack — the single source of truth for "what does Escape do
// right now?"
// ===========================================================================
//
// Mental model: Escape is an UNDO for transient UI. Every dismissible surface
// (search bar, item panel, transient edit modes, …) is a "layer" on a LIFO
// stack. One global Escape listener pops the top-most layer and runs its
// dismiss effect, so a single Escape always backs out of the most recent thing
// the user opened or focused. Stack them up, Escape peels them off in reverse.
//
// This replaced an earlier design where ~5 separate keydown handlers each
// inspected global DOM state (`[data-phase]`, `isOverlayOpen()`, focus
// containment) to decide whether to act or defer. That was order-dependent and
// every new Escape consumer had to re-derive the same guards. Here, precedence
// is just stack position.
//
// THE RULES
//   1. Lifecycle — a layer registers (push) the moment it activates and
//      unregisters (pop) on EVERY exit path: Escape, commit, click-away,
//      programmatic close, unmount. The stack must never hold a closed layer.
//      In React this is `useDismissLayer({ active, onDismiss })`, whose effect
//      cleanup guarantees the pop.
//   2. Ordering — newest on top (recency of activation). Re-focusing a layer
//      that's already deeper in the stack PROMOTES it back to the top (see
//      `handleFocusIn`), so "open item → open search → click back into item →
//      Esc" closes the item, not the search. This is "last interacted," not
//      "first opened."
//   3. Modality overrides recency — base-ui dialogs / dropdowns / drawers are
//      NOT layers. They portal out, trap focus, and handle their own Escape, so
//      the dispatcher bails entirely while `isOverlayOpen()` (the one DOM guard
//      worth keeping, because modality is a genuinely different tier).
//   4. One per press — exactly one layer is dismissed per Escape, and the event
//      is consumed (preventDefault + stopPropagation) so nothing double-fires.
//   5. Fall-through — empty stack ⇒ run the app-level default registered via
//      `setDismissFallback` (today: clear the list cursor).
//
// FOCUSED TEXT FIELDS ARE A TWO-STEP (and live OUTSIDE this stack)
//   A focused input/editor behaves like an implicit extra layer on top of its
//   surface. The field owns its own local Escape handler that does the "first
//   step" and `stopPropagation`s so this dispatcher never sees it:
//     - Search input  → 1st Esc blurs (bar stays open), 2nd Esc pops the bar.
//     - Notes/title   → 1st Esc blurs the editor (panel stays), 2nd pops panel.
//                       (Panel runs this as a capture-phase handler.)
//     - Tag rename    → destructive, so it collapses to ONE step: Esc cancels
//                       outright (no blur-limbo). Already local + stopProp.
//   Because these fields stopPropagation, find-bar (Cmd+F) and tag-input also
//   "just work" without being migrated — their Escape is consumed before it
//   reaches the dispatcher.
//
// WORKED EXAMPLE (the canonical scenario this was built for)
//   search                push search-bar          stack: [search]
//   click item            push panel               stack: [search, panel]
//   focus notes, type     (field's own 1st-step)
//   Esc                   blur notes editor        stack: [search, panel]
//   start tag rename      (rename is local, not a stack layer)
//   Esc                   cancel rename            stack: [search, panel]
//   Esc                   pop panel  → close item  stack: [search]
//   Esc                   pop search → cancel      stack: []
//   Esc                   fallback   → clear cursor stack: []
//
// WHERE THINGS LIVE
//   lib/dismiss-stack.ts          — this file: registry + dispatcher (rules 2–5)
//   lib/use-dismiss-layer.ts      — React binding (rule 1)
//   sliding-item-panel.tsx        — panel layer + notes blur-first (capture)
//   search-bar.tsx                — search-bar layer + input blur-first
//   use-keyboard-navigation.ts    — registers the cursor-clear fallback
//   tag-rename-input / find-bar / tag-input — local, self-consuming Escape
// ===========================================================================
type Entry = {
  id: number;
  dismiss: () => void;
  // Identifies nodes belonging to this layer, for promote-on-focus (rule 2).
  contains: ((node: Node) => boolean) | null;
};

let nextId = 1;
let stack: Entry[] = [];
let fallback: (() => void) | null = null;
let installed = false;

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key !== "Escape" || e.defaultPrevented) return;
  // Rule 3 — let modal overlays handle their own Escape.
  if (isOverlayOpen()) return;
  if (stack.length > 0) {
    // Rule 4 — pop and dismiss exactly one layer, consuming the event.
    const entry = stack[stack.length - 1];
    e.preventDefault();
    e.stopPropagation();
    entry?.dismiss();
    return;
  }
  // Rule 5 — nothing dismissible is open.
  fallback?.();
};

const handleFocusIn = (e: FocusEvent) => {
  // Rule 2 — float the layer that owns the newly-focused node to the top.
  const target = e.target as Node | null;
  if (!target || stack.length < 2) return;
  for (let i = stack.length - 1; i >= 0; i--) {
    const entry = stack[i];
    if (!entry) continue;
    if (entry.contains?.(target)) {
      if (i !== stack.length - 1) {
        stack.splice(i, 1);
        stack.push(entry);
      }
      return;
    }
  }
};

const ensureInstalled = () => {
  if (installed || typeof document === "undefined") return;
  installed = true;
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("focusin", handleFocusIn);
};

// Push a layer onto the stack. Returns an unregister function — call it on
// every exit path (Escape, commit, click-away, unmount) so the stack never
// holds a closed layer.
export const pushDismissLayer = (
  dismiss: () => void,
  options?: { contains?: (node: Node) => boolean },
): (() => void) => {
  ensureInstalled();
  const id = nextId++;
  stack.push({ id, dismiss, contains: options?.contains ?? null });
  return () => {
    stack = stack.filter((entry) => entry.id !== id);
  };
};

// Register the app-level default that runs when Escape is pressed and nothing
// is on the stack (rule 5). Returns a function to clear it.
export const setDismissFallback = (fn: () => void): (() => void) => {
  fallback = fn;
  return () => {
    if (fallback === fn) fallback = null;
  };
};
