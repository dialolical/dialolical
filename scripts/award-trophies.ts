/**
 * Backfill trophies for all concluded dialogues that don't have them yet.
 *
 * Usage:
 *   npx tsx scripts/award-trophies.ts
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/db/schema";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sqlClient = neon(process.env.DATABASE_URL, {
  fetchOptions: { cache: "no-store" },
});
const db = drizzle(sqlClient, { schema });

async function main() {
  console.log("Finding concluded dialogues without trophies...\n");

  const concluded = await db
    .select()
    .from(schema.dialogues)
    .where(eq(schema.dialogues.status, "concluded"));

  let awarded = 0;

  for (const dialogue of concluded) {
    // Check if trophies already exist
    const existing = await db
      .select({ id: schema.trophies.id })
      .from(schema.trophies)
      .where(eq(schema.trophies.dialogueId, dialogue.id))
      .limit(1);

    if (existing.length > 0) continue;

    const participantIds = [dialogue.challengerId, dialogue.respondentId].filter(Boolean) as string[];
    if (participantIds.length < 2) continue;

    const results = await Promise.all(
      participantIds.map(async (pid) => {
        const emojiCounts = await db
          .select({
            emoji: schema.reactions.emoji,
            count: sql<number>`COUNT(*)`,
          })
          .from(schema.reactions)
          .innerJoin(
            schema.turns,
            sql`${schema.reactions.targetId} = ${schema.turns.id} AND ${schema.reactions.targetType} = 'turn'`
          )
          .where(sql`${schema.turns.dialogueId} = ${dialogue.id} AND ${schema.turns.participantId} = ${pid}`)
          .groupBy(schema.reactions.emoji)
          .orderBy(sql`COUNT(*) DESC`);

        const total = emojiCounts.reduce((sum, r) => sum + Number(r.count), 0);
        const emojis = emojiCounts.map((r) => ({
          emoji: r.emoji,
          count: Number(r.count),
        }));

        return { pid, emojis, total };
      })
    );

    const sorted = [...results].sort((a, b) => b.total - a.total);
    const winnerId = sorted[0].total > sorted[1].total ? sorted[0].pid : null;

    for (const { pid, emojis } of results) {
      await db.insert(schema.trophies).values({
        id: nanoid(12),
        participantId: pid,
        dialogueId: dialogue.id,
        type: winnerId === pid ? "winner" : "participant",
        emojis: JSON.stringify(emojis),
        title: dialogue.proposition,
      });
    }

    awarded++;
    console.log(`  Awarded trophies for: "${dialogue.proposition.slice(0, 50)}..." (${dialogue.id})`);
  }

  console.log(`\nDone! Awarded trophies for ${awarded} dialogue(s).`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
