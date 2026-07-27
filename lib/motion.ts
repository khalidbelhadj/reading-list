// Shared motion constants for the app's sliding panels (the item panel and
// the reading panel). They live here rather than in one of the panels because
// the two have to agree: they sit side by side, share the same gap, and slide
// with the same curve — a panel importing these from its sibling made the
// dependency point the wrong way.

// The panels' easing curve. Fast out, long settle — matches the system-feel
// of a sheet coming to rest rather than a linear slide.
export const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

// Inset between a floating panel and the viewport edge, and between two
// adjacent panels. Also the width of the gap their resize handles straddle.
export const SLIDE_OFFSET = 8;

// Slide-in/out duration for a panel entering or leaving.
export const SLIDE_MS = 300;
