// Inline script that runs before paint to apply theme and full-width from the
// settings blob in localStorage, avoiding a visual flash on hydration. Allowed
// by CSP via the per-request nonce set in middleware.ts.
//
// Falls back to the legacy per-key entries ("theme", "full-width") when the
// settings blob is missing, so users upgrading from the previous storage
// format don't see a flash on their first load.
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var r=localStorage.getItem("settings");var s=r?JSON.parse(r):null;var t=s&&s.theme;var f=s&&s.fullWidth;if(!s){t=localStorage.getItem("theme");f=localStorage.getItem("full-width")==="1";}var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme:dark)").matches);if(d)document.documentElement.classList.add("dark");if(f)document.documentElement.classList.add("full-width");}catch(e){}})()`;
