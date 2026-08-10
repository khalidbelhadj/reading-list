import { isApplePlatform, isModKey } from "@/lib/input-context";

// Single source of truth for the app's keyboard shortcuts. Each entry both
// drives the keydown dispatcher in
// components/items-list/use-keyboard-navigation.ts (via `chords` + `gate` +
// `action`) and, when it carries `display` metadata, renders a row in the `?`
// shortcuts dialog via getShortcutGroups() — so the dialog can't drift from
// the bindings. Entries with `display` but no `chords` are dialog-only rows
// for behaviors that aren't keydown bindings (⌘V lives on a paste listener,
// Esc on the dismiss stack); keep those adjacent comments honest.

/**
 * One key combo. `key` matches e.key exactly (or case-insensitively with
 * `keyLower`); `code` matches e.code. Modifier fields: true = required,
 * false = forbidden, undefined = ignored. `mod` is the platform command
 * modifier (Cmd on Apple, Ctrl elsewhere) via isModKey.
 */
export type ChordSpec = {
  key?: string;
  keyLower?: string;
  code?: string;
  mod?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
};

export const matchesChord = (e: KeyboardEvent, c: ChordSpec): boolean => {
  if (c.key !== undefined && e.key !== c.key) return false;
  if (c.keyLower !== undefined && e.key.toLowerCase() !== c.keyLower)
    return false;
  if (c.code !== undefined && e.code !== c.code) return false;
  if (c.mod !== undefined && isModKey(e) !== c.mod) return false;
  if (c.ctrl !== undefined && e.ctrlKey !== c.ctrl) return false;
  if (c.meta !== undefined && e.metaKey !== c.meta) return false;
  if (c.shift !== undefined && e.shiftKey !== c.shift) return false;
  if (c.alt !== undefined && e.altKey !== c.alt) return false;
  return true;
};

export type ShortcutActionId =
  | "showShortcuts"
  | "openSearch"
  | "focusSearch"
  | "openNew"
  | "cursorDown"
  | "cursorUp"
  | "jumpStart"
  | "jumpEnd"
  | "openItem"
  | "openItemExpanded"
  | "openItemUrl"
  | "extendSelectionDown"
  | "extendSelectionUp"
  | "selectAll"
  | "focusNotes"
  | "toggleReadCursor"
  | "togglePinCursor"
  | "chatCursor"
  | "deleteCursor"
  | "toggleTagFilter"
  | "toggleShowRead"
  | "toggleDensity"
  | "toggleTheme"
  | "panelExpand"
  | "panelCollapse";

// Gating regimes (matching the three the old per-listener handlers used):
//   notTyping          — skipped while the caret is in an editable field
//   noOverlay          — skipped while a dialog/dropdown overlay is open, but
//                        fires from inside editors (⌘K, panel + ⌘⇧ commands)
//   notTypingNoOverlay — both
export type ShortcutGate = "notTyping" | "noOverlay" | "notTypingNoOverlay";

type ShortcutDisplay = {
  group: "General" | "Navigation" | "Selected item" | "View";
  label: string;
  // Symbolic tokens resolved per-platform by getShortcutGroups: "Mod",
  // "Shift", "Enter", "Del"; anything else renders literally.
  combos: string[][];
};

type ShortcutBinding = {
  action: ShortcutActionId;
  chords: ChordSpec[];
  gate: ShortcutGate;
  // Skip when focus rests on a button/link (a delete dialog just restored
  // focus to its trigger, the toolbar is focused…) so Tab/arrows/Enter keep
  // their native meaning there. Explicit-nav chords (Ctrl+N/P, j/k) omit it.
  skipOnInteractive?: boolean;
  display?: ShortcutDisplay;
};

export type ShortcutEntry =
  ShortcutBinding | { action?: never; display: ShortcutDisplay };

const modShift = (keyLower: string): ChordSpec[] => [
  { keyLower, mod: true, shift: true, alt: false },
];

