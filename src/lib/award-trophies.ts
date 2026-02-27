import { db } from "@/db";
import { trophies, reactions, turns, dialogues } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function awardTrophiesForDialogue(dialogueId: string) {
  const [dialogue] = await db
    .select()
    .from(dialogues)
    .where(eq(dialogues.id, dialogueId));

  if (!dialogue || dialogue.status !== "concluded") return;

  // Check if trophies already awarded
  const existing = await db
    .select({ id: trophies.id })
    .from(trophies)
    .where(eq(trophies.dialogueId, dialogueId))
    .limit(1);

  if (existing.length > 0) return;

  const participantIds = [dialogue.challengerId, dialogue.respondentId].filter(Boolean) as string[];
  if (participantIds.length < 2) return;

  // Get emoji breakdown for each participant's turns in this dialogue
  const results = await Promise.all(
    participantIds.map(async (pid) => {
      const emojiCounts = await db
        .select({
          emoji: reactions.emoji,
          count: sql<number>`COUNT(*)`,
        })
        .from(reactions)
        .innerJoin(
          turns,
          sql`${reactions.targetId} = ${turns.id} AND ${reactions.targetType} = 'turn'`
        )
        .where(sql`${turns.dialogueId} = ${dialogueId} AND ${turns.participantId} = ${pid}`)
        .groupBy(reactions.emoji)
        .orderBy(sql`COUNT(*) DESC`);

      const total = emojiCounts.reduce((sum, r) => sum + Number(r.count), 0);
      const emojis = emojiCounts.map((r) => ({
        emoji: r.emoji,
        count: Number(r.count),
      }));

      return { pid, emojis, total };
    })
  );

  // Determine winner (most reactions) or tie
  const sorted = [...results].sort((a, b) => b.total - a.total);
  const winnerId = sorted[0].total > sorted[1].total ? sorted[0].pid : null;

  for (const { pid, emojis } of results) {
    await db.insert(trophies).values({
      id: nanoid(12),
      participantId: pid,
      dialogueId,
      type: winnerId === pid ? "winner" : "participant",
      emojis: JSON.stringify(emojis),
      title: dialogue.proposition,
    });
  }
}
