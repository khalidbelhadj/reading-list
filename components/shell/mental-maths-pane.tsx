import React from "react";

import { Button } from "@/components/system/button";
import { ButtonGroup } from "@/components/system/button-group";
import { Kbd } from "@/components/system/kbd";
import { TextLink } from "@/components/system/link";
import {
  type Attempt,
  DEFAULT_SETTINGS,
  formatClock,
  generateProblem,
  type MathsSettings,
  OPERATION_SYMBOL,
  type Problem,
  type RunRecord,
} from "@/lib/mental-maths";
import { MATHS_RUNS_LIMIT } from "@/lib/settings";
import {
  playCardRated,
  playCardRevealed,
  playQueueFinished,
  playStackStarted,
} from "@/lib/sounds";
import { useSettings } from "@/lib/use-settings";
import { cn } from "@/lib/utils";

import { MentalMathsSetup } from "./mental-maths-setup";
import { MentalMathsSummary } from "./mental-maths-summary";

type Phase =
  | { kind: "setup" }
  | { kind: "running"; endsAt: number }
  | { kind: "done"; early: boolean };

// Seconds left on the clock, ticking on an interval (not rAF: the pane keeps
// counting in a hidden window, and the run must end on time either way).
const useCountdown = (endsAt: number | null, onEnd: () => void) => {
  const [remaining, setRemaining] = React.useState(0);
  const onEndRef = React.useRef(onEnd);
  React.useEffect(() => {
    onEndRef.current = onEnd;
  });
  React.useEffect(() => {
    if (endsAt === null) return;
    const tick = () => {
      const left = (endsAt - Date.now()) / 1000;
      setRemaining(left);
      if (left <= 0) {
        window.clearInterval(interval);
        onEndRef.current();
      }
    };
    const interval = window.setInterval(tick, 100);
    tick();
    return () => window.clearInterval(interval);
  }, [endsAt]);
  return remaining;
};

// The expression on stage, written out as an equation. The answer's slot
// holds a question mark until the reveal; clicking it reveals too.
const ProblemStage = ({
  problem,
  revealed,
  onReveal,
}: {
  problem: Problem;
  revealed: boolean;
  onReveal: () => void;
}) => (
  <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center">
    <div className="flex items-baseline gap-3 font-content text-display font-medium tabular-nums select-none">
      <span>{problem.left}</span>
      <span className="text-muted-foreground">
        {OPERATION_SYMBOL[problem.operation]}
      </span>
      <span>{problem.right}</span>
      <span className="text-muted-foreground">=</span>
      {revealed ? (
        <span>{problem.answer}</span>
      ) : (
        <span
          role="button"
          aria-label="Show answer"
          onClick={onReveal}
          className="cursor-pointer text-muted-foreground/40 hover:text-muted-foreground"
        >
          ?
        </span>
      )}
    </div>
  </div>
);

// The two grades, anchored at the bottom like Review's ratings. Renders its
// empty height before the reveal so the card doesn't jump.
const GradeControls = ({
  revealed,
  onGrade,
}: {
  revealed: boolean;
  onGrade: (correct: boolean) => void;
}) => (
  <div className="flex min-h-9 flex-col items-center justify-end gap-2">
    {revealed ? (
      <ButtonGroup>
        <Button variant="secondary" onClick={() => onGrade(false)}>
          Missed
          <Kbd className="ml-0.5">1</Kbd>
        </Button>
        <Button variant="secondary" onClick={() => onGrade(true)}>
          Got it
          <Kbd className="ml-0.5">2</Kbd>
        </Button>
      </ButtonGroup>
    ) : (
      <span className="flex items-center gap-1.5 text-small text-muted-foreground select-none">
        <Kbd>Space</Kbd> reveals the answer
      </span>
    )}
  </div>
);

