import { type Demo } from "@/components/system/demo";

import { slug } from "./outline";

// Every `*.demo.tsx` in the kit, collected at build time: base primitives
// from components/system and app compositions from components/app. Adding a
// component adds it here; nothing to register.
const collect = (modules: Record<string, { demo: Demo }>) =>
  Object.entries(modules)
    .map(([path, module]) => ({ path, demo: module.demo }))
    .sort((a, b) => a.demo.title.localeCompare(b.demo.title));

const base = collect(
  import.meta.glob<{ demo: Demo }>("/components/system/*.demo.tsx", {
    eager: true,
  }),
);
const app = collect(
  import.meta.glob<{ demo: Demo }>("/components/app/*.demo.tsx", {
    eager: true,
  }),
);

export const COMPONENT_GROUPS = [
  { label: "Base", demos: base },
  { label: "App", demos: app },
];

const DemoSection = ({ demo }: { demo: Demo }) => (
  <section id={slug(demo.title)} className="flex scroll-mt-14 flex-col gap-5">
    <div className="flex flex-col gap-1">
      <h2 className="font-content text-heading font-semibold">{demo.title}</h2>
      <p className="max-w-prose text-body text-muted-foreground">
        {demo.description}
      </p>
    </div>
    <div className="rounded-surface bg-background p-6 ring-1 ring-border">
      {demo.render()}
    </div>
  </section>
);

export const ComponentsPage = () => (
  <div className="flex flex-col gap-20">
    {COMPONENT_GROUPS.map((group) => (
      <div key={group.label} className="flex flex-col gap-12">
        <div className="flex flex-col gap-1">
          <h2 className="font-content text-display font-semibold tracking-tight">
            {group.label}
          </h2>
          <p className="max-w-prose text-body text-muted-foreground">
            {group.label === "Base"
              ? "Primitives with no knowledge of the app: anything here could ship in another product unchanged."
              : "Compositions shaped by this app: rows, sidebar entries and other pieces that know what an item or a card is."}
          </p>
        </div>
        {group.demos.map(({ path, demo }) => (
          <DemoSection key={path} demo={demo} />
        ))}
      </div>
    ))}
  </div>
);
