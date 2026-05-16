import type { Metadata } from "next";
import { Suspense } from "react";
import "@fontsource-variable/dm-sans";
import "./globals.css";
import { QueryProvider } from "@/components/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider, TOOLTIP_DELAY_MS } from "@/components/ui/tooltip";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme-bootstrap";

export const metadata: Metadata = {
  title: "Reading List",
};

const RootLayout = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
        />
      </head>
      <body className="font-sans bg-background text-foreground">
        <Suspense>
          <QueryProvider>
            <TooltipProvider delay={TOOLTIP_DELAY_MS}>{children}</TooltipProvider>
          </QueryProvider>
        </Suspense>
        <Toaster />
      </body>
    </html>
  );
};

export default RootLayout;
