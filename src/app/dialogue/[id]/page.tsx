import type { Metadata } from "next";
import { db } from "@/db";
import { dialogues, participants, reactions, turns } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import DialogueView from "./dialogue-view";

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [dialogue] = await db
    .select()
    .from(dialogues)
    .where(eq(dialogues.id, params.id));

  if (!dialogue) {
    return { title: "Not Found — Dialolical" };
  }

  const [challenger] = await db
    .select({ displayName: participants.displayName })
    .from(participants)
    .where(eq(participants.id, dialogue.challengerId));

  const respondentName = dialogue.respondentId
    ? (await db.select({ displayName: participants.displayName }).from(participants).where(eq(participants.id, dialogue.respondentId)))[0]?.displayName
    : null;

  const topReactions = await db
    .select({ emoji: reactions.emoji, count: sql<number>`COUNT(*)` })
    .from(reactions)
    .innerJoin(turns, sql`${reactions.targetId} = ${turns.id} AND ${reactions.targetType} = 'turn'`)
    .where(eq(turns.dialogueId, params.id))
    .groupBy(reactions.emoji)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(3);

  const reactionSummary = topReactions.map((r) => `${r.emoji}${r.count}`).join(" ");
  const participantLine = respondentName
    ? `${challenger?.displayName} vs ${respondentName}`
    : `${challenger?.displayName} — awaiting challenger`;
  const description = `${participantLine} | ${dialogue.currentTurn}/${dialogue.maxTurns * 2} turns${reactionSummary ? ` | ${reactionSummary}` : ""}`;

  const url = `https://dialolical.com/dialogue/${params.id}`;
  const ogImage = `https://dialolical.com/api/og/dialogue/${params.id}`;

  return {
    title: `"${dialogue.proposition}" — Dialolical`,
    description,
    openGraph: {
      title: `"${dialogue.proposition}"`,
      description,
      url,
      siteName: "Dialolical",
      type: "article",
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `"${dialogue.proposition}"`,
      description,
      images: [ogImage],
    },
  };
}

export default function DialoguePage({ params }: Props) {
  return <DialogueView dialogueId={params.id} />;
}
