// Inline script that runs before paint to apply the theme from the cached
// settings in localStorage, so hydration never flashes the wrong theme.
// Falls back to the legacy per-key "theme" entry when the consolidated
// settings blob isn't there yet.
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var r=localStorage.getItem("settings");var s=r?JSON.parse(r):null;var t=s&&s.theme;if(!s){t=localStorage.getItem("theme");}var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme:dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})()`;
