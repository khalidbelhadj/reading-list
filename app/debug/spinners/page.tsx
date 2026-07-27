import {
  IconBookmark,
  IconBookmarkFilled,
  IconCircleDashed,
  IconLoader,
  IconLoader2,
} from "@tabler/icons-react";
import React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const spinnerStyles = `
  @keyframes spinner-bar {
    0%, 100% { transform: scaleY(0.4); }
    50% { transform: scaleY(1); }
  }
  @keyframes spinner-dot-pulse {
    0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
    40% { opacity: 1; transform: scale(1); }
  }
  @keyframes spinner-bookmark-fill {
    0% { clip-path: inset(100% 0 0 0); }
    50% { clip-path: inset(0 0 0 0); }
    100% { clip-path: inset(0 0 100% 0); }
  }
  @keyframes spinner-sweep {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes spinner-page-flip {
    0%, 100% { transform: rotateY(0deg); }
    50% { transform: rotateY(180deg); }
  }
  @keyframes spinner-orbit {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes spinner-grow {
    0%, 100% { transform: scale(0.6); opacity: 0.4; }
    50% { transform: scale(1); opacity: 1; }
  }
`;

type SpinnerDef = {
  id: string;
  name: string;
  description: string;
  render: (size: "preview" | "button") => React.ReactNode;
};

const sizeFor = (s: "preview" | "button", preview: string, button: string) =>
  s === "preview" ? preview : button;

