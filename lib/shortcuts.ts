import { isApplePlatform } from "@/lib/input-context";

export type Shortcut = {
  label: string;
  // Each inner array is one key combo (rendered as adjacent keycaps); multiple
  // entries are alternative bindings for the same action (rendered "A / B").
  combos: string[][];
};

export type ShortcutGroup = { title: string; shortcuts: Shortcut[] };

// Single source of truth for the shortcuts help dialog. Resolved at call time
// so the modifier glyphs match the platform (⌘/⇧/↵ on Apple, spelled out
// elsewhere). Call from inside a mounted popup to avoid SSR/client mismatch.
export const getShortcutGroups = (): ShortcutGroup[] => {
  const apple = isApplePlatform();
  const mod = apple ? "⌘" : "Ctrl";
  const shift = apple ? "⇧" : "Shift";
  const enter = apple ? "↵" : "Enter";
  const del = apple ? "⌫" : "Backspace";

  return [
    {
      title: "General",
      shortcuts: [
        { label: "Show keyboard shortcuts", combos: [["?"]] },
        { label: "Search", combos: [["/"], [mod, "K"]] },
        { label: "Add item", combos: [["A"]] },
        { label: "Paste URL to add", combos: [[mod, "V"]] },
      ],
    },
    {
      title: "Navigation",
      shortcuts: [
        { label: "Next item", combos: [["J"], ["↓"]] },
        { label: "Previous item", combos: [["K"], ["↑"]] },
        {
          label: "Jump to start",
          combos: [
            [mod, "↑"],
            [mod, shift, "<"],
          ],
        },
        {
          label: "Jump to end",
          combos: [
            [mod, "↓"],
            [mod, shift, ">"],
          ],
        },
        { label: "Open item", combos: [[enter]] },
        { label: "Open expanded", combos: [[mod, enter]] },
        { label: "Open URL in new tab", combos: [[mod, shift, enter]] },
        { label: "Clear selection", combos: [["Esc"]] },
      ],
    },
    {
      title: "Selected item",
      shortcuts: [
        { label: "Mark read / unread", combos: [[mod, shift, "M"]] },
        { label: "Pin / unpin", combos: [[mod, shift, "P"]] },
        { label: "Chat with Claude", combos: [[mod, shift, "J"]] },
        { label: "Delete item", combos: [[mod, del]] },
      ],
    },
    {
      title: "View",
      shortcuts: [
        { label: "Filter by tags", combos: [["T"]] },
        { label: "Show / hide read", combos: [["R"]] },
        { label: "Toggle density", combos: [[mod, shift, "V"]] },
        { label: "Toggle theme", combos: [[mod, shift, "L"]] },
        {
          label: "Expand / collapse panel",
          combos: [
            [mod, "["],
            [mod, "]"],
          ],
        },
      ],
    },
  ];
};
