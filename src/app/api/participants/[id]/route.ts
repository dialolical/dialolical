import { db } from "@/db";
import { participants, dialogues, turns, reactions } from "@/db/schema";
import { eq, or, sql, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const [participant] = await db
    .select()
    .from(participants)
    .where(eq(participants.id, params.id));

  if (!participant) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const pid = params.id;

  // Dialogue counts
  const [dialogueStats] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      concluded: sql<number>`COUNT(*) FILTER (WHERE status = 'concluded')`,
    })
    .from(dialogues)
    .where(or(eq(dialogues.challengerId, pid), eq(dialogues.respondentId, pid)));

  const [turnCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(turns)
    .where(eq(turns.participantId, pid));

  // Reactions received on this participant's turns
  const receivedReactions = await db
    .select({
      emoji: reactions.emoji,
      count: sql<number>`COUNT(*)`,
    })
    .from(reactions)
    .innerJoin(turns, sql`${reactions.targetId} = ${turns.id} AND ${reactions.targetType} = 'turn'`)
    .where(eq(turns.participantId, pid))
    .groupBy(reactions.emoji)
    .orderBy(sql`COUNT(*) DESC`);

  const reactionProfile: Record<string, number> = {};
  for (const r of receivedReactions) {
    reactionProfile[r.emoji] = Number(r.count);
  }

  // "Scored by" breakdown: who scored this participant and with what
  const scoredBy = await db
    .select({
      scorerId: reactions.reactorId,
      scorerName: sql<string>`(SELECT display_name FROM participants WHERE id = ${reactions.reactorId})`,
      emoji: reactions.emoji,
      count: sql<number>`COUNT(*)`,
    })
    .from(reactions)
    .innerJoin(turns, sql`${reactions.targetId} = ${turns.id} AND ${reactions.targetType} = 'turn'`)
    .where(eq(turns.participantId, pid))
    .groupBy(reactions.reactorId, reactions.emoji)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(30);

  // Group scoredBy into { scorerId, scorerName, dimensions: { emoji: count } }
  const scorerMap = new Map<string, { scorerId: string; scorerName: string; dimensions: Record<string, number> }>();
  for (const row of scoredBy) {
    const existing = scorerMap.get(row.scorerId);
    if (existing) {
      existing.dimensions[row.emoji] = Number(row.count);
    } else {
      scorerMap.set(row.scorerId, {
        scorerId: row.scorerId,
        scorerName: row.scorerName,
        dimensions: { [row.emoji]: Number(row.count) },
      });
    }
  }

  // Recent dialogues
  const recentDialogues = await db
    .select({
      id: dialogues.id,
      proposition: dialogues.proposition,
      status: dialogues.status,
      challengerId: dialogues.challengerId,
      respondentId: dialogues.respondentId,
      createdAt: dialogues.createdAt,
    })
    .from(dialogues)
    .where(or(eq(dialogues.challengerId, pid), eq(dialogues.respondentId, pid)))
    .orderBy(desc(dialogues.createdAt))
    .limit(20);

  const dialoguesWithRole = recentDialogues.map((d) => ({
    id: d.id,
    proposition: d.proposition,
    status: d.status,
    role: d.challengerId === pid ? "challenger" : "responder",
    createdAt: d.createdAt,
  }));

  const response: Record<string, any> = { ...participant };
  delete response.apiKeyHash;

  return NextResponse.json({
    ...response,
    stats: {
      dialogues: Number(dialogueStats?.total ?? 0),
      dialoguesConcluded: Number(dialogueStats?.concluded ?? 0),
      completionRate:
        Number(dialogueStats?.total) > 0
          ? Math.round((Number(dialogueStats?.concluded ?? 0) / Number(dialogueStats?.total)) * 100)
          : 0,
      turns: Number(turnCount?.count ?? 0),
      reactionsReceived: reactionProfile,
    },
    scoredBy: Array.from(scorerMap.values()),
    recentDialogues: dialoguesWithRole,
  });
}
