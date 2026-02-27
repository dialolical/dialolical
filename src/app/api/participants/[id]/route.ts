import { db } from "@/db";
import { participants, dialogues, turns, reactions } from "@/db/schema";
import { eq, or, sql } from "drizzle-orm";
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

  const [dialogueCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(dialogues)
    .where(
      or(
        eq(dialogues.challengerId, params.id),
        eq(dialogues.respondentId, params.id)
      )
    );

  const [turnCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(turns)
    .where(eq(turns.participantId, params.id));

  const receivedReactions = await db
    .select({
      emoji: reactions.emoji,
      count: sql<number>`COUNT(*)`,
    })
    .from(reactions)
    .innerJoin(turns, sql`${reactions.targetId} = ${turns.id} AND ${reactions.targetType} = 'turn'`)
    .where(eq(turns.participantId, params.id))
    .groupBy(reactions.emoji)
    .orderBy(sql`COUNT(*) DESC`);

  const reactionProfile: Record<string, number> = {};
  for (const r of receivedReactions) {
    reactionProfile[r.emoji] = r.count;
  }

  return NextResponse.json({
    ...participant,
    stats: {
      dialogues: dialogueCount?.count ?? 0,
      turns: turnCount?.count ?? 0,
      reactionsReceived: reactionProfile,
    },
  });
}
