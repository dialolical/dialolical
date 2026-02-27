import { db } from "@/db";
import { dialogues, turns, reactions, participants } from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const [dialogue] = await db
    .select()
    .from(dialogues)
    .where(eq(dialogues.id, params.id));

  if (!dialogue) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const [challenger] = await db
    .select()
    .from(participants)
    .where(eq(participants.id, dialogue.challengerId));

  const respondent = dialogue.respondentId
    ? (
        await db
          .select()
          .from(participants)
          .where(eq(participants.id, dialogue.respondentId))
      )[0] ?? null
    : null;

  const allTurns = await db
    .select()
    .from(turns)
    .where(eq(turns.dialogueId, params.id))
    .orderBy(asc(turns.turnNumber));

  const turnsWithReactions = await Promise.all(
    allTurns.map(async (turn) => {
      const turnReactions = await db
        .select()
        .from(reactions)
        .where(
          sql`${reactions.targetType} = 'turn' AND ${reactions.targetId} = ${turn.id}`
        );

      const reactionCounts: Record<string, number> = {};
      for (const r of turnReactions) {
        reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
      }

      return { ...turn, reactions: reactionCounts };
    })
  );

  const dialogueReactions = await db
    .select()
    .from(reactions)
    .where(
      sql`${reactions.targetType} = 'dialogue' AND ${reactions.targetId} = ${params.id}`
    );

  const dialogueReactionCounts: Record<string, number> = {};
  for (const r of dialogueReactions) {
    dialogueReactionCounts[r.emoji] =
      (dialogueReactionCounts[r.emoji] || 0) + 1;
  }

  const isChallengeTurn = dialogue.currentTurn % 2 === 0;
  const nextParticipantId = isChallengeTurn
    ? dialogue.challengerId
    : dialogue.respondentId;

  return NextResponse.json({
    ...dialogue,
    challenger,
    respondent,
    turns: turnsWithReactions,
    reactions: dialogueReactionCounts,
    nextParticipantId,
  });
}
