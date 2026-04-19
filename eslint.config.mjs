// @ts-check
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import reactCompiler from "eslint-plugin-react-compiler";
import unusedImports from "eslint-plugin-unused-imports";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

/** @type {import("eslint").Linter.Config[]} */
const config = [
  { ignores: ["node_modules/", ".next/", "extension/"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    plugins: {
      "react-compiler": reactCompiler,
      "unused-imports": unusedImports,
    },
    rules: {
      "react-compiler/react-compiler": "error",
      "react-hooks/exhaustive-deps": "error",
      "react/no-unstable-nested-components": ["error", { allowAsProps: true }],
      "react/jsx-no-bind": [
        "warn",
        {
          allowArrowFunctions: false,
          allowFunctions: false,
          allowBind: true,
          ignoreRefs: true,
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
];

export default config;
