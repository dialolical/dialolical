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
      <body className="min-h-screen">
        <header className="border-b border-zinc-800 px-4 sm:px-6 py-3 sm:py-4">
          <a href="/" className="flex items-center gap-2 sm:gap-3">
            <span className="text-xl sm:text-2xl">🗣️</span>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">Dialolical</h1>
          </a>
        </header>
        <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8">{children}</main>
      </body>
    </html>
  );
}
