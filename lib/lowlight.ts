import { createLowlight } from "lowlight";

import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import rust from "highlight.js/lib/languages/rust";
import ocaml from "highlight.js/lib/languages/ocaml";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import go from "highlight.js/lib/languages/go";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import sql from "highlight.js/lib/languages/sql";
import java from "highlight.js/lib/languages/java";
import markdown from "highlight.js/lib/languages/markdown";
import yaml from "highlight.js/lib/languages/yaml";
import zig from "highlightjs-zig";
import odin from "highlightjs-odin";

export const lowlight = createLowlight();

lowlight.register("c", c);
lowlight.register("cpp", cpp);
lowlight.register("rust", rust);
lowlight.register("zig", zig);
lowlight.register("odin", odin);
lowlight.register("ocaml", ocaml);
lowlight.register("javascript", javascript);
lowlight.register("typescript", typescript);
lowlight.register("tsx", typescript);
lowlight.register("python", python);
lowlight.register("go", go);
lowlight.register("bash", bash);
lowlight.register("json", json);
lowlight.register("html", xml);
lowlight.register("css", css);
lowlight.register("sql", sql);
lowlight.register("java", java);
lowlight.register("markdown", markdown);
lowlight.register("yaml", yaml);

export type CodeLanguage = {
  value: string;
  label: string;
  aliases?: string[];
};

export const CODE_LANGUAGES: CodeLanguage[] = [
  { value: "plaintext", label: "Plain text", aliases: ["text", "plain"] },
  { value: "bash", label: "Bash", aliases: ["sh", "shell", "zsh"] },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++", aliases: ["c++", "cxx", "cc"] },
  { value: "css", label: "CSS" },
  { value: "go", label: "Go", aliases: ["golang"] },
  { value: "html", label: "HTML", aliases: ["xml"] },
  { value: "java", label: "Java" },
  { value: "javascript", label: "JavaScript", aliases: ["js", "jsx"] },
  { value: "json", label: "JSON" },
  { value: "markdown", label: "Markdown", aliases: ["md"] },
  { value: "ocaml", label: "OCaml", aliases: ["ml"] },
  { value: "odin", label: "Odin" },
  { value: "python", label: "Python", aliases: ["py"] },
  { value: "rust", label: "Rust", aliases: ["rs"] },
  { value: "sql", label: "SQL" },
  { value: "typescript", label: "TypeScript", aliases: ["ts"] },
  { value: "tsx", label: "TSX" },
  { value: "yaml", label: "YAML", aliases: ["yml"] },
  { value: "zig", label: "Zig" },
];

export const normalizeLanguage = (raw: string | null | undefined): string => {
  if (!raw) return "plaintext";
  const lower = raw.toLowerCase();
  for (const lang of CODE_LANGUAGES) {
    if (lang.value === lower) return lang.value;
    if (lang.aliases?.includes(lower)) return lang.value;
  }
  return "plaintext";
};

export const labelForLanguage = (value: string): string => {
  const normalized = normalizeLanguage(value);
  return (
    CODE_LANGUAGES.find((lang) => lang.value === normalized)?.label ??
    "Plain text"
  );
};
