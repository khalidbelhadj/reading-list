/**
 * Static complexity analyzer for the reading-list codebase.
 *
 * Walks app/, components/, lib/, db/ with the TypeScript compiler API (purely
 * syntactic — no type-checking) and emits per-file metrics plus an import graph
 * to analysis/code/metrics.json. Run the report generator afterwards to render
 * the treemap / dependency graph / ranked tables.
 *
 *   bun run analyze        (runs this, then build-complexity-report.ts)
 *
 * Nothing here imports app code, so it is safe to run standalone.
 */
import ts from "typescript";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  existsSync,
} from "node:fs";
import { join, relative, dirname } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components", "lib", "db", "hooks"];
const OUT_DIR = join(ROOT, "analysis", "code");
const OUT_JSON = join(OUT_DIR, "metrics.json");
const IGNORE = new Set([
  "node_modules",
  ".next",
  "electron",
  "dist-electron",
  "drizzle",
]);

type EffectInfo = { line: number; depCount: number | null };
type FnInfo = {
  name: string;
  line: number;
  loc: number;
  complexity: number;
  jsxDepth: number;
  props: number;
  isComponent: boolean;
  isHook: boolean;
  renders: string[]; // PascalCase JSX tags used in this function's body
};
type FileMetrics = {
  path: string;
  group: string;
  loc: number;
  codeLoc: number;
  hooks: {
    total: number;
    useState: number;
    useEffect: number;
    byName: Record<string, number>;
  };
  effects: EffectInfo[];
  maxJsxDepth: number;
  maxComplexity: number;
  functions: FnInfo[];
  imports: { internal: string[]; external: string[] };
  importedBy: string[];
};

const isPascal = (name: string) => /^[A-Z]/.test(name);
const isHookName = (name: string) => /^use[A-Z]/.test(name);

type FnWithBody =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration;
const isFnWithBody = (node: ts.Node): node is FnWithBody =>
  (ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)) &&
  !!node.body;

const walkFiles = (dir: string, acc: string[]) => {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    if (IGNORE.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walkFiles(full, acc);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.d\.ts$/.test(entry))
      acc.push(full);
  }
};

/** Group label used to cluster files in the treemap (the immediate meaningful folder). */
const groupOf = (rel: string): string => {
  const parts = rel.split("/");
  if (parts[0] === "components" && parts[1] === "items-list")
    return "components/items-list";
  if (parts[0] === "components" && parts[1] === "ui") return "components/ui";
  if (parts[0] === "components" && parts[1] === "flashcards")
    return "components/flashcards";
  if (parts[0] === "components") return "components";
  if (parts[0] === "app" && parts[1] === "actions") return "app/actions";
  if (parts[0] === "app" && parts[1] === "api") return "app/api";
  if (parts[0] === "app" && parts[1] === "debug") return "app/debug";
  if (parts[0] === "app" && parts[1] === "review") return "app/review";
  if (parts[0] === "app") return "app";
  return parts[0] ?? rel;
};

/** Resolve an import specifier to a repo-relative file path, or null if external. */
const resolveImport = (spec: string, fromFile: string): string | null => {
  let base: string;
  if (spec.startsWith("@/")) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = join(dirname(fromFile), spec);
  else return null; // bare package
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile())
      return relative(ROOT, c).replace(/\\/g, "/");
  }
  // Unresolved internal (e.g. points at a non-ts asset) — keep raw-ish so it still shows as a node.
  if (existsSync(base)) return relative(ROOT, base).replace(/\\/g, "/");
  return `${relative(ROOT, base).replace(/\\/g, "/")}`;
};

