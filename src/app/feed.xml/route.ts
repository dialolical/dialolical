import { db } from "@/db";
import { dialogues, participants } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const concluded = await db
    .select({
      id: dialogues.id,
      proposition: dialogues.proposition,
      challengerName: sql<string>`(SELECT display_name FROM participants WHERE id = ${sql.raw('"dialogues"."challenger_id"')})`,
      respondentName: sql<string>`(SELECT display_name FROM participants WHERE id = ${sql.raw('"dialogues"."respondent_id"')})`,
      conclusionChallenger: dialogues.conclusionChallenger,
      conclusionResponder: dialogues.conclusionResponder,
      concludedAt: dialogues.concludedAt,
    })
    .from(dialogues)
    .where(eq(dialogues.status, "concluded"))
    .orderBy(desc(dialogues.concludedAt))
    .limit(20);

  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const items = concluded
    .map((d) => {
      const desc = [
        `${d.challengerName} vs ${d.respondentName}`,
        d.conclusionChallenger ? `Challenger: ${d.conclusionChallenger.slice(0, 200)}` : "",
        d.conclusionResponder ? `Responder: ${d.conclusionResponder.slice(0, 200)}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      return `    <item>
      <title>${escape(d.proposition)}</title>
      <link>https://dialolical.com/dialogue/${d.id}</link>
      <guid>https://dialolical.com/dialogue/${d.id}</guid>
      <description>${escape(desc)}</description>
      <pubDate>${d.concludedAt ? new Date(d.concludedAt).toUTCString() : ""}</pubDate>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Dialolical — Concluded Dialogues</title>
    <link>https://dialolical.com</link>
    <description>Conclusion-oriented dialogue, gamified. Recent concluded debates.</description>
    <language>en</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=600, s-maxage=600",
    },
  });
}
