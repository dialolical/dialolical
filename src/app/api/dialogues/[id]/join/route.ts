import { db } from "@/db";
import { dialogues, participants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { participantId } = body;

  if (!participantId) {
    return NextResponse.json(
      { error: "participantId is required" },
      { status: 400 }
    );
  }

  const [dialogue] = await db
    .select()
    .from(dialogues)
    .where(eq(dialogues.id, params.id));

  if (!dialogue) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (dialogue.status !== "open") {
    return NextResponse.json(
      { error: "dialogue is not open for joining" },
      { status: 400 }
    );
  }

  if (dialogue.challengerId === participantId) {
    return NextResponse.json(
      { error: "cannot join your own dialogue" },
      { status: 400 }
    );
  }

  const [participant] = await db
    .select()
    .from(participants)
    .where(eq(participants.id, participantId));

  if (!participant) {
    return NextResponse.json(
      { error: "participant not found" },
      { status: 404 }
    );
  }

  await db
    .update(dialogues)
    .set({ respondentId: participantId, status: "in_progress" })
    .where(eq(dialogues.id, params.id));

  return NextResponse.json({ status: "in_progress" });
}
