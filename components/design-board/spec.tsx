import type React from "react";

import { cn } from "@/lib/utils";

import { slug } from "./outline";

// The decided foundations, rendered from the live tokens. If this page and
// DESIGN.md disagree, one of them is wrong.

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section id={slug(title)} className="flex scroll-mt-14 flex-col gap-4">
    <h2 className="font-content text-heading font-semibold">{title}</h2>
    {children}
  </section>
);

const COLOURS = [
  ["background", "page"],
  ["card", "opaque surface"],
  ["muted", "quiet fill, hover"],
  ["border", "hairlines, inputs"],
  ["foreground", "text"],
  ["muted-foreground", "secondary text"],
  ["primary", "the accent"],
  ["destructive", "delete"],
] as const;

const Swatch = ({ name, role }: { name: string; role: string }) => (
  <div className="flex flex-col gap-2">
    <div
      className="h-14 rounded-control shadow-surface"
      style={{ background: `var(--${name})` }}
    />
    <div className="flex flex-col">
      <span className="font-mono text-small">--{name}</span>
      <span className="text-small text-muted-foreground">{role}</span>
    </div>
  </div>
);

const TYPE = [
  ["display", "text-display", "Saturday 22 August"],
  ["heading", "text-heading", "Flashcards"],
  ["title", "text-title", "Two Ways To Do Dynamic Dispatch"],
  [
    "body",
    "text-body",
    "Besides method pointers, what else does a vtable store?",
  ],
  ["small", "text-small", "youtube.com, 2d ago, 110 due"],
  ["micro", "text-micro", "Recent, key caps, group labels"],
] as const;

export const Spec = () => (
  <div className="flex flex-col gap-14">
    <Section title="Colour">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {COLOURS.map(([name, role]) => (
          <Swatch key={name} name={name} role={role} />
        ))}
      </div>
    </Section>

    <Section title="Type">
      <div className="flex flex-col gap-3">
        {TYPE.map(([name, utility, sample]) => (
          <div key={name} className="flex items-baseline gap-6">
            <span className="w-28 shrink-0 font-mono text-small text-muted-foreground">
              {utility}
            </span>
            <span
              className={cn(
                "font-content",
                utility,
                name !== "body" &&
                  name !== "small" &&
                  name !== "micro" &&
                  "font-semibold tracking-tight",
              )}
            >
              {sample}
            </span>
          </div>
        ))}
      </div>
    </Section>

    <Section title="Shape">
      <div className="flex flex-wrap items-end gap-6">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-28 rounded-control bg-primary" />
          <span className="font-mono text-small text-muted-foreground">
            rounded-control 10px
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="h-24 w-40 rounded-surface bg-card shadow-surface" />
          <span className="font-mono text-small text-muted-foreground">
            rounded-surface 20px, shadow-surface
          </span>
        </div>
        <div
          className="flex flex-col gap-2 rounded-surface p-3"
          style={{
            background:
              "radial-gradient(120% 80% at 20% 10%, oklch(0.78 0.12 60) 0%, transparent 55%), radial-gradient(90% 70% at 85% 80%, oklch(0.7 0.1 128) 0%, transparent 55%), oklch(0.93 0.02 80)",
          }}
        >
          <div className="glass h-18 w-40 rounded-surface" />
          <span className="font-mono text-small text-foreground/70">
            glass 74% / 18px
          </span>
        </div>
      </div>
    </Section>

    <Section title="Density and motion">
      <ul className="flex max-w-sm flex-col gap-0.5">
        {[
          "Linux Container Primitives",
          "How Firecracker works",
          "Multicast and the Markets",
        ].map((title, index) => (
          <li
            key={title}
            className={cn(
              "flex h-row items-center gap-2 rounded-control px-2 text-body",
              index === 0 ? "bg-foreground/[0.07]" : "text-muted-foreground",
            )}
          >
            <span className="size-3.5 rounded-[4px] bg-primary/60" />
            {title}
          </li>
        ))}
      </ul>
      <p className="text-small text-muted-foreground">
        h-row 28px, lists gap 2px. Motion: ease-out quint, 150ms for state
        changes, 250ms for layout.
      </p>
    </Section>
  </div>
);