// Mental maths, flashcard style: pick operations, digits and a clock, then
// work each expression out in your head, reveal the answer, and say whether
// you had it. Space reveals, 1 and 2 grade, Escape (or End, top right) stops
// early. A run that goes the distance is kept (in the settings blob) as the
// history behind its configuration; an early end is not, so runs compare
// like for like.
export const MentalMathsPane = () => {
  const { settings: userSettings, setSetting } = useSettings();
  const [settings, setSettings] =
    React.useState<MathsSettings>(DEFAULT_SETTINGS);
  const [phase, setPhase] = React.useState<Phase>({ kind: "setup" });
  const [problem, setProblem] = React.useState<Problem | null>(null);
  const [revealed, setRevealed] = React.useState(false);
  const [attempts, setAttempts] = React.useState<Attempt[]>([]);
  const shownAtRef = React.useRef(0);
  const thinkingMsRef = React.useRef(0);

  const nextProblem = React.useCallback(() => {
    setProblem(generateProblem(settings));
    setRevealed(false);
    shownAtRef.current = Date.now();
  }, [settings]);

  const start = React.useCallback(() => {
    playStackStarted();
    setAttempts([]);
    setPhase({
      kind: "running",
      endsAt: Date.now() + settings.durationSeconds * 1000,
    });
    nextProblem();
  }, [settings.durationSeconds, nextProblem]);

  const attemptsRef = React.useRef(attempts);
  attemptsRef.current = attempts;
  const finish = React.useCallback(
    (early: boolean) => {
      playQueueFinished();
      setPhase({ kind: "done", early });
      setProblem(null);
      const finished = attemptsRef.current;
      if (early || finished.length === 0) return;
      const record: RunRecord = {
        at: new Date().toISOString(),
        settings,
        solved: finished.filter((attempt) => attempt.correct).length,
        attempts: finished.length,
        averageMs:
          finished.reduce((sum, attempt) => sum + attempt.ms, 0) /
          finished.length,
      };
      setSetting("mathsRuns", (previous) =>
        [...previous, record].slice(-MATHS_RUNS_LIMIT),
      );
    },
    [settings, setSetting],
  );
  const timeUp = React.useCallback(() => finish(false), [finish]);
  const endEarly = React.useCallback(() => finish(true), [finish]);

  const backToSetup = React.useCallback(() => setPhase({ kind: "setup" }), []);

  const remaining = useCountdown(
    phase.kind === "running" ? phase.endsAt : null,
    timeUp,
  );

  // The reveal is the moment the thinking stops; that is the time recorded.
  const reveal = React.useCallback(() => {
    if (revealed) return;
    thinkingMsRef.current = Date.now() - shownAtRef.current;
    playCardRevealed();
    setRevealed(true);
  }, [revealed]);

  const grade = React.useCallback(
    (correct: boolean) => {
      if (!problem || !revealed) return;
      setAttempts((current) => [
        ...current,
        { problem, correct, ms: thinkingMsRef.current },
      ]);
      playCardRated(correct ? "good" : "again");
      nextProblem();
    },
    [problem, revealed, nextProblem],
  );

  // Space reveals; 1 and 2 grade once revealed; Escape ends the run early.
  React.useEffect(() => {
    if (phase.kind !== "running" || !problem) return;
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "Escape") {
        event.preventDefault();
        endEarly();
      } else if (event.key === " ") {
        event.preventDefault();
        reveal();
      } else if (revealed && event.key === "1") {
        event.preventDefault();
        grade(false);
      } else if (revealed && event.key === "2") {
        event.preventDefault();
        grade(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase.kind, problem, revealed, reveal, grade, endEarly]);

  const solved = attempts.filter((attempt) => attempt.correct).length;

  return (
    <div className="relative flex h-full w-full flex-col px-12 pt-12 pb-6">
      {phase.kind === "running" && (
        <div className="app-no-drag absolute top-3 left-(--pane-start) z-20 flex h-7 items-center gap-3 text-small text-muted-foreground select-none">
          <span
            className={cn(
              "font-medium tabular-nums",
              remaining <= 5 && "text-foreground",
            )}
          >
            {formatClock(remaining)}
          </span>
          <span className="tabular-nums">
            {solved} of {attempts.length}
          </span>
        </div>
      )}
      {phase.kind === "running" && (
        <TextLink
          variant="quiet"
          href="#"
          className="app-no-drag absolute top-4 right-4 z-20 flex items-center gap-1.5 text-micro font-medium select-none"
          onClick={(event) => {
            event.preventDefault();
            endEarly();
          }}
        >
          End
          <Kbd>Esc</Kbd>
        </TextLink>
      )}

      {phase.kind === "setup" && (
        <MentalMathsSetup
          settings={settings}
          runs={userSettings.mathsRuns}
          onSettingsChange={setSettings}
          onStart={start}
        />
      )}
      {phase.kind === "running" && problem && (
        <>
          <ProblemStage
            problem={problem}
            revealed={revealed}
            onReveal={reveal}
          />
          <GradeControls revealed={revealed} onGrade={grade} />
        </>
      )}
      {phase.kind === "done" && (
        <MentalMathsSummary
          attempts={attempts}
          endedEarly={phase.early}
          onAgain={start}
          onChangeSettings={backToSetup}
        />
      )}
    </div>
  );
};
