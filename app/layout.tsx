import type { Metadata } from "next";
import { Suspense } from "react";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/noto-sans";
import "@fontsource-variable/source-serif-4";
import "./globals.css";
import { QueryProvider } from "@/components/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

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
            __html: `(function(){var t=localStorage.getItem("theme");var d=t==="dark"||(!t&&matchMedia("(prefers-color-scheme:dark)").matches);if(d)document.documentElement.classList.add("dark");var m={"dm-sans":'"DM Sans Variable", sans-serif',"noto-sans":'"Noto Sans Variable", sans-serif',"source-serif-4":'"Source Serif 4 Variable", serif'};var s=localStorage.getItem("font-sans");if(s&&m[s])document.documentElement.style.setProperty("--font-sans",m[s]);var c=localStorage.getItem("font-content");if(c&&m[c])document.documentElement.style.setProperty("--font-content",m[c]);})()`,
          }}
        />
      </head>
      <body className="font-sans bg-background text-foreground">
        <Suspense>
          <QueryProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </QueryProvider>
        </Suspense>
        <Toaster />
      </body>
    </html>
  );
}
