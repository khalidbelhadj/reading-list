import type { Metadata } from "next";
import { Suspense } from "react";
import "@fontsource-variable/inter";
import "@fontsource-variable/lora";
import "@fontsource-variable/crimson-pro";
import "@fontsource-variable/source-serif-4";
import "./globals.css";
import { QueryProvider } from "@/components/query-provider";
import { StoreHydrator } from "@/components/store-hydrator";
import { DebugPanel } from "@/components/debug-panel";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Reading List",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme:dark)").matches))document.documentElement.classList.add("dark")})()`,
          }}
        />
      </head>
      <body className="font-sans bg-background text-foreground">
        <DebugPanel />
        <Suspense>
          <QueryProvider>
            <StoreHydrator />
            {children}
          </QueryProvider>
        </Suspense>
        <Toaster />
      </body>
    </html>
  );
}
