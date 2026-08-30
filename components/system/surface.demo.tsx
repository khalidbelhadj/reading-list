import { Button } from "./button";
import { type Demo } from "./demo";
import { Surface } from "./surface";

const Content = () => (
  <div className="flex flex-col gap-3">
    <span className="font-content text-title font-medium">
      Two Ways To Do Dynamic Dispatch
    </span>
    <p className="text-body text-muted-foreground">
      Besides method pointers, what else does a Rust trait object&rsquo;s vtable
      typically store?
    </p>
    <div className="flex justify-end gap-2">
      <Button variant="ghost">Next</Button>
      <Button variant="primary">Flip</Button>
    </div>
  </div>
);

export const demo: Demo = {
  title: "Surface",
  description:
    "Opaque for content that must be read (cards, popovers, dialogs); frost for chrome that sits over content or wallpaper (sidebar, floating panels).",
  render: () => (
    <div className="grid gap-4 md:grid-cols-2">
      <Surface>
        <Content />
      </Surface>
      <div
        className="rounded-surface p-4"
        style={{
          background:
            "radial-gradient(120% 80% at 20% 10%, oklch(0.78 0.12 60) 0%, transparent 55%), radial-gradient(90% 70% at 85% 80%, oklch(0.7 0.1 128) 0%, transparent 55%), oklch(0.93 0.02 80)",
        }}
      >
        <Surface kind="frost">
          <Content />
        </Surface>
      </div>
    </div>
  ),
};
