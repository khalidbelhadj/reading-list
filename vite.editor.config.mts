import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// The markdown editor as a standalone page (editor-host/), for the native
// apps to host in a web view. `bun run build:editor` writes it into the Mac
// app's resources; `mac/scripts/bundle.sh` runs it before every build.
export default defineConfig({
  root: "editor-host",
  base: "./",
  plugins: [tsconfigPaths({ root: "." }), viteReact(), tailwindcss()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(""),
    "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify(""),
  },
  build: {
    outDir: "../mac/Sources/ReadingList/Resources/Editor",
    emptyOutDir: true,
    // Fonts and KaTeX assets as files, not data urls: the web view loads
    // them from the bundle.
    assetsInlineLimit: 0,
  },
});
