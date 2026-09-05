import {
  IconCheck,
  IconDivide,
  IconMinus,
  IconPlus,
  IconX,
} from "@tabler/icons-react";
import React from "react";

import { MathsHistory } from "@/components/app/maths-history";
import { Button } from "@/components/system/button";
import { Field } from "@/components/system/field";
import { Kbd } from "@/components/system/kbd";
import { SegmentedControl } from "@/components/system/segmented-control";
import {
  type Duration,
  DURATIONS,
  type MathsSettings,
  type Operation,
  OPERATION_LABEL,
  OPERATIONS,
  type RunRecord,
  sameSettings,
} from "@/lib/mental-maths";
import { cn } from "@/lib/utils";

const OPERATION_ICON: Record<Operation, React.ReactNode> = {
  addition: <IconPlus />,
  subtraction: <IconMinus />,
  multiplication: <IconX />,
  division: <IconDivide />,
};

// A sample operand per digit count, so the tiles read as difficulty rather
// than as a number.
const DIGIT_SAMPLE = ["7", "48", "362", "5,914"];

const DURATION_LABEL: Record<Duration, string> = {
  30: "30s",
  60: "1 min",
  120: "2 min",
  300: "5 min",
};

const DURATION_OPTIONS = DURATIONS.map((seconds) => ({
  value: String(seconds),
  label: DURATION_LABEL[seconds],
}));

// A selectable tile: quiet at rest, filled when chosen, with a check in the
// corner for tiles that can stack (operations).
const Tile = ({
  selected,
  multi = false,
  onClick,
  className,
  children,
  "aria-label": ariaLabel,
}: {
  selected: boolean;
  multi?: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
}) => (
  <Button
    variant="ghost"
    aria-pressed={selected}
    aria-label={ariaLabel}
    onClick={onClick}
    className={cn(
      "relative h-auto flex-col items-center justify-center gap-2 rounded-surface bg-foreground/[0.03] px-3 py-4 whitespace-normal hover:bg-foreground/[0.06]",
      selected &&
        "bg-foreground/[0.08] text-foreground hover:bg-foreground/[0.1]",
      className,
    )}
  >
    {multi && selected && (
      <IconCheck className="absolute top-2 right-2 size-3 text-muted-foreground" />
    )}
    {children}
  </Button>
);

// The run's settings, then Start. Enter starts too, so a returning player
// never has to reach for the mouse.
export const MentalMathsSetup = ({
  settings,
  runs,
  onSettingsChange,
  onStart,
}: {
  settings: MathsSettings;
  // Every kept run; the ones matching the current settings show below.
  runs: RunRecord[];
  onSettingsChange: (settings: MathsSettings) => void;
  onStart: () => void;
}) => {
  const canStart = settings.operations.length > 0;
  const matchingRuns = React.useMemo(
    () => runs.filter((run) => sameSettings(run.settings, settings)),
    [runs, settings],
  );

  const toggleOperation = React.useCallback(
    (operation: Operation) => {
      const selected = settings.operations.includes(operation);
      const operations = selected
        ? settings.operations.filter((candidate) => candidate !== operation)
        : OPERATIONS.filter(
            (candidate) =>
              candidate === operation ||
              settings.operations.includes(candidate),
          );
      onSettingsChange({ ...settings, operations });
    },
    [settings, onSettingsChange],
  );

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || !canStart) return;
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
      }
      event.preventDefault();
      onStart();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canStart, onStart]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-7">
      <div className="flex flex-col gap-1">
        <h2 className="font-content text-heading font-medium">Mental maths</h2>
        <p className="text-body text-muted-foreground">
          One expression at a time. Work it out, reveal the answer, say whether
          you had it. The clock decides when you stop.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-small font-medium text-muted-foreground select-none">
          Operations
        </span>
        <div className="grid grid-cols-4 gap-2">
          {OPERATIONS.map((operation) => (
            <Tile
              key={operation}
              multi
              selected={settings.operations.includes(operation)}
              onClick={() => toggleOperation(operation)}
              className="[&_svg]:size-5"
            >
              {OPERATION_ICON[operation]}
              <span className="text-small font-medium">
                {OPERATION_LABEL[operation]}
              </span>
            </Tile>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-small font-medium text-muted-foreground select-none">
          Digits
        </span>
        <div className="grid grid-cols-4 gap-2">
          {DIGIT_SAMPLE.map((sample, index) => {
            const digits = index + 1;
            return (
              <Tile
                key={digits}
                selected={settings.digits === digits}
                onClick={() => onSettingsChange({ ...settings, digits })}
                aria-label={`${digits} digit${digits === 1 ? "" : "s"}`}
              >
                <span className="font-content text-title font-medium tabular-nums">
                  {sample}
                </span>
                <span className="text-small font-medium text-muted-foreground">
                  {digits} digit{digits === 1 ? "" : "s"}
                </span>
              </Tile>
            );
          })}
        </div>
      </div>

      <div className="flex items-end justify-between gap-6">
        <Field label="Duration">
          <SegmentedControl
            aria-label="Run length"
            value={String(settings.durationSeconds)}
            onValueChange={(value) =>
              onSettingsChange({
                ...settings,
                durationSeconds: Number(value) as Duration,
              })
            }
            options={DURATION_OPTIONS}
          />
        </Field>
        <Button variant="primary" disabled={!canStart} onClick={onStart}>
          Start
          <Kbd variant="on-primary" className="ml-0.5">
            ↵
          </Kbd>
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-small font-medium text-muted-foreground select-none">
          Previous runs with these settings
        </span>
        <MathsHistory runs={matchingRuns} />
      </div>
    </div>
  );
};