const SPINNERS: SpinnerDef[] = [
  {
    id: "loader",
    name: "Loader",
    description: "Original",
    render: (s) => (
      <IconLoader
        className={cn(sizeFor(s, "size-5", "size-3.5"), "animate-spin")}
      />
    ),
  },
  {
    id: "loader-2",
    name: "Loader 2",
    description: "Current default",
    render: (s) => (
      <IconLoader2
        className={cn(sizeFor(s, "size-5", "size-3.5"), "animate-spin")}
      />
    ),
  },
  {
    id: "dashed",
    name: "Dashed ring",
    description: "Slow, gentle",
    render: (s) => (
      <IconCircleDashed
        className={sizeFor(s, "size-5", "size-3.5")}
        style={{ animation: "spinner-orbit 3s linear infinite" }}
      />
    ),
  },
  {
    id: "three-dots",
    name: "Three dots",
    description: "Classic pulse",
    render: (s) => (
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              sizeFor(s, "size-1.5", "size-1"),
              "rounded-full bg-current",
            )}
            style={{
              animation: "spinner-dot-pulse 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </div>
    ),
  },
  {
    id: "sage-dots",
    name: "Sage dots",
    description: "On-theme pulse",
    render: (s) => (
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              sizeFor(s, "size-1.5", "size-1"),
              "rounded-full bg-primary",
            )}
            style={{
              animation: "spinner-dot-pulse 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </div>
    ),
  },
  {
    id: "bouncing-dots",
    name: "Bouncing dots",
    description: "Springy",
    render: (s) => (
      <div className="flex items-end gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              sizeFor(s, "size-1.5", "size-1"),
              "animate-bounce rounded-full bg-current",
            )}
            style={{ animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>
    ),
  },
  {
    id: "bar-wave",
    name: "Bar wave",
    description: "Sound-style",
    render: (s) => (
      <div
        className={cn(
          "flex items-center gap-0.5",
          s === "preview" ? "h-4" : "h-3",
        )}
      >
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="w-0.5 rounded-full bg-current"
            style={{
              height: "100%",
              transformOrigin: "center",
              animation: "spinner-bar 1s ease-in-out infinite",
              animationDelay: `${i * 0.12}s`,
            }}
          />
        ))}
      </div>
    ),
  },
  {
    id: "bookmark",
    name: "Bookmark fill",
    description: "App-themed",
    render: (s) => (
      <div className={cn("relative", sizeFor(s, "size-5", "size-3.5"))}>
        <IconBookmark className="absolute inset-0 size-full text-primary/40" />
        <IconBookmarkFilled
          className="absolute inset-0 size-full text-primary"
          style={{
            animation: "spinner-bookmark-fill 1.6s ease-in-out infinite",
          }}
        />
      </div>
    ),
  },
  {
    id: "conic-sweep",
    name: "Conic sweep",
    description: "Sage gradient",
    render: (s) => (
      <div
        className={cn("rounded-full", sizeFor(s, "size-5", "size-3.5"))}
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, var(--primary) 320deg)",
          mask: "radial-gradient(circle, transparent 55%, black 56%)",
          WebkitMask: "radial-gradient(circle, transparent 55%, black 56%)",
          animation: "spinner-sweep 0.9s linear infinite",
        }}
      />
    ),
  },
  {
    id: "pulse-dot",
    name: "Pulse dot",
    description: "Single ping",
    render: (s) => (
      <div className={cn("relative", sizeFor(s, "size-2", "size-1.5"))}>
        <span className="absolute inset-0 rounded-full bg-primary" />
        <span className="absolute inset-0 animate-ping rounded-full bg-primary" />
      </div>
    ),
  },
  {
    id: "orbit",
    name: "Orbit",
    description: "Dot circling",
    render: (s) => (
      <div
        className={cn("relative", sizeFor(s, "size-5", "size-3.5"))}
        style={{ animation: "spinner-orbit 1.1s linear infinite" }}
      >
        <span
          className={cn(
            "absolute top-0 left-1/2 -translate-x-1/2 rounded-full bg-primary",
            sizeFor(s, "size-1.5", "size-1"),
          )}
        />
      </div>
    ),
  },
  {
    id: "page-flip",
    name: "Page flip",
    description: "Reading metaphor",
    render: (s) => (
      <span
        className={cn(
          "block rounded-sm bg-primary",
          sizeFor(s, "size-4", "size-3"),
        )}
        style={{
          animation: "spinner-page-flip 1.4s ease-in-out infinite",
          transformStyle: "preserve-3d",
        }}
      />
    ),
  },
  {
    id: "grow-dot",
    name: "Grow dot",
    description: "Soft breathe",
    render: (s) => (
      <span
        className={cn(
          "block rounded-full bg-primary",
          sizeFor(s, "size-3", "size-2"),
        )}
        style={{ animation: "spinner-grow 1.4s ease-in-out infinite" }}
      />
    ),
  },
  {
    id: "trio-chase",
    name: "Trio chase",
    description: "Rotating triangle",
    render: (s) => (
      <div
        className={cn("relative", sizeFor(s, "size-5", "size-3.5"))}
        style={{ animation: "spinner-orbit 1.2s linear infinite" }}
      >
        {[0, 120, 240].map((deg, i) => (
          <span
            key={i}
            className={cn(
              "absolute top-1/2 left-1/2 -translate-x-1/2 rounded-full bg-primary",
              sizeFor(s, "size-1.5", "size-1"),
            )}
            style={{
              transform: `rotate(${deg}deg) translateY(${s === "preview" ? "-7px" : "-5px"})`,
              opacity: 0.35 + i * 0.3,
            }}
          />
        ))}
      </div>
    ),
  },
  {
    id: "square-corners",
    name: "Square corners",
    description: "Sharp loop",
    render: (s) => (
      <div
        className={cn(
          "grid grid-cols-2 gap-0.5",
          sizeFor(s, "size-4", "size-3"),
        )}
      >
        {[0, 1, 3, 2].map((i, idx) => (
          <span
            key={idx}
            className={cn(
              "rounded-[2px] bg-primary",
              sizeFor(s, "size-1.5", "size-1"),
            )}
            style={{
              animation: "spinner-dot-pulse 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
    ),
  },
];

const SpinnersPlayground = () => {
  const [selectedId, setSelectedId] = React.useState<string>("loader-2");
  const [loading, setLoading] = React.useState(false);

  const selected = SPINNERS.find((s) => s.id === selectedId) ?? SPINNERS[0];

  const handleDemo = React.useCallback(() => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  }, []);

  if (!selected) return null;

  return (
    <div className="min-h-dvh px-5 py-10">
      <style dangerouslySetInnerHTML={{ __html: spinnerStyles }} />
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-content text-xl">Loading spinners</h1>
          <p className="text-sm text-muted-foreground">
            Click a card to select, then try it on a button. Sage where it makes
            sense; muted-foreground for the rest.
          </p>
        </div>

        <div className="sticky top-0 z-10 -mx-5 flex items-center gap-3 bg-background px-5 py-3">
          <span className="text-xs text-muted-foreground">
            Selected: <span className="text-foreground">{selected.name}</span>
          </span>
          <Button size="sm" onClick={handleDemo} disabled={loading}>
            {loading ? selected.render("button") : null}
            {loading ? "Loading" : "Try it"}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {SPINNERS.map((spinner) => {
            const isSelected = spinner.id === selectedId;
            return (
              <button
                key={spinner.id}
                type="button"
                onClick={() => setSelectedId(spinner.id)}
                className={cn(
                  "flex flex-col items-center gap-3 rounded-lg p-6 text-left text-muted-foreground transition-colors",
                  isSelected ? "bg-secondary" : "bg-card hover:bg-card/70",
                )}
              >
                <div className="flex h-12 w-12 items-center justify-center">
                  {spinner.render("preview")}
                </div>
                <div className="flex flex-col items-center gap-0.5 text-center">
                  <span className="font-content text-sm text-foreground">
                    {spinner.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {spinner.description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const SpinnersPage = () => {
  return <SpinnersPlayground />;
};

export default SpinnersPage;
