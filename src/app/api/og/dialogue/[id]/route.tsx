import { ImageResponse } from "next/og";
import { db } from "@/db";
import { dialogues, participants, reactions, turns } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const [dialogue] = await db
    .select()
    .from(dialogues)
    .where(eq(dialogues.id, params.id));

  if (!dialogue) {
    return new Response("Not found", { status: 404 });
  }

  const [challenger] = await db
    .select({ displayName: participants.displayName, type: participants.type })
    .from(participants)
    .where(eq(participants.id, dialogue.challengerId));

  const respondent = dialogue.respondentId
    ? (await db.select({ displayName: participants.displayName, type: participants.type }).from(participants).where(eq(participants.id, dialogue.respondentId)))[0]
    : null;

  const topReactions = await db
    .select({ emoji: reactions.emoji, count: sql<number>`COUNT(*)` })
    .from(reactions)
    .where(
      sql`${reactions.targetId} = ${params.id} OR ${reactions.targetId} IN (SELECT id FROM turns WHERE dialogue_id = ${params.id})`
    )
    .groupBy(reactions.emoji)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(5);

  const statusLabel = dialogue.status.replace("_", " ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#09090b",
          color: "#fafafa",
          padding: "60px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "40px",
            fontSize: "24px",
            color: "#71717a",
          }}
        >
          <span style={{ fontSize: "32px" }}>🗣️</span>
          <span style={{ fontWeight: 700, color: "#a1a1aa" }}>Dialolical</span>
        </div>

        <div
          style={{
            fontSize: "42px",
            fontWeight: 700,
            textAlign: "center",
            lineHeight: 1.2,
            maxWidth: "1000px",
            marginBottom: "32px",
          }}
        >
          &ldquo;{dialogue.proposition}&rdquo;
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: "24px",
            color: "#a1a1aa",
            marginBottom: "24px",
          }}
        >
          <span>{challenger?.displayName} ({challenger?.type})</span>
          {respondent && (
            <>
              <span style={{ color: "#52525b" }}>vs</span>
              <span>{respondent.displayName} ({respondent.type})</span>
            </>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            fontSize: "20px",
          }}
        >
          <span
            style={{
              backgroundColor: statusLabel === "concluded" ? "#3f3f46" : "#422006",
              color: statusLabel === "concluded" ? "#d4d4d8" : "#fde68a",
              padding: "4px 12px",
              borderRadius: "6px",
              fontSize: "16px",
            }}
          >
            {statusLabel}
          </span>
          <span style={{ color: "#71717a" }}>
            {dialogue.currentTurn}/{dialogue.maxTurns * 2} turns
          </span>
          {topReactions.length > 0 && (
            <span style={{ display: "flex", gap: "8px" }}>
              {topReactions.map((r) => (
                <span key={r.emoji}>{r.emoji} {r.count}</span>
              ))}
            </span>
          )}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    }
  );
}
