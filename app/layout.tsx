import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/lora";
import "@fontsource-variable/crimson-pro";
import "@fontsource-variable/source-serif-4";
import "./globals.css";
import { QueryProvider } from "@/components/query-provider";
import { FontPicker } from "@/components/font-picker";

export const metadata: Metadata = {
  title: "Reading List",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans bg-background text-foreground">
        <FontPicker />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
