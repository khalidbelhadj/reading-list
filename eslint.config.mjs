// @ts-check
import js from "@eslint/js";
import reactPlugin from "eslint-plugin-react";
import reactCompiler from "eslint-plugin-react-compiler";
import reactHooks from "eslint-plugin-react-hooks";
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
];

export default config;
