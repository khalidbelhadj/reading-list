import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  IconArrowUp,
  IconCommand,
  IconCornerDownLeft,
  IconOption,
} from "@tabler/icons-react";

const Section = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <section className="flex flex-col gap-3">
    <div className="flex flex-col gap-0.5">
      <h2 className="font-content text-sm">{title}</h2>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-card p-4">
      {children}
    </div>
  </section>
);

const Row = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex w-full items-center justify-between gap-4">
    <span className="text-xs text-muted-foreground">{label}</span>
    <div className="flex items-center gap-2">{children}</div>
  </div>
);

const baseKbd =
  "pointer-events-none inline-flex items-center justify-center gap-1 font-sans font-medium select-none [&_svg:not([class*='size-'])]:size-3";

const KbdMuted = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <kbd
    className={cn(
      baseKbd,
      "h-5 min-w-5 rounded-xs bg-muted px-1 text-[0.625rem] text-muted-foreground",
      className,
    )}
  >
    {children}
  </kbd>
);

const KbdOutline = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <kbd
    className={cn(
      baseKbd,
      "h-5 min-w-5 rounded-xs border border-border bg-transparent px-1 text-[0.625rem] text-muted-foreground",
      className,
    )}
  >
    {children}
  </kbd>
);

const KbdRaised = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <kbd
    className={cn(
      baseKbd,
      "h-5 min-w-5 rounded-sm border border-border bg-background px-1.5 text-[0.625rem] text-foreground shadow-[0_1px_0_0_var(--border)]",
      className,
    )}
  >
    {children}
  </kbd>
);

const KbdSolid = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <kbd
    className={cn(
      baseKbd,
      "h-5 min-w-5 rounded-xs bg-foreground px-1 text-[0.625rem] text-background",
      className,
    )}
  >
    {children}
  </kbd>
);

const KbdGhost = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <kbd
    className={cn(
      baseKbd,
      "h-5 min-w-5 px-1 font-mono text-[0.625rem] text-muted-foreground",
      className,
    )}
  >
    {children}
  </kbd>
);

const KbdPill = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <kbd
    className={cn(
      baseKbd,
      "h-5 min-w-5 rounded-full bg-muted px-2 text-[0.625rem] text-muted-foreground",
      className,
    )}
  >
    {children}
  </kbd>
);

const KbdMono = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <kbd
    className={cn(
      baseKbd,
      "h-5 min-w-5 rounded-xs bg-muted px-1 font-mono text-[0.625rem] text-muted-foreground",
      className,
    )}
  >
    {children}
  </kbd>
);

const xsKbd =
  "h-4 min-w-4 px-1 text-[0.5625rem] [&_svg:not([class*='size-'])]:size-2.5";

const sizes = [
  {
    label: "xs",
    cls: "h-4 min-w-4 px-1 text-[0.5625rem] [&_svg:not([class*='size-'])]:size-2.5",
  },
  { label: "sm (default)", cls: "h-5 min-w-5 px-1 text-[0.625rem]" },
  { label: "md", cls: "h-6 min-w-6 px-1.5 text-xs" },
  {
    label: "lg",
    cls: "h-7 min-w-7 px-2 text-sm [&_svg:not([class*='size-'])]:size-3.5",
  },
];