/** Decision-point count for cyclomatic complexity, NOT descending into nested functions. */
const complexityOf = (fnBody: ts.Node): number => {
  let count = 1;
  const visit = (node: ts.Node) => {
    if (node !== fnBody && ts.isFunctionLike(node)) return; // nested fn owns its own complexity
    switch (node.kind) {
      case ts.SyntaxKind.IfStatement:
      case ts.SyntaxKind.ConditionalExpression:
      case ts.SyntaxKind.ForStatement:
      case ts.SyntaxKind.ForInStatement:
      case ts.SyntaxKind.ForOfStatement:
      case ts.SyntaxKind.WhileStatement:
      case ts.SyntaxKind.DoStatement:
      case ts.SyntaxKind.CaseClause:
      case ts.SyntaxKind.CatchClause:
        count++;
        break;
      case ts.SyntaxKind.BinaryExpression: {
        const op = (node as ts.BinaryExpression).operatorToken.kind;
        if (
          op === ts.SyntaxKind.AmpersandAmpersandToken ||
          op === ts.SyntaxKind.BarBarToken ||
          op === ts.SyntaxKind.QuestionQuestionToken
        )
          count++;
        break;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(fnBody);
  return count;
};

/** Max JSX nesting depth within a function body (does not descend into nested functions). */
const jsxDepthOf = (fnBody: ts.Node): number => {
  let max = 0;
  const visit = (node: ts.Node, depth: number) => {
    if (node !== fnBody && ts.isFunctionLike(node)) return;
    let d = depth;
    if (
      ts.isJsxElement(node) ||
      ts.isJsxSelfClosingElement(node) ||
      ts.isJsxFragment(node)
    ) {
      d = depth + 1;
      if (d > max) max = d;
    }
    ts.forEachChild(node, (c) => visit(c, d));
  };
  visit(fnBody, 0);
  return max;
};

/** Distinct PascalCase JSX tag names used in a function body (its child components). */
const renderedTags = (fnBody: ts.Node): string[] => {
  const tags = new Set<string>();
  const visit = (node: ts.Node) => {
    if (node !== fnBody && ts.isFunctionLike(node)) return;
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      let base: ts.Node = node.tagName;
      while (ts.isPropertyAccessExpression(base)) base = base.expression;
      if (ts.isIdentifier(base) && /^[A-Z]/.test(base.text))
        tags.add(base.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(fnBody);
  return [...tags];
};

const containsJsx = (fnBody: ts.Node): boolean => {
  let found = false;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (node !== fnBody && ts.isFunctionLike(node)) return;
    if (
      ts.isJsxElement(node) ||
      ts.isJsxSelfClosingElement(node) ||
      ts.isJsxFragment(node)
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(fnBody);
  return found;
};

const nameOfFunction = (node: ts.FunctionLikeDeclaration): string => {
  if (ts.isFunctionDeclaration(node) && node.name) return node.name.text;
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name))
    return parent.name.text;
  if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name))
    return parent.name.text;
  if (ts.isMethodDeclaration(node) && node.name && ts.isIdentifier(node.name))
    return node.name.text;
  return "(anonymous)";
};

const propsCount = (node: ts.FunctionLikeDeclaration): number => {
  const first = node.parameters[0];
  if (!first) return 0;
  if (ts.isObjectBindingPattern(first.name)) return first.name.elements.length;
  return node.parameters.length;
};

const analyzeFile = (absPath: string): FileMetrics => {
  const src = readFileSync(absPath, "utf8");
  const rel = relative(ROOT, absPath).replace(/\\/g, "/");
  const sf = ts.createSourceFile(
    rel,
    src,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  const lines = src.split("\n");
  const loc = lines.length;
  const codeLoc = lines.filter((l) => {
    const t = l.trim();
    return (
      t.length > 0 &&
      !t.startsWith("//") &&
      !t.startsWith("*") &&
      !t.startsWith("/*")
    );
  }).length;

  const hooks = {
    total: 0,
    useState: 0,
    useEffect: 0,
    byName: {} as Record<string, number>,
  };
  const effects: EffectInfo[] = [];
  const functions: FnInfo[] = [];
  const internalImports = new Set<string>();
  const externalImports = new Set<string>();

  const lineOf = (node: ts.Node) =>
    sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

  const visit = (node: ts.Node) => {
    // Imports
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const spec = node.moduleSpecifier.text;
      const resolved = resolveImport(spec, absPath);
      if (resolved) internalImports.add(resolved);
      else
        externalImports.add(
          spec.startsWith("@")
            ? spec.split("/").slice(0, 2).join("/")
            : (spec.split("/")[0] ?? spec),
        );
    }

    // Hook calls — match both bare `useX()` and namespaced `React.useX()`.
    if (ts.isCallExpression(node)) {
      let callee: string | null = null;
      if (ts.isIdentifier(node.expression)) callee = node.expression.text;
      else if (ts.isPropertyAccessExpression(node.expression))
        callee = node.expression.name.text;
      if (callee && isHookName(callee)) {
        hooks.total++;
        hooks.byName[callee] = (hooks.byName[callee] ?? 0) + 1;
        if (callee === "useState") hooks.useState++;
        if (callee === "useEffect" || callee === "useLayoutEffect") {
          hooks.useEffect++;
          const depsArg = node.arguments[1];
          const depCount =
            depsArg && ts.isArrayLiteralExpression(depsArg)
              ? depsArg.elements.length
              : null;
          effects.push({ line: lineOf(node), depCount });
        }
      }
    }

    // Functions
    if (isFnWithBody(node)) {
      const body: ts.Node = node.body!; // guaranteed by isFnWithBody
      const name = nameOfFunction(node);
      const hasJsx = containsJsx(body);
      const startLine = sf.getLineAndCharacterOfPosition(
        node.getStart(sf),
      ).line;
      const endLine = sf.getLineAndCharacterOfPosition(node.getEnd()).line;
      functions.push({
        name,
        line: lineOf(node),
        loc: endLine - startLine + 1,
        complexity: complexityOf(body),
        jsxDepth: jsxDepthOf(body),
        props: propsCount(node),
        isComponent: isPascal(name) && hasJsx,
        isHook: isHookName(name),
        renders: hasJsx ? renderedTags(body).filter((t) => t !== name) : [],
      });
    }

    ts.forEachChild(node, visit);
  };
  visit(sf);

  return {
    path: rel,
    group: groupOf(rel),
    loc,
    codeLoc,
    hooks,
    effects,
    maxJsxDepth: functions.reduce((m, f) => Math.max(m, f.jsxDepth), 0),
    maxComplexity: functions.reduce((m, f) => Math.max(m, f.complexity), 0),
    functions,
    imports: {
      internal: [...internalImports].sort(),
      external: [...externalImports].sort(),
    },
    importedBy: [],
  };
};

// ---- main ----
const allFiles: string[] = [];
for (const d of SCAN_DIRS) walkFiles(join(ROOT, d), allFiles);
// middleware.ts lives at the root
if (existsSync(join(ROOT, "middleware.ts")))
  allFiles.push(join(ROOT, "middleware.ts"));

const files = allFiles.map(analyzeFile).sort((a, b) => b.loc - a.loc);

// Second pass: reverse import edges (importedBy) restricted to analyzed files.
const byPath = new Map(files.map((f) => [f.path, f]));
const edges: { from: string; to: string }[] = [];
for (const f of files) {
  for (const target of f.imports.internal) {
    if (byPath.has(target)) {
      edges.push({ from: f.path, to: target });
      byPath.get(target)!.importedBy.push(f.path);
    }
  }
}

const totals = {
  files: files.length,
  loc: files.reduce((s, f) => s + f.loc, 0),
  codeLoc: files.reduce((s, f) => s + f.codeLoc, 0),
  hooks: files.reduce((s, f) => s + f.hooks.total, 0),
  useEffect: files.reduce((s, f) => s + f.hooks.useEffect, 0),
  useState: files.reduce((s, f) => s + f.hooks.useState, 0),
  components: files.reduce(
    (s, f) => s + f.functions.filter((fn) => fn.isComponent).length,
    0,
  ),
  customHooks: files.reduce(
    (s, f) => s + f.functions.filter((fn) => fn.isHook).length,
    0,
  ),
  internalEdges: edges.length,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_JSON, JSON.stringify({ totals, files, edges }, null, 2));

console.log(
  `Analyzed ${files.length} files (${totals.loc.toLocaleString()} lines).`,
);
console.log(
  `  ${totals.components} components, ${totals.customHooks} custom hooks, ${totals.hooks} hook calls, ${totals.useEffect} effects.`,
);
console.log(`  ${edges.length} internal import edges.`);
console.log(`Wrote ${relative(ROOT, OUT_JSON)}`);
