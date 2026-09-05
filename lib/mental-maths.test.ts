import { describe, expect, it } from "bun:test";

import {
  type Attempt,
  formatClock,
  generateProblem,
  type Operation,
  summarizeRun,
} from "@/lib/mental-maths";

const digitCount = (value: number) => String(value).length;

const only = (operation: Operation, digits: number) => ({
  digits,
  operations: [operation],
  durationSeconds: 60 as const,
});

describe("generateProblem", () => {
  it("uses operands with exactly the requested digits", () => {
    for (const digits of [1, 2, 3, 4]) {
      for (let i = 0; i < 50; i++) {
        const problem = generateProblem(only("addition", digits));
        expect(digitCount(problem.left)).toBe(digits);
        expect(digitCount(problem.right)).toBe(digits);
        expect(problem.answer).toBe(problem.left + problem.right);
      }
    }
  });

  it("keeps subtraction answers non-negative", () => {
    for (let i = 0; i < 200; i++) {
      const problem = generateProblem(only("subtraction", 2));
      expect(problem.answer).toBeGreaterThanOrEqual(0);
      expect(problem.left - problem.right).toBe(problem.answer);
    }
  });

  it("builds division that divides exactly from digit-sized parts", () => {
    for (let i = 0; i < 200; i++) {
      const problem = generateProblem(only("division", 2));
      expect(problem.left % problem.right).toBe(0);
      expect(problem.left / problem.right).toBe(problem.answer);
      expect(digitCount(problem.right)).toBe(2);
      expect(digitCount(problem.answer)).toBe(2);
    }
  });

  it("only draws from the chosen operations", () => {
    for (let i = 0; i < 100; i++) {
      const problem = generateProblem({
        digits: 1,
        operations: ["multiplication", "division"],
        durationSeconds: 30,
      });
      expect(["multiplication", "division"]).toContain(problem.operation);
    }
  });
});

describe("summarizeRun", () => {
  const attempt = (
    operation: Operation,
    correct: boolean,
    ms: number,
  ): Attempt => ({
    problem: { operation, left: 2, right: 3, answer: 5 },
    correct,
    ms,
  });

  it("is all zeros for an empty run", () => {
    const summary = summarizeRun([]);
    expect(summary.attempts).toBe(0);
    expect(summary.accuracy).toBe(0);
    expect(summary.averageMs).toBe(0);
    expect(summary.fastestMs).toBeNull();
    expect(summary.byOperation).toEqual([]);
  });

  it("aggregates totals, per-operation rows, and misses", () => {
    const summary = summarizeRun([
      attempt("addition", true, 1000),
      attempt("addition", false, 3000),
      attempt("division", true, 2000),
    ]);
    expect(summary.attempts).toBe(3);
    expect(summary.correct).toBe(2);
    expect(summary.accuracy).toBeCloseTo(2 / 3);
    expect(summary.averageMs).toBe(2000);
    expect(summary.fastestMs).toBe(1000);
    expect(summary.byOperation).toEqual([
      { operation: "addition", attempts: 2, correct: 1, averageMs: 2000 },
      { operation: "division", attempts: 1, correct: 1, averageMs: 2000 },
    ]);
    expect(summary.misses).toHaveLength(1);
  });
});

describe("formatClock", () => {
  it("renders m:ss, rounding partial seconds up", () => {
    expect(formatClock(60)).toBe("1:00");
    expect(formatClock(59.2)).toBe("1:00");
    expect(formatClock(5)).toBe("0:05");
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(-1)).toBe("0:00");
  });
});
