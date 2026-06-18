// Shared delay (ms) for tooltips that should appear after a hover hold.
// Default tooltips appear immediately; opt in by wrapping the trigger in a
// `<TooltipProvider delay={TOOLTIP_DELAY_MS}>`.
//
// Lives in a plain (non-"use client") module rather than tooltip.tsx so the
// Server Component root layout can import this value without pulling the
// client tooltip module into the server's module graph. Importing a
// non-component value from a "use client" file into a Server Component breaks
// React Fast Refresh for the whole app — every edit then forces a full page
// reload instead of hot-swapping. Keep UI-only constants that the layout (or
// any Server Component) needs in modules like this one.
export const TOOLTIP_DELAY_MS = 1500;