export const SHORTCUT_ENTRIES: ShortcutEntry[] = [
  // ——— General ———
  {
    action: "showShortcuts",
    chords: [{ key: "?", meta: false, ctrl: false }],
    gate: "notTyping",
    display: {
      group: "General",
      label: "Show keyboard shortcuts",
      combos: [["?"]],
    },
  },
  {
    action: "openSearch",
    chords: [{ key: "/", meta: false, ctrl: false }],
    gate: "notTyping",
    display: {
      group: "General",
      label: "Search",
      combos: [["/"], ["Mod", "K"]],
    },
  },
  // ⌘K also pops a full-view panel back to side view so search is visible;
  // unlike "/", it works from inside editors (displayed on the row above).
  {
    action: "focusSearch",
    chords: [{ keyLower: "k", mod: true, shift: false, alt: false }],
    gate: "noOverlay",
  },
  {
    action: "openNew",
    chords: [{ key: "a", meta: false, ctrl: false }],
    gate: "notTyping",
    display: { group: "General", label: "Add item", combos: [["A"]] },
  },
  // Dialog-only: ⌘V quick-add is a document "paste" listener in
  // use-keyboard-navigation.ts, not a keydown binding.
  {
    display: {
      group: "General",
      label: "Paste URL to add",
      combos: [["Mod", "V"]],
    },
  },

  // ——— Navigation ———
  // Ctrl+N/P and j/k drive the cursor even when a button/link has focus
  // (so navigation survives a delete); the arrow variants don't.
  {
    action: "cursorDown",
    chords: [
      { code: "KeyN", ctrl: true, meta: false, shift: false, alt: false },
      { code: "KeyJ", ctrl: false, meta: false, shift: false, alt: false },
    ],
    gate: "notTyping",
    display: {
      group: "Navigation",
      label: "Next item",
      combos: [["J"], ["↓"]],
    },
  },
  {
    action: "cursorDown",
    chords: [
      { key: "ArrowDown", ctrl: false, meta: false, shift: false, alt: false },
    ],
    gate: "notTyping",
    skipOnInteractive: true,
  },
  {
    action: "cursorUp",
    chords: [
      { code: "KeyP", ctrl: true, meta: false, shift: false, alt: false },
      { code: "KeyK", ctrl: false, meta: false, shift: false, alt: false },
    ],
    gate: "notTyping",
    display: {
      group: "Navigation",
      label: "Previous item",
      combos: [["K"], ["↑"]],
    },
  },
  {
    action: "cursorUp",
    chords: [
      { key: "ArrowUp", ctrl: false, meta: false, shift: false, alt: false },
    ],
    gate: "notTyping",
    skipOnInteractive: true,
  },
  // With Shift held, "," and "." arrive as "<" and ">" on most layouts; fall
  // back to e.code too.
  {
    action: "jumpStart",
    chords: [
      { key: "ArrowUp", mod: true, shift: false, alt: false },
      { key: "<", mod: true, shift: true, alt: false },
      { code: "Comma", mod: true, shift: true, alt: false },
    ],
    gate: "notTyping",
    skipOnInteractive: true,
    display: {
      group: "Navigation",
      label: "Jump to start",
      combos: [
        ["Mod", "↑"],
        ["Mod", "Shift", "<"],
      ],
    },
  },
  {
    action: "jumpEnd",
    chords: [
      { key: "ArrowDown", mod: true, shift: false, alt: false },
      { key: ">", mod: true, shift: true, alt: false },
      { code: "Period", mod: true, shift: true, alt: false },
    ],
    gate: "notTyping",
    skipOnInteractive: true,
    display: {
      group: "Navigation",
      label: "Jump to end",
      combos: [
        ["Mod", "↓"],
        ["Mod", "Shift", ">"],
      ],
    },
  },
  {
    action: "openItem",
    chords: [{ key: "Enter", meta: false, ctrl: false, shift: false }],
    gate: "notTypingNoOverlay",
    skipOnInteractive: true,
    display: { group: "Navigation", label: "Open item", combos: [["Enter"]] },
  },
  {
    action: "openItemExpanded",
    chords: [{ key: "Enter", mod: true, shift: false }],
    gate: "notTypingNoOverlay",
    skipOnInteractive: true,
    display: {
      group: "Navigation",
      label: "Open expanded",
      combos: [["Mod", "Enter"]],
    },
  },
  {
    action: "openItemUrl",
    chords: [{ key: "Enter", mod: true, shift: true }],
    gate: "notTypingNoOverlay",
    skipOnInteractive: true,
    display: {
      group: "Navigation",
      label: "Open URL in new tab",
      combos: [["Mod", "Shift", "Enter"]],
    },
  },
  {
    action: "extendSelectionDown",
    chords: [
      { key: "ArrowDown", shift: true, ctrl: false, meta: false, alt: false },
    ],
    gate: "notTyping",
    skipOnInteractive: true,
    display: {
      group: "Navigation",
      label: "Extend selection",
      combos: [
        ["Shift", "↓"],
        ["Shift", "↑"],
      ],
    },
  },
  {
    action: "extendSelectionUp",
    chords: [
      { key: "ArrowUp", shift: true, ctrl: false, meta: false, alt: false },
    ],
    gate: "notTyping",
    skipOnInteractive: true,
  },
  {
    action: "selectAll",
    chords: [{ code: "KeyA", mod: true, shift: false, alt: false }],
    gate: "notTypingNoOverlay",
    skipOnInteractive: true,
    display: {
      group: "Navigation",
      label: "Select all items",
      combos: [["Mod", "A"]],
    },
  },
  // Dialog-only: Escape is owned by the dismiss stack (lib/dismiss-stack.ts),
  // not a keydown binding here.
  {
    display: {
      group: "Navigation",
      label: "Clear selection",
      combos: [["Esc"]],
    },
  },

  // ——— Selected item ———
  // Tab moves focus into the notes editor; Shift+Tab is swallowed. Gated on
  // typing so Tab keeps its native behavior inside the notes/title fields.
  {
    action: "focusNotes",
    chords: [{ key: "Tab", ctrl: false, meta: false, alt: false }],
    gate: "notTypingNoOverlay",
    display: {
      group: "Selected item",
      label: "Focus notes",
      combos: [["Tab"]],
    },
  },
  {
    action: "toggleReadCursor",
    chords: modShift("m"),
    gate: "noOverlay",
    display: {
      group: "Selected item",
      label: "Mark read / unread",
      combos: [["Mod", "Shift", "M"]],
    },
  },
  {
    action: "togglePinCursor",
    chords: modShift("p"),
    gate: "noOverlay",
    display: {
      group: "Selected item",
      label: "Pin / unpin",
      combos: [["Mod", "Shift", "P"]],
    },
  },
  {
    action: "chatCursor",
    chords: modShift("j"),
    gate: "noOverlay",
    display: {
      group: "Selected item",
      label: "Chat with Claude",
      combos: [["Mod", "Shift", "J"]],
    },
  },
  {
    action: "deleteCursor",
    chords: [{ key: "Backspace", mod: true }],
    gate: "notTypingNoOverlay",
    display: {
      group: "Selected item",
      label: "Delete item",
      combos: [["Mod", "Del"]],
    },
  },

  // ——— View ———
  {
    action: "toggleTagFilter",
    chords: modShift("f"),
    gate: "noOverlay",
    display: {
      group: "View",
      label: "Filter by tags",
      combos: [["Mod", "Shift", "F"]],
    },
  },
  {
    action: "toggleShowRead",
    chords: modShift("h"),
    gate: "noOverlay",
    display: {
      group: "View",
      label: "Show / hide read",
      combos: [["Mod", "Shift", "H"]],
    },
  },
  {
    action: "toggleDensity",
    chords: modShift("v"),
    gate: "noOverlay",
    display: {
      group: "View",
      label: "Toggle density",
      combos: [["Mod", "Shift", "V"]],
    },
  },
  {
    action: "toggleTheme",
    chords: modShift("l"),
    gate: "noOverlay",
    display: {
      group: "View",
      label: "Toggle theme",
      combos: [["Mod", "Shift", "L"]],
    },
  },
  // ⌘[ / ⌘] expand / collapse the panel a step (side ↔ fullw ↔ closed); they
  // work from inside editors (displayed as one combined row).
  {
    action: "panelExpand",
    chords: [{ key: "[", mod: true, shift: false, alt: false }],
    gate: "noOverlay",
    display: {
      group: "View",
      label: "Expand / collapse panel",
      combos: [
        ["Mod", "["],
        ["Mod", "]"],
      ],
    },
  },
  {
    action: "panelCollapse",
    chords: [{ key: "]", mod: true, shift: false, alt: false }],
    gate: "noOverlay",
  },
];

