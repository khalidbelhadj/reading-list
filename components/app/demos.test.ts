import { readdirSync, readFileSync } from "node:fs";
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

// The Mac board carries the same kit: every web demo has a demo of the same
// title on the native board (mac/Sources/ReadingList/DesignKit, registered
// in DemoRegistry.swift). A component added to one board without the other
// fails check.
const readWebDemoTitles = () =>
  DIRS.flatMap((dir) =>
    readdirSync(dir)
      .filter((file) => file.endsWith(".demo.tsx"))
      .map((file) => {
        const source = readFileSync(join(dir, file), "utf8");
        // The demo's own title, not a sample object's.
        const match = source.match(
          /demo:\s*Demo\s*=\s*\{\s*title:\s*"([^"]+)"/,
        );
        return match?.[1] ?? file;
      }),
  );

const readMacDemoTitles = () => {
  const kit = join(
    import.meta.dir,
    "..",
    "..",
    "mac",
    "Sources",
    "ReadingList",
    "DesignKit",
  );
  const titles = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(dir, entry.name));
      else if (entry.name.endsWith(".swift")) {
        const source = readFileSync(join(dir, entry.name), "utf8");
        for (const match of source.matchAll(/Demo\(\s*"([^"]+)"/g)) {
          if (match[1]) titles.add(match[1]);
        }
      }
    }
  };
  walk(kit);
  return titles;
};

describe("mac board parity", () => {
  const macTitles = readMacDemoTitles();
  test("the Mac board has demos", () => {
    expect(macTitles.size).toBeGreaterThan(0);
  });
  for (const title of readWebDemoTitles()) {
    test(`"${title}" is on the Mac board`, () => {
      expect(macTitles.has(title)).toBe(true);
    });
  }
});
