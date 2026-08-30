import type React from "react";

import { cn } from "@/lib/utils";

import { ACCENT, GLASS, type Option, RADIUS, WARMTH } from "./options";
import { slug } from "./outline";
import {
  Frame,
  SampleButton,
  SampleCard,
  SampleInput,
  SampleRows,
} from "./previews";
import { RoundFour } from "./round-four";
import { RoundThree } from "./round-three";
import { RoundTwo } from "./round-two";

const Section = ({
  title,
  question,
  children,
}: {
  title: string;
  question: string;
  children: React.ReactNode;
}) => (
  <section id={slug(title)} className="flex scroll-mt-14 flex-col gap-5">
    <div className="flex flex-col gap-1">
      <h2 className="font-content text-lg font-semibold">{title}</h2>
      <p className="max-w-prose text-sm text-muted-foreground">{question}</p>
    </div>
    {children}
  </section>
);

const OptionHeader = ({ label, note }: { label: string; note: string }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-sm font-medium">{label}</span>
    <span className="text-xs text-muted-foreground">{note}</span>
  </div>
);

const PairedFrames = ({
  option,
  children,
}: {
  option: Option;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-3">
    <OptionHeader label={option.label} note={option.note} />
    <div className="grid grid-cols-2 gap-2">
      <Frame tokens={option.light}>{children}</Frame>
      <Frame tokens={option.dark} dark>
        {children}
      </Frame>
    </div>
  </div>
);

const WarmthSection = () => (
  <Section
    title="1. Warmth"
    question="Both are warm greys on hue 70 to 80. A is the minimum that still feels like paper; B is a deliberate linen tint. Look at the page background against the card, and at muted text."
  >
    <div className="grid gap-8">
      {WARMTH.map((option) => (
        <PairedFrames key={option.key} option={option}>
          <SampleCard />
          <SampleInput />
        </PairedFrames>
      ))}
    </div>
  </Section>
);

const AccentSection = () => (
  <Section
    title="2. Accent"
    question="One colour, used for the primary action, selection and progress. Shown on the Whisper neutrals; switch in your head if you picked Linen."
  >
    <div className="grid gap-8 lg:grid-cols-3">
      {ACCENT.map((option) => {
        const base = WARMTH[0];
        return (
          <PairedFrames
            key={option.key}
            option={{
              ...option,
              light: { ...base?.light, ...option.light },
              dark: { ...base?.dark, ...option.dark },
            }}
          >
            <div className="flex flex-col gap-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-2/3 bg-primary" />
              </div>
              <div className="flex gap-2">
                <SampleButton variant="primary">Review 110</SampleButton>
                <SampleButton variant="secondary">Flip</SampleButton>
              </div>
              <SampleRows />
            </div>
          </PairedFrames>
        );
      })}
    </div>
  </Section>
);

const RadiusSection = () => (
  <Section
    title="3. Radius"
    question="A pair: the small value for controls (buttons, inputs, rows), the large one for surfaces (cards, panels, the window). The pair matters more than either number."
  >
    <div className="grid gap-6 lg:grid-cols-3">
      {RADIUS.map((option) => (
        <div key={option.key} className="flex flex-col gap-3">
          <OptionHeader label={option.label} note={option.note} />
          <Frame
            tokens={WARMTH[0]?.light}
            radiusControl={option.control}
            radiusSurface={option.surface}
            className="ring-1 ring-border"
          >
            <SampleCard />
            <SampleInput />
            <SampleRows />
          </Frame>
        </div>
      ))}
    </div>
  </Section>
);

const GlassSection = () => (
  <Section
    title="4. Glass"
    question="A translucent surface over a busy backdrop (on the desktop this is the wallpaper through the window). The question is how much of the backdrop should be allowed to lead."
  >
    <div className="grid gap-6 lg:grid-cols-3">
      {GLASS.map((option) => (
        <div key={option.key} className="flex flex-col gap-3">
          <OptionHeader label={option.label} note={option.note} />
          <div
            className="relative overflow-hidden rounded-[14px] p-5"
            style={{
              background:
                "radial-gradient(120% 80% at 20% 10%, oklch(0.78 0.12 60) 0%, transparent 55%), radial-gradient(90% 70% at 85% 80%, oklch(0.7 0.1 150) 0%, transparent 55%), radial-gradient(70% 60% at 60% 40%, oklch(0.85 0.06 90) 0%, transparent 60%), oklch(0.93 0.02 80)",
            }}
          >
            <div
              className={cn("flex flex-col gap-3 p-4 text-foreground")}
              style={
                {
                  borderRadius: "14px",
                  background: `color-mix(in oklab, var(--card) ${option.opacity * 100}%, transparent)`,
                  backdropFilter: `blur(${option.blur}px) saturate(1.3)`,
                  WebkitBackdropFilter: `blur(${option.blur}px) saturate(1.3)`,
                  boxShadow:
                    "inset 0 0 0 1px color-mix(in oklab, var(--foreground) 8%, transparent), 0 1px 2px rgb(0 0 0 / 0.05)",
                  "--r-control": "8px",
                } as React.CSSProperties
              }
            >
              <span className="font-content text-[15px] font-medium">
                Saturday 22 August
              </span>
              <p className="text-[13px] text-muted-foreground">
                110 due, 45 new. Besides method pointers, what else does a
                vtable store?
              </p>
              <div className="flex justify-end gap-2">
                <SampleButton variant="secondary">Flip</SampleButton>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </Section>
);

// Round one of the foundations: the four decisions the rest of the system
// derives from. Everything here is a candidate until DESIGN.md says otherwise.
export const Foundations = () => (
  <div className="flex flex-col gap-16">
    <header className="flex flex-col gap-2">
      <p className="max-w-prose text-sm text-muted-foreground">
        The candidate rounds the foundations were chosen from, kept for
        reference. Decided: Whisper, Ceremonial matcha, Pillowy, Frost, Compact
        type, hairline and shadow, tight rows.
      </p>
    </header>
    <RoundFour />
    <div className="h-px bg-border" />
    <RoundThree />
    <div className="h-px bg-border" />
    <RoundTwo />
    <div className="h-px bg-border" />
    <p className="text-small font-medium text-muted-foreground">
      Round 1 (decided: A, matcha, C, A)
    </p>
    <WarmthSection />
    <AccentSection />
    <RadiusSection />
    <GlassSection />
  </div>
);
