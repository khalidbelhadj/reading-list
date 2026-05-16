// Inline script that runs before paint to apply the user's saved theme,
// avoiding a flash of incorrect theme. Kept as a single-line constant so
// its SHA-256 hash matches the inline <script> body byte-for-byte.
// Referenced by both app/layout.tsx and next.config.ts.
export const THEME_BOOTSTRAP_SCRIPT = `(function(){var t=localStorage.getItem("theme");var d=t==="dark"||(!t&&matchMedia("(prefers-color-scheme:dark)").matches);if(d)document.documentElement.classList.add("dark");})()`;
