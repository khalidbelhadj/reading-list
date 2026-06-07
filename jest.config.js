const nextJest = require("next/jest");

// next/jest wires up the SWC transform, `@/*` path aliases from tsconfig, and
// env loading, so tests run against the same module resolution as the app.
const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  // Unit tests only — the flashcard-sync DB layer is exercised with a fake tx,
  // so no database or server runtime is needed.
  testMatch: ["**/*.test.ts"],
  // Git worktrees under .claude/ carry their own package.json copies, which
  // collide in jest-haste-map and shadow module resolution. Keep jest to the
  // real source tree.
  modulePathIgnorePatterns: ["<rootDir>/.claude/", "<rootDir>/dist-electron/"],
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/.claude/"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
};

module.exports = createJestConfig(config);
