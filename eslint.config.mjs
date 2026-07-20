// @ts-check
import js from "@eslint/js";
import reactPlugin from "eslint-plugin-react";
import reactCompiler from "eslint-plugin-react-compiler";
import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";
import tseslint from "typescript-eslint";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  {
    ignores: [
      "node_modules/",
      "extension/",
      // Both contain a directory literally named "Bun Next.js" — ESLint's
      // file walker treats the .js suffix as a lintable file and crashes
      // (EISDIR).
      ".agents/",
      ".claude/",
      "dist/",
      ".output/",
      ".tanstack/",
      ".nitro/",
      "dist-electron/",
      "app/routeTree.gen.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat["jsx-runtime"],
  ...reactHooks.configs["flat/recommended"],
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    settings: {
      react: { version: "detect" },
    },
    plugins: {
      "react-compiler": reactCompiler,
      "simple-import-sort": simpleImportSort,
      "unused-imports": unusedImports,
    },
    rules: {
      // `catch {}` is an established pattern here for best-effort
      // localStorage/URL probing; the old next lint baseline allowed it.
      "no-empty": ["error", { allowEmptyCatch: true }],
      // stripAnsi-style regexes legitimately match the ESC control character.
      "no-control-regex": "off",
      "react-compiler/react-compiler": "error",
      "react-hooks/exhaustive-deps": "error",
      "react/no-unstable-nested-components": ["error", { allowAsProps: true }],
      // React Compiler is enabled and hoists inline arrows on list rows, so
      // jsx-no-bind would only produce noise on hot row callbacks. Leaving
      // it as "warn" was the worst middle ground — relying on the compiler
      // is the intent.
      "react/jsx-no-bind": "off",
      // Covered by TypeScript itself; prop-types are not used in a TS app.
      "react/prop-types": "off",
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "inline-type-imports" },
      ],
      "max-lines": [
        "error",
        { max: 500, skipBlankLines: true, skipComments: true },
      ],
      "max-lines-per-function": [
        "error",
        { max: 250, skipBlankLines: true, skipComments: true },
      ],
      complexity: ["error", 25],
      "react/function-component-definition": [
        "error",
        {
          namedComponents: "arrow-function",
          unnamedComponents: "arrow-function",
        },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // Jest only accepts a CommonJS config here (package.json is not
    // "type": "module").
    files: ["jest.config.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // Client-side code must go through the RPC layer — never touch the db or
    // server-only modules directly.
    files: [
      "components/**/*.{ts,tsx}",
      "app/routes/**/*.tsx",
      "app/*.{ts,tsx}",
    ],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/db",
                "@/db/*",
                "drizzle-orm",
                "drizzle-orm/*",
                "postgres",
              ],
              allowTypeImports: true,
              message:
                "Server-only. Go through @/app/actions or @/lib/queries.",
            },
            {
              group: ["**/*.server"],
              allowTypeImports: true,
              message: "Server-only module. Import the RPC wrapper instead.",
            },
            {
              // The action *impls* under app/actions/* don't end in .server.ts,
              // so the barrel is the only safe entry — importing a subpath
              // (e.g. @/app/actions/items) would pull db code into the client
              // bundle with no other lint error.
              group: ["@/app/actions/*", "@/lib/queries/*"],
              allowTypeImports: true,
              message:
                "Import from the @/app/actions or @/lib/queries barrel, not the impl module.",
            },
          ],
        },
      ],
    },
  },
  {
    // Debug pages, scripts, tests, and schema files are exempt from the size
    // budgets — they are not product code.
    files: ["app/debug/**", "scripts/**", "**/*.test.ts", "db/**"],
    rules: {
      "max-lines": "off",
      "max-lines-per-function": "off",
      complexity: "off",
    },
  },
  {
    // Grandfathered oversized files — shrink this list, never grow it.
    files: [
      "components/items-list.tsx",
      "components/items-list/item-dropdown.tsx",
      "components/items-list/search-bar.tsx",
      "components/items-list/sliding-item-panel.tsx",
      "components/items-list/toolbar.tsx",
      "lib/url.server.ts",
    ],
    rules: {
      "max-lines": "off",
      "max-lines-per-function": "off",
      complexity: "off",
    },
  },
  {
    // The Electron <webview> tag takes attributes React's DOM catalog doesn't
    // know (partition selects the guest's session). Scoped to the one file
    // that renders it.
    files: ["components/viewer/webview-engine.tsx"],
    rules: {
      "react/no-unknown-property": ["error", { ignore: ["partition"] }],
    },
  },
  {
    // components/ui is presentation-only: design-system wrappers with no app
    // data access. Editor internals live in components/editor.
    files: ["components/ui/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/app/actions",
                "@/app/actions/*",
                "@/lib/queries",
                "@/components/items-list",
                "@/components/items-list/*",
                "@/components/editor/*",
              ],
              allowTypeImports: true,
              message:
                "components/ui is presentation-only — app data and editor internals don't belong here.",
            },
          ],
        },
      ],
    },
  },
  {
    // Window-resize handling goes through the lib hooks (use-window-resize,
    // use-element-size) so coalescing and cleanup are never hand-rolled, and
    // URL state writes stay in their designated single writers.
    files: ["components/**/*.{ts,tsx}", "app/**/*.{ts,tsx}", "lib/**/*.ts"],
    ignores: [
      // The hooks themselves, plus deliberate exceptions:
      "lib/use-window-resize.ts",
      // Anchored-popover repositioning owns its own listener bundle.
      "lib/editor/use-anchored-popover.ts",
      // Module-scope direct-DOM engine — no hook context available.
      "components/items-list/use-title-morph.ts",
      // One cohesive dismissal effect (pointerdown/keydown/scroll/resize).
      "components/editor/card-node-view.tsx",
      // Designated URL writers: applyView, ?q sync, window-open params.
      "components/panel-layout.tsx",
      "components/items-list/use-list-search.ts",
      "lib/app-windows.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            'CallExpression[callee.object.name="window"][callee.property.name="addEventListener"][arguments.0.value="resize"]',
          message:
            "Use useWindowResize/useElementSize from lib/ instead of a raw resize listener.",
        },
        {
          selector:
            "MemberExpression[property.name=/^(pushState|replaceState)$/]",
          message:
            "URL state writes live in panel-layout's applyView, use-list-search, or lib/app-windows.",
        },
      ],
    },
  },
];

export default config;
