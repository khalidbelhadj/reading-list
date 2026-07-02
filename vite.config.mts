import tailwindcss from "@tailwindcss/vite";
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

  return {
    // Default to 3000 (CORS allowlist, extension, Electron all assume it);
    // honor PORT so tools (preview harness, electron-dev) can pin one.
    server: { port: Number(process.env.PORT ?? 3000) },
    plugins: [
      tsconfigPaths(),
      tanstackStart({ srcDirectory: "app" }),
      viteReact(),
      tailwindcss(),
    ],
    ssr: {
      // pdfjs (legacy build) and @napi-rs/canvas ship native or
      // platform-specific bits that bundling garbles — keep them external
      // (the Next config did the same via serverExternalPackages).
      external: ["@napi-rs/canvas", "pdfjs-dist"],
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
