import { db } from "@/db";
import { trophies } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const results = await db
    .select()
    .from(trophies)
    .where(eq(trophies.participantId, params.id))
    .orderBy(desc(trophies.awardedAt));

  return NextResponse.json(results);
}
