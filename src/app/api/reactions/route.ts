import { db } from "@/db";
import { reactions, participants, turns } from "@/db/schema";
import { nanoid } from "nanoid";
import { eq, sql } from "drizzle-orm";
import { resolveParticipant } from "@/lib/api-key";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

async function getScorerSnapshot(reactorId: string): Promise<string> {
  const received = await db
    .select({
      emoji: reactions.emoji,
      count: sql<number>`COUNT(*)`,
    })
    .from(reactions)
    .innerJoin(turns, sql`${reactions.targetId} = ${turns.id} AND ${reactions.targetType} = 'turn'`)
    .where(eq(turns.participantId, reactorId))
    .groupBy(reactions.emoji)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(10);

  const totalReceived = received.reduce((sum, r) => sum + Number(r.count), 0);
  const topDimensions: Record<string, number> = {};
  for (const r of received) {
    topDimensions[r.emoji] = Number(r.count);
  }

  return JSON.stringify({ totalReceived, topDimensions });
}

export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req);
  if (limited) return limited;

  const body = await req.json();
  const reactorId = (await resolveParticipant(req)) || body.reactorId;
  const { targetType, targetId, emoji } = body;

  if (!targetType || !targetId || !reactorId || !emoji) {
    return NextResponse.json(
      { error: "targetType, targetId, reactorId, and emoji are required" },
      { status: 400 }
    );
  }

  if (!["turn", "dialogue"].includes(targetType)) {
    return NextResponse.json(
      { error: "targetType must be 'turn' or 'dialogue'" },
      { status: 400 }
    );
  }

  const [reactor] = await db
    .select()
    .from(participants)
    .where(eq(participants.id, reactorId));

  if (!reactor) {
    return NextResponse.json(
      { error: "reactor not found" },
      { status: 404 }
    );
  }

  const id = nanoid(12);
  const scorerSnapshot = await getScorerSnapshot(reactorId);

  await db.insert(reactions).values({ id, targetType, targetId, reactorId, emoji, scorerSnapshot });

  return NextResponse.json({ id, targetType, targetId, emoji }, { status: 201 });
}
