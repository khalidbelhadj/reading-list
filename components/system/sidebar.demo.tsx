import { type Demo } from "./demo";
import { Sidebar } from "./sidebar";

export const demo: Demo = {
  title: "Sidebar",
  description:
    "A frost sidebar resizable from its right edge: drag to resize within bounds, double-click the edge to reset. Width persists under a storage key. Over wallpaper in Electron it is real vibrancy.",
  render: () => (
    <div
      className="flex h-72 overflow-hidden rounded-surface"
      style={{
        background:
          "radial-gradient(120% 80% at 20% 10%, oklch(0.78 0.12 60) 0%, transparent 55%), radial-gradient(90% 70% at 85% 80%, oklch(0.7 0.1 128) 0%, transparent 55%), oklch(0.93 0.02 80)",
      }}
    >
      <Sidebar defaultWidth={200} minWidth={140} maxWidth={320}>
        <div className="p-3 text-small text-muted-foreground">
          Drag the right edge
        </div>
      </Sidebar>
      <div className="flex-1" />
    </div>
  ),
};
