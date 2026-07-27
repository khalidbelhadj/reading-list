export type Rating = "again" | "hard" | "good" | "easy";

const CARD_STATES = ["new", "learning", "review", "relearning"] as const;

export type CardState = (typeof CARD_STATES)[number];

export const parseCardState = (s: string): CardState => {
  if (CARD_STATES.includes(s as CardState)) return s as CardState;
  throw new Error(`Invalid card state: ${s}`);
};

export type SrsState = {
  state: CardState;
  interval: number;
  easeFactor: number;
  reps: number;
  lapses: number;
  due: string;
};

const LEARNING_STEP_MIN = 10;
const HARD_LEARNING_STEP_MIN = 15;
const GRADUATING_INTERVAL_DAYS = 1;
const EASY_INTERVAL_DAYS = 4;
const RELEARN_STEP_MIN = 10;
const MIN_EASE = 1.3;
const HARD_INTERVAL_MULT = 1.2;
const EASY_BONUS = 1.3;

const addMinutes = (iso: string, minutes: number) =>
  new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();

const addDays = (iso: string, days: number) =>
  new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();

const clampEase = (ease: number) => Math.max(MIN_EASE, ease);

// Graduation to "review" on good/easy is identical from the learning and
// relearning states: fixed interval, reps + 1, ease untouched.
const graduate = (
  prev: SrsState,
  rating: "good" | "easy",
  now: string,
): SrsState => {
  const interval =
    rating === "easy" ? EASY_INTERVAL_DAYS : GRADUATING_INTERVAL_DAYS;
  return {
    state: "review",
    interval,
    easeFactor: prev.easeFactor,
    reps: prev.reps + 1,
    lapses: prev.lapses,
    due: addDays(now, interval),
  };
};

export const schedule = (
  prev: SrsState,
  rating: Rating,
  now: string,
): SrsState => {
  const isGraduated = prev.state === "review";
  const isRelearning = prev.state === "relearning";

  if (!isGraduated && !isRelearning) {
    switch (rating) {
      case "again":
        return {
          state: "learning",
          interval: 0,
          easeFactor: prev.easeFactor,
          reps: 0,
          lapses: prev.lapses,
          due: addMinutes(now, LEARNING_STEP_MIN),
        };
      case "hard":
        return {
          state: "learning",
          interval: 0,
          easeFactor: prev.easeFactor,
          reps: prev.reps,
          lapses: prev.lapses,
          due: addMinutes(now, HARD_LEARNING_STEP_MIN),
        };
      case "good":
      case "easy":
        return graduate(prev, rating, now);
    }
  }

  if (isRelearning) {
    switch (rating) {
      case "again":
      case "hard":
        return {
          state: "relearning",
          interval: prev.interval,
          easeFactor: prev.easeFactor,
          reps: prev.reps,
          lapses: prev.lapses,
          due: addMinutes(now, RELEARN_STEP_MIN),
        };
      case "good":
      case "easy":
        return graduate(prev, rating, now);
    }
  }

  switch (rating) {
    case "again": {
      const ease = clampEase(prev.easeFactor - 0.2);
      return {
        state: "relearning",
        interval: 0,
        easeFactor: ease,
        reps: prev.reps,
        lapses: prev.lapses + 1,
        due: addMinutes(now, RELEARN_STEP_MIN),
      };
    }
    case "hard": {
      const ease = clampEase(prev.easeFactor - 0.15);
      const interval = Math.max(
        1,
        Math.round(prev.interval * HARD_INTERVAL_MULT),
      );
      return {
        state: "review",
        interval,
        easeFactor: ease,
        reps: prev.reps + 1,
        lapses: prev.lapses,
        due: addDays(now, interval),
      };
    }
    case "good": {
      const interval = Math.max(1, Math.round(prev.interval * prev.easeFactor));
      return {
        state: "review",
        interval,
        easeFactor: prev.easeFactor,
        reps: prev.reps + 1,
        lapses: prev.lapses,
        due: addDays(now, interval),
      };
    }
    case "easy": {
      const ease = prev.easeFactor + 0.15;
      const interval = Math.max(
        1,
        Math.round(prev.interval * prev.easeFactor * EASY_BONUS),
      );
      return {
        state: "review",
        interval,
        easeFactor: ease,
        reps: prev.reps + 1,
        lapses: prev.lapses,
        due: addDays(now, interval),
      };
    }
  }
};
