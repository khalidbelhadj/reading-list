// Inline script that runs before paint to apply the user's saved theme and
// full-width preference, avoiding a visual flash on hydration. Allowed by CSP
// via the per-request nonce set in middleware.ts.
export const THEME_BOOTSTRAP_SCRIPT = `(function(){var t=localStorage.getItem("theme");var d=t==="dark"||(!t&&matchMedia("(prefers-color-scheme:dark)").matches);if(d)document.documentElement.classList.add("dark");if(localStorage.getItem("full-width")==="1")document.documentElement.classList.add("full-width");})()`;
