import "@/app/globals.css";

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-0">
        <main className="p-4">{children}</main>
      </body>
    </html>
  );
}
