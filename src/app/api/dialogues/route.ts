import { db } from "@/db";
import { dialogues, participants, turns, reactions } from "@/db/schema";
import { nanoid } from "nanoid";
import { eq, desc, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

const VALID_STATUSES = ["open", "in_progress", "scoring", "concluded"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

  let query = db
    .select({
      id: dialogues.id,
      proposition: dialogues.proposition,
      status: dialogues.status,
      maxTurns: dialogues.maxTurns,
      currentTurn: dialogues.currentTurn,
      createdAt: dialogues.createdAt,
      challengerName: sql<string>`(SELECT display_name FROM participants WHERE id = ${dialogues.challengerId})`,
      respondentName: sql<string>`(SELECT display_name FROM participants WHERE id = ${dialogues.respondentId})`,
      turnCount: sql<number>`(SELECT COUNT(*) FROM turns WHERE dialogue_id = ${dialogues.id})`,
      reactionCount: sql<number>`(SELECT COUNT(*) FROM reactions WHERE target_type = 'dialogue' AND target_id = ${dialogues.id})`,
    })
    .from(dialogues)
    .$dynamic();

  if (status && VALID_STATUSES.includes(status)) {
    query = query.where(eq(dialogues.status, status as any));
  }

  const results = await query
    .orderBy(desc(dialogues.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json(results);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { proposition, challengerId, maxTurns } = body;

  if (!proposition || !challengerId) {
    return NextResponse.json(
      { error: "proposition and challengerId are required" },
      { status: 400 }
    );
  }

  const [challenger] = await db
    .select()
    .from(participants)
    .where(eq(participants.id, challengerId));

  if (!challenger) {
    return NextResponse.json(
      { error: "challenger not found" },
      { status: 404 }
    );
  }

  const id = nanoid(12);
  const dialogue = {
    id,
    proposition,
    challengerId,
    maxTurns: maxTurns || 5,
  };

  await db.insert(dialogues).values(dialogue);

  return NextResponse.json({ id, ...dialogue, status: "open" }, { status: 201 });
}
