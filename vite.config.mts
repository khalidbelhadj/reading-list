import tailwindcss from "@tailwindcss/vite";
import { nitroV2Plugin } from "@tanstack/nitro-v2-vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  // Vite only exposes .env values via import.meta.env; server code (db client,
  // Supabase auth, MOCK_USER_ID) reads process.env like it did under Next, so
  // load the .env files into the process explicitly. Real environment
  // variables win over .env.local values.
  const fileEnv = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(fileEnv)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  // pdfjs (legacy build) and @napi-rs/canvas ship native or platform-specific
  // bits (.node binaries) that bundling garbles — keep them external and out
  // of the dependency optimizer in every environment (the Next config did the
  // same via serverExternalPackages).
  const nativeServerPackages = ["@napi-rs/canvas", "pdfjs-dist"];

  return {
    // Default to 3000 (CORS allowlist, extension, Electron all assume it);
    // honor PORT so tools (preview harness, electron-dev) can pin one.
    server: { port: Number(process.env.PORT ?? 3000) },
    plugins: [
      tsconfigPaths(),
      tanstackStart({ srcDirectory: "app" }),
      // Deployment adapter: wraps the server build with nitro, which
      // auto-detects the platform — on Vercel it emits the Build Output API
      // layout (one serverless function + static assets); locally it emits a
      // runnable node server in .output/. Without this, `vite build` produces
      // a bare fetch handler Vercel doesn't know how to host (404s).
      nitroV2Plugin({
        // Keep native/platform-specific packages out of the server bundle;
        // nitro traces and copies them into the output's node_modules.
        externals: { external: nativeServerPackages },
        // Pin the serverless function next to the Supabase DB (AWS eu-west-1)
        // — replaces the old Next.js `preferredRegion = "dub1"` export.
        vercel: { functions: { regions: ["dub1"] } },
      }),
      viteReact(),
      tailwindcss(),
    ],
    optimizeDeps: { exclude: nativeServerPackages },
    ssr: {
      external: nativeServerPackages,
      optimizeDeps: { exclude: nativeServerPackages },
    },
    environments: {
      server: {
        optimizeDeps: { exclude: nativeServerPackages },
      },
    },
    define: {
      // Client code reads these exact expressions; inline them at build time.
      // Server-only secrets keep flowing through process.env at runtime.
      "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      ),
      "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify(
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      ),
      "process.env.NEXT_PUBLIC_DEV_BANNER": JSON.stringify(
        process.env.NEXT_PUBLIC_DEV_BANNER ?? "",
      ),
      // Stamp the moment of the build so /debug/version can report it.
      "process.env.BUILD_TIME": JSON.stringify(new Date().toISOString()),
    },
  };
});