type Shortcut = {
  label: string;
  // Each inner array is one key combo (rendered as adjacent keycaps); multiple
  // entries are alternative bindings for the same action (rendered "A / B").
  combos: string[][];
};

export type ShortcutGroup = { title: string; shortcuts: Shortcut[] };

// The shortcuts help dialog, derived from SHORTCUT_ENTRIES above. Resolved at
// call time so the modifier glyphs match the platform (⌘/⇧/↵ on Apple,
// spelled out elsewhere). Call from inside a mounted popup to avoid
// SSR/client mismatch.
export const getShortcutGroups = (): ShortcutGroup[] => {
  const apple = isApplePlatform();
  const tokens: Record<string, string> = {
    Mod: apple ? "⌘" : "Ctrl",
    Shift: apple ? "⇧" : "Shift",
    Enter: apple ? "↵" : "Enter",
    Del: apple ? "⌫" : "Backspace",
  };
  const groups = new Map<string, Shortcut[]>();
  for (const entry of SHORTCUT_ENTRIES) {
    if (!entry.display) continue;
    const { group, label, combos } = entry.display;
    const resolved = combos.map((combo) =>
      combo.map((token) => tokens[token] ?? token),
    );
    const shortcuts = groups.get(group) ?? [];
    shortcuts.push({ label, combos: resolved });
    groups.set(group, shortcuts);
  }
  return [...groups.entries()].map(([title, shortcuts]) => ({
    title,
    shortcuts,
  }));
};