const KbdDebugPage = () => {
  return (
    <div className="min-h-dvh px-5 py-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-10">
        <header className="flex flex-col gap-1">
          <h1 className="font-content text-lg">Kbd styles</h1>
          <p className="text-sm text-muted-foreground">
            Variants, sizes, and groupings for the keyboard-shortcut component.
          </p>
        </header>

        <Section
          title="Current default"
          description="Components/ui/kbd.tsx, muted bg, rounded-xs."
        >
          <Kbd>K</Kbd>
          <Kbd>Esc</Kbd>
          <Kbd>Space</Kbd>
          <KbdGroup>
            <Kbd>
              <IconCommand />
            </Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </Section>

        <Section
          title="Primary variant on primary button"
          description="Kbd variant=primary tuned for bg-primary surfaces."
        >
          <Button>
            Open
            <Kbd variant="primary">K</Kbd>
          </Button>
          <Button>
            Submit
            <KbdGroup>
              <Kbd variant="primary">
                <IconCommand />
              </Kbd>
              <Kbd variant="primary">
                <IconCornerDownLeft />
              </Kbd>
            </KbdGroup>
          </Button>
          <Button>
            Default Kbd for comparison
            <Kbd>K</Kbd>
          </Button>
        </Section>

        <Section
          title="Destructive variant on destructive button"
          description="Kbd variant=destructive tuned for bg-destructive surfaces."
        >
          <Button variant="destructive">
            Delete
            <Kbd variant="destructive">D</Kbd>
          </Button>
          <Button variant="destructive">
            Again
            <Kbd variant="destructive" size="xs">
              1
            </Kbd>
          </Button>
          <Button variant="destructive">
            Default Kbd for comparison
            <Kbd>D</Kbd>
          </Button>
        </Section>

        <Section title="Variants" description="Same size, different surfaces.">
          <div className="flex w-full flex-col gap-3">
            <Row label="muted">
              <KbdMuted>K</KbdMuted>
              <KbdMuted>Esc</KbdMuted>
              <KbdMuted>
                <IconCommand />
              </KbdMuted>
            </Row>
            <Row label="outline">
              <KbdOutline>K</KbdOutline>
              <KbdOutline>Esc</KbdOutline>
              <KbdOutline>
                <IconCommand />
              </KbdOutline>
            </Row>
            <Row label="raised">
              <KbdRaised>K</KbdRaised>
              <KbdRaised>Esc</KbdRaised>
              <KbdRaised>
                <IconCommand />
              </KbdRaised>
            </Row>
            <Row label="solid">
              <KbdSolid>K</KbdSolid>
              <KbdSolid>Esc</KbdSolid>
              <KbdSolid>
                <IconCommand />
              </KbdSolid>
            </Row>
            <Row label="pill">
              <KbdPill>K</KbdPill>
              <KbdPill>Esc</KbdPill>
              <KbdPill>
                <IconCommand />
              </KbdPill>
            </Row>
            <Row label="mono">
              <KbdMono>K</KbdMono>
              <KbdMono>Esc</KbdMono>
              <KbdMono>⌘</KbdMono>
            </Row>
            <Row label="ghost">
              <KbdGhost>K</KbdGhost>
              <KbdGhost>Esc</KbdGhost>
              <KbdGhost>⌘</KbdGhost>
            </Row>
            <Row label="primary">
              <div className="flex items-center gap-2 rounded-sm bg-primary px-2 py-1">
                <Kbd variant="primary">K</Kbd>
                <Kbd variant="primary">Esc</Kbd>
                <Kbd variant="primary">
                  <IconCommand />
                </Kbd>
              </div>
            </Row>
            <Row label="destructive">
              <div className="flex items-center gap-2 rounded-sm bg-destructive/10 px-2 py-1 dark:bg-destructive/20">
                <Kbd variant="destructive">K</Kbd>
                <Kbd variant="destructive">Esc</Kbd>
                <Kbd variant="destructive">
                  <IconCommand />
                </Kbd>
              </div>
            </Row>
          </div>
        </Section>

        <Section
          title="Sizes"
          description="Applied to the muted variant for reference."
        >
          <div className="flex w-full flex-col gap-3">
            {sizes.map(({ label, cls }) => (
              <Row key={label} label={label}>
                <KbdMuted className={cls}>K</KbdMuted>
                <KbdMuted className={cls}>Esc</KbdMuted>
                <KbdMuted className={cls}>
                  <IconCommand />
                </KbdMuted>
                <div className="flex items-center gap-2 rounded-sm bg-primary px-2 py-1">
                  <Kbd variant="primary" className={cls}>
                    K
                  </Kbd>
                  <Kbd variant="primary" className={cls}>
                    Esc
                  </Kbd>
                  <Kbd variant="primary" className={cls}>
                    <IconCommand />
                  </Kbd>
                </div>
              </Row>
            ))}
          </div>
        </Section>

        <Section
          title="Chords"
          description="KbdGroup with a separator slot between keys."
        >
          <div className="flex w-full flex-col gap-3">
            <Row label="muted + plus">
              <KbdGroup>
                <KbdMuted>
                  <IconCommand />
                </KbdMuted>
                <span className="text-xs text-muted-foreground">+</span>
                <KbdMuted>
                  <IconArrowUp />
                </KbdMuted>
                <span className="text-xs text-muted-foreground">+</span>
                <KbdMuted>K</KbdMuted>
              </KbdGroup>
            </Row>
            <Row label="raised + tight">
              <KbdGroup>
                <KbdRaised>
                  <IconCommand />
                </KbdRaised>
                <KbdRaised>
                  <IconOption />
                </KbdRaised>
                <KbdRaised>
                  <IconCornerDownLeft />
                </KbdRaised>
              </KbdGroup>
            </Row>
            <Row label="ghost + then">
              <KbdGroup>
                <KbdGhost>g</KbdGhost>
                <span className="text-[0.625rem] text-muted-foreground">
                  then
                </span>
                <KbdGhost>i</KbdGhost>
              </KbdGroup>
            </Row>
            <Row label="primary + plus">
              <div className="flex items-center gap-2 rounded-sm bg-primary px-2 py-1">
                <KbdGroup>
                  <Kbd variant="primary">
                    <IconCommand />
                  </Kbd>
                  <span className="text-xs text-primary-foreground/70">+</span>
                  <Kbd variant="primary">
                    <IconArrowUp />
                  </Kbd>
                  <span className="text-xs text-primary-foreground/70">+</span>
                  <Kbd variant="primary">K</Kbd>
                </KbdGroup>
              </div>
            </Row>
          </div>
        </Section>

        <Section
          title="Inside buttons"
          description="xs-sized Kbds as trailing shortcut hints, across every button variant."
        >
          <div className="flex w-full flex-col gap-4">
            {[
              { label: "default", variant: "default" as const },
              { label: "outline", variant: "outline" as const },
              { label: "secondary", variant: "secondary" as const },
              { label: "ghost", variant: "ghost" as const },
              { label: "destructive", variant: "destructive" as const },
            ].map(({ label, variant }) => (
              <Row key={label} label={label}>
                <Button variant={variant}>
                  Primary
                  <Kbd variant="primary" className={xsKbd}>
                    K
                  </Kbd>
                </Button>
                <Button variant={variant}>
                  Destruct
                  <Kbd variant="destructive" className={xsKbd}>
                    K
                  </Kbd>
                </Button>
                <Button variant={variant}>
                  Muted
                  <KbdMuted className={xsKbd}>K</KbdMuted>
                </Button>
                <Button variant={variant}>
                  Outline
                  <KbdOutline className={xsKbd}>K</KbdOutline>
                </Button>
                <Button variant={variant}>
                  Raised
                  <KbdRaised className={xsKbd}>K</KbdRaised>
                </Button>
                <Button variant={variant}>
                  Solid
                  <KbdSolid className={xsKbd}>K</KbdSolid>
                </Button>
                <Button variant={variant}>
                  Pill
                  <KbdPill className={xsKbd}>K</KbdPill>
                </Button>
                <Button variant={variant}>
                  Mono
                  <KbdMono className={xsKbd}>⌘</KbdMono>
                </Button>
                <Button variant={variant}>
                  Ghost
                  <KbdGhost className={xsKbd}>K</KbdGhost>
                </Button>
              </Row>
            ))}
            <Row label="chord">
              <Button>
                Open
                <KbdGroup>
                  <Kbd variant="primary" className={xsKbd}>
                    <IconCommand />
                  </Kbd>
                  <Kbd variant="primary" className={xsKbd}>
                    K
                  </Kbd>
                </KbdGroup>
              </Button>
              <Button variant="outline">
                Search
                <KbdGroup>
                  <KbdMuted className={xsKbd}>
                    <IconCommand />
                  </KbdMuted>
                  <KbdMuted className={xsKbd}>F</KbdMuted>
                </KbdGroup>
              </Button>
              <Button variant="ghost">
                Submit
                <KbdGroup>
                  <KbdGhost className={xsKbd}>⌘</KbdGhost>
                  <KbdGhost className={xsKbd}>⏎</KbdGhost>
                </KbdGroup>
              </Button>
            </Row>
          </div>
        </Section>

        <Section
          title="In context"
          description="Inline with body text, like a real shortcut hint."
        >
          <div className="flex w-full flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Press <KbdMuted>?</KbdMuted> to show shortcuts. Use{" "}
              <KbdGroup>
                <KbdMuted>
                  <IconCommand />
                </KbdMuted>
                <KbdMuted>K</KbdMuted>
              </KbdGroup>{" "}
              to open the command menu, or <KbdMuted>Esc</KbdMuted> to dismiss.
            </p>
            <p className="rounded-sm bg-primary px-3 py-2 text-sm text-primary-foreground/90">
              Press <Kbd variant="primary">?</Kbd> to show shortcuts. Use{" "}
              <KbdGroup>
                <Kbd variant="primary">
                  <IconCommand />
                </Kbd>
                <Kbd variant="primary">K</Kbd>
              </KbdGroup>{" "}
              to open the command menu, or <Kbd variant="primary">Esc</Kbd> to
              dismiss.
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
};

export default KbdDebugPage;
