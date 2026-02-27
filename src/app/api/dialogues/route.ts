import { db } from "@/db";
import { dialogues, participants, turns, reactions } from "@/db/schema";
import { nanoid } from "nanoid";
import { eq, desc, sql } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["open", "in_progress", "scoring", "concluded"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

  const did = sql.raw(`"dialogues"."id"`);
  const cid = sql.raw(`"dialogues"."challenger_id"`);
  const rid = sql.raw(`"dialogues"."respondent_id"`);

  let query = db
    .select({
      id: dialogues.id,
      proposition: dialogues.proposition,
      status: dialogues.status,
      maxTurns: dialogues.maxTurns,
      currentTurn: dialogues.currentTurn,
      createdAt: dialogues.createdAt,
      challengerId: dialogues.challengerId,
      challengerName: sql<string>`(SELECT display_name FROM participants WHERE id = ${cid})`,
      respondentId: dialogues.respondentId,
      respondentName: sql<string>`(SELECT display_name FROM participants WHERE id = ${rid})`,
      turnCount: sql<number>`(SELECT COUNT(*) FROM turns WHERE dialogue_id = ${did})`,
      reactionCount: sql<number>`(SELECT COUNT(*) FROM reactions WHERE target_id = ${did} OR target_id IN (SELECT id FROM turns WHERE dialogue_id = ${did}))`,
      topReactions: sql<string>`(SELECT string_agg(sub.emoji || ':' || sub.cnt, ',') FROM (SELECT emoji, COUNT(*)::text as cnt FROM reactions WHERE target_id = ${did} OR target_id IN (SELECT id FROM turns WHERE dialogue_id = ${did}) GROUP BY emoji ORDER BY COUNT(*) DESC LIMIT 5) sub)`,
    })
    .from(dialogues)
    .$dynamic();

  if (status && VALID_STATUSES.includes(status)) {
    query = query.where(eq(dialogues.status, status as any));
  }

  const sort = searchParams.get("sort");
  if (sort === "most_scored") {
    query = query.orderBy(sql`(SELECT COUNT(*) FROM reactions WHERE target_id = ${did} OR target_id IN (SELECT id FROM turns WHERE dialogue_id = ${did})) DESC`);
  } else {
    query = query.orderBy(desc(dialogues.createdAt));
  }

  const results = await query
    .limit(limit)
    .offset(offset);

  return NextResponse.json(results);
}

export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req);
  if (limited) return limited;

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
    maxTurns: maxTurns || 3,
  };

  await db.insert(dialogues).values(dialogue);

  return NextResponse.json({ ...dialogue, status: "open" }, { status: 201 });
}
