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
    // app/server.ts IS the server: it's the process entry, never bundled for
    // the client. The rule below exists to keep server code out of the client
    // bundle, which is exactly not the risk here.
    ignores: ["app/server.ts"],
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
              message: "Server-only. Go through @/app/actions.",
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
              group: ["@/app/actions/*"],
              allowTypeImports: true,
              message:
                "Import from the @/app/actions barrel, not the impl module.",
            },
          ],
        },
      ],
    },
  },
  {
    // Scripts, tests, and schema files are exempt from the size budgets —
    // they are not product code.
    files: ["scripts/**", "**/*.test.ts", "db/**"],
    rules: {
      "max-lines": "off",
      "max-lines-per-function": "off",
      complexity: "off",
    },
  },
  {
    // Grandfathered over-complexity — shrink this list, never grow it.
    files: ["lib/url.server.ts"],
    rules: {
      complexity: "off",
    },
  },
  {
    // components/system holds the base primitives of the design system:
    // presentation only, and no knowledge of the app (it may not even import
    // the app-shaped compositions in components/app).
    files: ["components/system/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/actions", "@/app/actions/*", "@/components/app/*"],
              allowTypeImports: true,
              message:
                "components/system is the base kit: presentation only, no app knowledge.",
            },
          ],
        },
      ],
    },
  },
  {
    // components/app holds the app-shaped compositions (rows, sidebar
    // entries). Built from components/system; still presentation only.
    files: ["components/app/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/actions", "@/app/actions/*"],
              allowTypeImports: true,
              message:
                "components/app is presentation-only: compose components/system, take data as props.",
            },
          ],
        },
      ],
    },
  },
  {
    // Code written against the new kit never hand-rolls a control. When a
    // control is missing, add it to components/system (with a demo).
    files: [
      "components/system/**/*.demo.tsx",
      "components/app/**/*.demo.tsx",
      "components/shell/**/*.{ts,tsx}",
      "components/design-board/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXOpeningElement[name.name=/^(button|input|textarea|select)$/]",
          message:
            "Use the kit component from components/system instead of a raw control.",
        },
      ],
    },
  },
  {
    // Window-resize handling belongs in a shared hook, not scattered raw
    // listeners — coalescing and cleanup are easy to get subtly wrong.
    files: ["components/**/*.{ts,tsx}", "app/**/*.{ts,tsx}", "lib/**/*.ts"],
    ignores: [
      // Anchored-popover repositioning owns its own listener bundle.
      "lib/editor/use-anchored-popover.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            'CallExpression[callee.object.name="window"][callee.property.name="addEventListener"][arguments.0.value="resize"]',
          message:
            "Window-resize handling belongs in a shared lib hook, not a raw listener.",
        },
      ],
    },
  },
  {
    // The shell keeps view state in memory; the router owns the URL. No
    // component writes history state by hand.
    files: ["components/**/*.{ts,tsx}", "app/**/*.{ts,tsx}", "lib/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[property.name=/^(pushState|replaceState)$/]",
          message: "Don't write URL state by hand — go through the router.",
        },
      ],
    },
  },
];

export default config;
