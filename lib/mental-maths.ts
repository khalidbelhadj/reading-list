// Mental maths drills: the problem generator and the shape of a run. Pure
// and client-only — a run lives in component state and is gone when the pane
// closes; nothing here touches the server.

export const OPERATIONS = [
  "addition",
  "subtraction",
  "multiplication",
  "division",
] as const;

export type Operation = (typeof OPERATIONS)[number];

export const OPERATION_LABEL: Record<Operation, string> = {
  addition: "Addition",
  subtraction: "Subtraction",
  multiplication: "Multiplication",
  division: "Division",
};

// The glyph between the operands. Real minus (U+2212) and multiplication
// signs, not the ASCII stand-ins.
export const OPERATION_SYMBOL: Record<Operation, string> = {
  addition: "+",
  subtraction: "−",
  multiplication: "×",
  division: "÷",
};

export const DURATIONS = [30, 60, 120, 300] as const;
export type Duration = (typeof DURATIONS)[number];

export type MathsSettings = {
  // Digits per operand, 1–4.
  digits: number;
  operations: Operation[];
  durationSeconds: Duration;
};

export const DEFAULT_SETTINGS: MathsSettings = {
  digits: 2,
  operations: ["addition", "subtraction", "multiplication", "division"],
  durationSeconds: 60,
};

export type Problem = {
  operation: Operation;
  left: number;
  right: number;
  answer: number;
};

// One graded problem in a run: the player reveals the answer, then says
// whether they had it.
export type Attempt = {
  problem: Problem;
  correct: boolean;
  // Thinking time: from the problem appearing to the reveal.
  ms: number;
};

const randomInt = (min: number, max: number) =>
  min + Math.floor(Math.random() * (max - min + 1));

// An operand with exactly `digits` digits (no leading zero, never zero).
const randomOperand = (digits: number) =>
  randomInt(10 ** (digits - 1), 10 ** digits - 1);

export const formatProblem = (problem: Problem) =>
  `${problem.left} ${OPERATION_SYMBOL[problem.operation]} ${problem.right}`;

export const generateProblem = (settings: MathsSettings): Problem => {
  const digits = Math.min(4, Math.max(1, settings.digits));
  const pool = settings.operations.length
    ? settings.operations
    : DEFAULT_SETTINGS.operations;
  const operation = pool[randomInt(0, pool.length - 1)] ?? "addition";
  const a = randomOperand(digits);
  const b = randomOperand(digits);
  switch (operation) {
    case "addition":
      return { operation, left: a, right: b, answer: a + b };
    case "subtraction": {
      // Bigger first: answers stay non-negative, so typing is digits only.
      const [left, right] = a >= b ? [a, b] : [b, a];
      return { operation, left, right, answer: left - right };
    }
    case "multiplication":
      return { operation, left: a, right: b, answer: a * b };
    case "division":
      // Built backwards from a whole quotient, so it always divides exactly.
      return { operation, left: a * b, right: b, answer: a };
  }
};

export type RunSummary = {
  attempts: number;
  correct: number;
  // 0–1; 0 when nothing was attempted.
  accuracy: number;
  // Mean time per attempt in ms; 0 when nothing was attempted.
  averageMs: number;
  // Fastest correct answer in ms; null when none.
  fastestMs: number | null;
  byOperation: Array<{
    operation: Operation;
    attempts: number;
    correct: number;
    averageMs: number;
  }>;
  misses: Attempt[];
};

export const summarizeRun = (attempts: Attempt[]): RunSummary => {
  const correct = attempts.filter((attempt) => attempt.correct);
  const totalMs = attempts.reduce((sum, attempt) => sum + attempt.ms, 0);
  const byOperation = OPERATIONS.map((operation) => {
    const own = attempts.filter(
      (attempt) => attempt.problem.operation === operation,
    );
    const ownMs = own.reduce((sum, attempt) => sum + attempt.ms, 0);
    return {
      operation,
      attempts: own.length,
      correct: own.filter((attempt) => attempt.correct).length,
      averageMs: own.length ? ownMs / own.length : 0,
    };
  }).filter((row) => row.attempts > 0);
  return {
    attempts: attempts.length,
    correct: correct.length,
    accuracy: attempts.length ? correct.length / attempts.length : 0,
    averageMs: attempts.length ? totalMs / attempts.length : 0,
    fastestMs: correct.length
      ? Math.min(...correct.map((attempt) => attempt.ms))
      : null,
    byOperation,
    misses: attempts.filter((attempt) => !attempt.correct),
  };
};

// One finished run, as kept for the history behind a configuration.
export type RunRecord = {
  // ISO timestamp of when the run ended.
  at: string;
  settings: MathsSettings;
  solved: number;
  attempts: number;
  averageMs: number;
};

export const sameSettings = (a: MathsSettings, b: MathsSettings) =>
  a.digits === b.digits &&
  a.durationSeconds === b.durationSeconds &&
  a.operations.length === b.operations.length &&
  a.operations.every((operation) => b.operations.includes(operation));

export const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

export const formatClock = (totalSeconds: number) => {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
};
