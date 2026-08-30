import { type Option } from "./options";

// Round two candidates. Matcha shades are shown on the chosen Whisper
// neutrals; type, edge and density are theme independent.

export const MATCHA: Option[] = [
  {
    key: "matcha",
    label: "A. Matcha",
    note: "oklch 0.68 0.11 125. The middle of the cup: green with a yellow lean.",
    light: {
      "--primary": "oklch(0.68 0.11 125)",
      "--primary-foreground": "oklch(0.2 0.03 125)",
    },
    dark: {
      "--primary": "oklch(0.78 0.12 125)",
      "--primary-foreground": "oklch(0.2 0.03 125)",
    },
  },
  {
    key: "ceremonial",
    label: "B. Ceremonial",
    note: "oklch 0.6 0.1 128. Deeper and a touch more saturated; white text on it.",
    light: {
      "--primary": "oklch(0.6 0.1 128)",
      "--primary-foreground": "oklch(0.985 0.004 80)",
    },
    dark: {
      "--primary": "oklch(0.74 0.11 128)",
      "--primary-foreground": "oklch(0.2 0.03 128)",
    },
  },
  {
    key: "latte",
    label: "C. Latte",
    note: "oklch 0.74 0.09 118. Milkier and yellower, softest of the three.",
    light: {
      "--primary": "oklch(0.74 0.09 118)",
      "--primary-foreground": "oklch(0.22 0.03 118)",
    },
    dark: {
      "--primary": "oklch(0.82 0.1 118)",
      "--primary-foreground": "oklch(0.22 0.03 118)",
    },
  },
];

export type TypeScale = {
  key: string;
  label: string;
  note: string;
  body: string;
  small: string;
  title: string;
  heading: string;
  display: string;
};

export const TYPE: TypeScale[] = [
  {
    key: "compact",
    label: "A. Compact",
    note: "13 body, 12 small, 15 title, 20 heading, 28 display. Dense and tool-like.",
    body: "13px",
    small: "12px",
    title: "15px",
    heading: "20px",
    display: "28px",
  },
  {
    key: "regular",
    label: "B. Regular",
    note: "14 body, 12 small, 16 title, 22 heading, 32 display. Apple-app proportions.",
    body: "14px",
    small: "12px",
    title: "16px",
    heading: "22px",
    display: "32px",
  },
  {
    key: "airy",
    label: "C. Airy",
    note: "15 body, 13 small, 17 title, 24 heading, 36 display. Reading-first.",
    body: "15px",
    small: "13px",
    title: "17px",
    heading: "24px",
    display: "36px",
  },
];

export type Edge = { key: string; label: string; note: string; shadow: string };

export const EDGE: Edge[] = [
  {
    key: "hairline",
    label: "A. Hairline",
    note: "A 1px inset line at 8% of the foreground. Crisp, no depth.",
    shadow:
      "inset 0 0 0 1px color-mix(in oklab, var(--foreground) 8%, transparent)",
  },
  {
    key: "shadow",
    label: "B. Soft shadow",
    note: "No line; a low, wide shadow lifts the surface off the page.",
    shadow: "0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -8px rgb(0 0 0 / 0.12)",
  },
  {
    key: "both",
    label: "C. Hairline and shadow",
    note: "The macOS window recipe: a faint line plus a faint shadow.",
    shadow:
      "inset 0 0 0 1px color-mix(in oklab, var(--foreground) 6%, transparent), 0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -8px rgb(0 0 0 / 0.1)",
  },
  {
    key: "flat",
    label: "D. Flat",
    note: "Tone alone separates the surface from the page. The quietest.",
    shadow: "none",
  },
];

export type Density = {
  key: string;
  label: string;
  note: string;
  row: string;
  gap: string;
};

export const DENSITY: Density[] = [
  {
    key: "tight",
    label: "A. Tight",
    note: "24px rows, no gap. Finder sidebar.",
    row: "24px",
    gap: "0px",
  },
  {
    key: "normal",
    label: "B. Normal",
    note: "28px rows, 2px gap. Today's experimental sidebar.",
    row: "28px",
    gap: "2px",
  },
  {
    key: "roomy",
    label: "C. Roomy",
    note: "32px rows, 2px gap. Notes, Mail.",
    row: "32px",
    gap: "2px",
  },
];
