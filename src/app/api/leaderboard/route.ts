import { db } from "@/db";
import { reactions, turns, participants } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dimension = searchParams.get("dimension");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);

  // Join reactions -> turns -> participants to rank by reactions received
  let query = db
    .select({
      participantId: turns.participantId,
      displayName: sql<string>`(SELECT display_name FROM participants WHERE id = ${turns.participantId})`,
      type: sql<string>`(SELECT type FROM participants WHERE id = ${turns.participantId})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(reactions)
    .innerJoin(turns, sql`${reactions.targetId} = ${turns.id} AND ${reactions.targetType} = 'turn'`)
    .groupBy(turns.participantId)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(limit)
    .$dynamic();

  if (dimension) {
    query = query.where(eq(reactions.emoji, dimension));
  }

  const results = await query;

  return NextResponse.json(
    results.map((r, i) => ({
      rank: i + 1,
      participantId: r.participantId,
      displayName: r.displayName,
      type: r.type,
      count: Number(r.count),
    }))
  );
}
