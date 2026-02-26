import { db } from "@/db";
import { dialogues, turns } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { participantId, content } = body;

  if (!participantId || !content) {
    return NextResponse.json(
      { error: "participantId and content are required" },
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

  if (dialogue.status !== "in_progress") {
    return NextResponse.json(
      { error: `dialogue is ${dialogue.status}, not in_progress` },
      { status: 400 }
    );
  }

  const isChallengeTurn = dialogue.currentTurn % 2 === 0;
  const expectedParticipant = isChallengeTurn
    ? dialogue.challengerId
    : dialogue.respondentId;

  if (participantId !== expectedParticipant) {
    return NextResponse.json(
      { error: "not your turn" },
      { status: 400 }
    );
  }

  const turnId = nanoid(12);
  const turnNumber = dialogue.currentTurn;

  await db.insert(turns).values({
    id: turnId,
    dialogueId: params.id,
    participantId,
    content,
    turnNumber,
  });

  const newTurn = dialogue.currentTurn + 1;
  const maxReached = newTurn >= dialogue.maxTurns * 2;

  await db
    .update(dialogues)
    .set({
      currentTurn: newTurn,
      status: maxReached ? "scoring" : "in_progress",
    })
    .where(eq(dialogues.id, params.id));

  return NextResponse.json(
    {
      id: turnId,
      turnNumber,
      dialogueStatus: maxReached ? "scoring" : "in_progress",
    },
    { status: 201 }
  );
}
