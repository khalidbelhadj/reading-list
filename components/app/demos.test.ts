import { readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

// Every design-system component, base (components/system) or app
// (components/app), ships with a demo on /design/components. This is the rule
// that keeps the board complete: a component without a demo fails check.
const DIRS = [join(import.meta.dir, "..", "system"), import.meta.dir];

describe("design-system demos", () => {
  for (const dir of DIRS) {
    const files = readdirSync(dir);
    const components = files.filter(
      (file) =>
        file.endsWith(".tsx") &&
        !file.endsWith(".demo.tsx") &&
        !file.endsWith(".test.tsx"),
    );
    test(`${dir} has components`, () => {
      expect(components.length).toBeGreaterThan(0);
    });
    for (const file of components) {
      const demo = file.replace(/\.tsx$/, ".demo.tsx");
      test(`${file} has ${demo}`, () => {
        expect(files).toContain(demo);
      });
    }
  }
});
