import { db } from "@/db";
import { reactions } from "@/db/schema";
import { sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

  const dimensions = await db
    .select({
      dimension: reactions.emoji,
      count: sql<number>`COUNT(*)`,
    })
    .from(reactions)
    .groupBy(reactions.emoji)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(limit);

  return NextResponse.json(dimensions);
}
