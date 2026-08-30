import type React from "react";

import { cn } from "@/lib/utils";

import { WARMTH } from "./options";
import { DENSITY, EDGE, MATCHA, TYPE } from "./options-round-two";
import { slug } from "./outline";
import { Frame, SampleButton, SampleRows } from "./previews";

const CHOSEN = {
  tokens: WARMTH[0],
  radiusControl: "10px",
  radiusSurface: "20px",
};

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

const AccentSample = () => (
  <div className="flex flex-col gap-3">
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full w-2/3 bg-primary" />
    </div>
    <div className="flex gap-2">
      <SampleButton variant="primary">Review 110</SampleButton>
      <SampleButton variant="secondary">Flip</SampleButton>
    </div>
    <div className="flex items-center gap-2 text-[13px]">
      <span className="size-3.5 rounded-[5px] bg-primary" />
      <span className="text-primary">Selected text and links</span>
    </div>
    <SampleRows />
  </div>
);

const MatchaSection = () => (
  <Section
    title="5. Matcha"
    question="Three cups of the same tea. Check the primary button in both modes, the progress bar, and whether the text colour on the button feels right."
  >
    <div className="grid gap-8">
      {MATCHA.map((option) => (
        <div key={option.key} className="flex flex-col gap-3">
          <OptionHeader label={option.label} note={option.note} />
          <div className="grid grid-cols-2 gap-2">
            <Frame
              tokens={{ ...CHOSEN.tokens?.light, ...option.light }}
              radiusControl={CHOSEN.radiusControl}
              radiusSurface={CHOSEN.radiusSurface}
            >
              <AccentSample />
            </Frame>
            <Frame
              tokens={{ ...CHOSEN.tokens?.dark, ...option.dark }}
              dark
              radiusControl={CHOSEN.radiusControl}
              radiusSurface={CHOSEN.radiusSurface}
            >
              <AccentSample />
            </Frame>
          </div>
        </div>
      ))}
    </div>
  </Section>
);

const TypeSection = () => (
  <Section
    title="6. Type scale"
    question="Five named sizes in DM Sans: small, body, title, heading, display. The body size decides how dense every list and panel feels."
  >
    <div className="grid gap-6 lg:grid-cols-3">
      {TYPE.map((scale) => (
        <div key={scale.key} className="flex flex-col gap-3">
          <OptionHeader label={scale.label} note={scale.note} />
          <Frame
            tokens={CHOSEN.tokens?.light}
            radiusControl={CHOSEN.radiusControl}
            radiusSurface={CHOSEN.radiusSurface}
            className="ring-1 ring-border"
          >
            <p
              className="font-content leading-none font-semibold tracking-tight"
              style={{ fontSize: scale.display }}
            >
              Saturday 22 August
            </p>
            <p
              className="font-content font-semibold"
              style={{ fontSize: scale.heading }}
            >
              Flashcards
            </p>
            <p
              className="font-content font-medium"
              style={{ fontSize: scale.title }}
            >
              Two Ways To Do Dynamic Dispatch
            </p>
            <p style={{ fontSize: scale.body }}>
              Besides method pointers, what else does a Rust trait
              object&rsquo;s vtable typically store? The body size carries
              notes, answers and rows.
            </p>
            <p
              className="text-muted-foreground"
              style={{ fontSize: scale.small }}
            >
              youtube.com, 2d ago, 110 due
            </p>
          </Frame>
        </div>
      ))}
    </div>
  </Section>
);

const EdgeSection = () => (
  <Section
    title="7. Surface edge"
    question="How an opaque surface (card, popover, dialog) separates from the page. The glass surfaces already carry a hairline; this is for everything else."
  >
    <div className="grid gap-6 lg:grid-cols-4">
      {EDGE.map((edge) => (
        <div key={edge.key} className="flex flex-col gap-3">
          <OptionHeader label={edge.label} note={edge.note} />
          <Frame
            tokens={CHOSEN.tokens?.light}
            radiusControl={CHOSEN.radiusControl}
            radiusSurface={CHOSEN.radiusSurface}
            className="ring-1 ring-border"
          >
            <div
              className="flex flex-col gap-2 bg-card p-4"
              style={{
                borderRadius: "var(--r-surface)",
                boxShadow: edge.shadow,
              }}
            >
              <span className="font-content text-[15px] font-medium">
                Review 110 cards?
              </span>
              <p className="text-[13px] text-muted-foreground">
                Runs in a new window. You can end the session at any time.
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <SampleButton variant="secondary">Not now</SampleButton>
                <SampleButton variant="primary">Start</SampleButton>
              </div>
            </div>
          </Frame>
        </div>
      ))}
    </div>
  </Section>
);

const DensitySection = () => (
  <Section
    title="8. Density"
    question="Row height for lists: the sidebar's recents, the flashcard list, the reading list itself. Body text is 13px in every sample so only the rhythm changes."
  >
    <div className="grid gap-6 lg:grid-cols-3">
      {DENSITY.map((density) => (
        <div key={density.key} className="flex flex-col gap-3">
          <OptionHeader label={density.label} note={density.note} />
          <Frame
            tokens={CHOSEN.tokens?.light}
            radiusControl={CHOSEN.radiusControl}
            radiusSurface={CHOSEN.radiusSurface}
            className="ring-1 ring-border"
          >
            <ul className="flex flex-col" style={{ gap: density.gap }}>
              {[
                "Linux Container Primitives: cgroups, namespaces",
                "How AWS's Firecracker virtual machines work",
                "Multicast, PIM-SM, and IGMP Snooping",
                "Lecture 1: IP Multicast Basics and Addressing",
                "Multicast and the Markets with Brian Nigito",
                "What Really Happened at the Minab School Strike?",
              ].map((title, index) => (
                <li
                  key={title}
                  className={cn(
                    "flex items-center gap-2 px-2 text-[13px]",
                    index === 1 ? "bg-foreground/[0.07]" : "text-foreground/85",
                  )}
                  style={{
                    height: density.row,
                    borderRadius: "var(--r-control)",
                  }}
                >
                  <span className="size-3.5 shrink-0 rounded-[4px] bg-primary/60" />
                  <span className="truncate">{title}</span>
                </li>
              ))}
            </ul>
          </Frame>
        </div>
      ))}
    </div>
  </Section>
);

export const RoundTwo = () => (
  <div className="flex flex-col gap-16">
    <header className="flex flex-col gap-2">
      <p className="text-small font-medium text-muted-foreground">Round 2</p>
      <p className="max-w-prose text-sm text-muted-foreground">
        Chosen so far: Whisper neutrals, Pillowy radius (10 / 20), Frost glass.
        The samples below already use them.
      </p>
    </header>
    <MatchaSection />
    <TypeSection />
    <EdgeSection />
    <DensitySection />
  </div>
);
