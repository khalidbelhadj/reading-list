// Candidate foundation values for the design board. Each option is a set of
// CSS custom properties applied inline to a preview, so the same sample UI
// renders under every candidate with nothing else changing.

export type TokenSet = Record<`--${string}`, string>;

export type Option = {
  key: string;
  label: string;
  note: string;
  light: TokenSet;
  dark: TokenSet;
};

// Neutral warmth: how much of the hue-75 tint the greys carry.
export const WARMTH: Option[] = [
  {
    key: "a",
    label: "A. Whisper",
    note: "Chroma 0.004. Reads as grey until you put it next to pure grey.",
    light: {
      "--background": "oklch(0.985 0.004 80)",
      "--foreground": "oklch(0.22 0.008 70)",
      "--card": "oklch(0.97 0.005 80)",
      "--muted": "oklch(0.95 0.005 80)",
      "--muted-foreground": "oklch(0.52 0.01 70)",
      "--border": "oklch(0.9 0.006 80)",
    },
    dark: {
      "--background": "oklch(0.2 0.005 70)",
      "--foreground": "oklch(0.96 0.004 80)",
      "--card": "oklch(0.235 0.006 70)",
      "--muted": "oklch(0.29 0.006 70)",
      "--muted-foreground": "oklch(0.7 0.008 75)",
      "--border": "oklch(0.31 0.006 70)",
    },
  },
  {
    key: "b",
    label: "B. Linen",
    note: "Chroma 0.01. A visible warm paper; dark mode leans espresso.",
    light: {
      "--background": "oklch(0.982 0.01 80)",
      "--foreground": "oklch(0.23 0.015 65)",
      "--card": "oklch(0.965 0.012 80)",
      "--muted": "oklch(0.945 0.012 80)",
      "--muted-foreground": "oklch(0.52 0.02 70)",
      "--border": "oklch(0.895 0.014 80)",
    },
    dark: {
      "--background": "oklch(0.2 0.012 65)",
      "--foreground": "oklch(0.955 0.01 80)",
      "--card": "oklch(0.235 0.014 65)",
      "--muted": "oklch(0.29 0.014 65)",
      "--muted-foreground": "oklch(0.7 0.016 75)",
      "--border": "oklch(0.31 0.014 65)",
    },
  },
];

// The single accent, used sparingly: primary action, selection, "done".
export const ACCENT: Option[] = [
  {
    key: "sage",
    label: "A. Sage",
    note: "Hue 150. What the app has today, slightly calmer.",
    light: {
      "--primary": "oklch(0.6 0.06 150)",
      "--primary-foreground": "oklch(0.985 0.004 80)",
    },
    dark: {
      "--primary": "oklch(0.72 0.08 150)",
      "--primary-foreground": "oklch(0.2 0.01 150)",
    },
  },
  {
    key: "moss",
    label: "B. Moss",
    note: "Hue 125. Greener and warmer, sits naturally on linen.",
    light: {
      "--primary": "oklch(0.58 0.07 125)",
      "--primary-foreground": "oklch(0.985 0.004 80)",
    },
    dark: {
      "--primary": "oklch(0.74 0.09 125)",
      "--primary-foreground": "oklch(0.2 0.01 125)",
    },
  },
  {
    key: "clay",
    label: "C. Clay",
    note: "Hue 55. Warm and quiet; the one that is not green.",
    light: {
      "--primary": "oklch(0.6 0.08 55)",
      "--primary-foreground": "oklch(0.985 0.004 80)",
    },
    dark: {
      "--primary": "oklch(0.76 0.09 60)",
      "--primary-foreground": "oklch(0.22 0.02 55)",
    },
  },
];

// Corner radius pair: controls (buttons, inputs) and surfaces (cards, panels).
export const RADIUS: {
  key: string;
  label: string;
  note: string;
  control: string;
  surface: string;
}[] = [
  {
    key: "s",
    label: "A. Crisp",
    note: "6 / 10px. Tight, tool-like.",
    control: "6px",
    surface: "10px",
  },
  {
    key: "m",
    label: "B. Soft",
    note: "8 / 14px. Today's feel, slightly rounder.",
    control: "8px",
    surface: "14px",
  },
  {
    key: "l",
    label: "C. Pillowy",
    note: "10 / 20px. Apple-window rounding.",
    control: "10px",
    surface: "20px",
  },
];

// Glass: how much of what sits behind a translucent surface shows through.
export const GLASS: {
  key: string;
  label: string;
  note: string;
  opacity: number;
  blur: number;
}[] = [
  {
    key: "light",
    label: "A. Frost",
    note: "74% tint, 18px blur. Mostly surface, a hint of depth.",
    opacity: 0.74,
    blur: 18,
  },
  {
    key: "medium",
    label: "B. Glass",
    note: "58% tint, 28px blur. Clearly see-through, still legible.",
    opacity: 0.58,
    blur: 28,
  },
  {
    key: "heavy",
    label: "C. Vapour",
    note: "42% tint, 40px blur. The backdrop leads; text needs care.",
    opacity: 0.42,
    blur: 40,
  },
];
