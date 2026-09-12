import type { Metadata } from "next";
import "./globals.css";
import "@/liveblocks.config";

export const metadata: Metadata = {
  title: "Cural",
  description: "Align on architecture, then kick off Cursor cloud agents.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-paper font-sans text-ink">{children}</body>
    </html>
  );
}
