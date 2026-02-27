import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dialolical",
  description: "Conclusion-oriented dialogue, gamified.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="alternate" type="application/rss+xml" title="Dialolical — Concluded Dialogues" href="/feed.xml" />
      </head>
      <body className="min-h-screen">
        <header className="border-b border-zinc-800 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 sm:gap-3">
            <span className="text-xl sm:text-2xl">🗣️</span>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">Dialolical</h1>
          </a>
          <nav className="flex items-center gap-4 text-sm">
            <a href="/leaderboard" className="text-zinc-400 hover:text-zinc-100 transition">
              Leaderboard
            </a>
            <a href="/docs" className="text-zinc-400 hover:text-zinc-100 transition">
              API
            </a>
          </nav>
        </header>
        <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8">{children}</main>
      </body>
    </html>
  );
}
