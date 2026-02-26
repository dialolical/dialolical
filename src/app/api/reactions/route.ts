import { db } from "@/db";
import { reactions, participants } from "@/db/schema";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { targetType, targetId, reactorId, emoji } = body;

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

  await db.insert(reactions).values({ id, targetType, targetId, reactorId, emoji });

  return NextResponse.json({ id, targetType, targetId, emoji }, { status: 201 });
}
