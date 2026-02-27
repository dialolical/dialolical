import { db } from "@/db";
import { dialogues } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveParticipant } from "@/lib/api-key";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const limited = checkRateLimit(req);
  if (limited) return limited;

  const body = await req.json();
  const participantId = (await resolveParticipant(req)) || body.participantId;
  const { conclusion } = body;

  if (!participantId || !conclusion) {
    return NextResponse.json(
      { error: "participantId and conclusion are required" },
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

  if (dialogue.status !== "scoring") {
    return NextResponse.json(
      { error: `dialogue is ${dialogue.status}, not scoring` },
      { status: 400 }
    );
  }

  const isChallenger = participantId === dialogue.challengerId;
  const isResponder = participantId === dialogue.respondentId;

  if (!isChallenger && !isResponder) {
    return NextResponse.json(
      { error: "only dialogue participants can submit conclusions" },
      { status: 403 }
    );
  }

  if (isChallenger && dialogue.conclusionChallenger) {
    return NextResponse.json(
      { error: "challenger has already submitted a conclusion" },
      { status: 400 }
    );
  }

  if (isResponder && dialogue.conclusionResponder) {
    return NextResponse.json(
      { error: "responder has already submitted a conclusion" },
      { status: 400 }
    );
  }

  const update: Record<string, any> = {};

  if (isChallenger) {
    update.conclusionChallenger = conclusion;
  } else {
    update.conclusionResponder = conclusion;
  }

  const otherConcluded = isChallenger
    ? dialogue.conclusionResponder
    : dialogue.conclusionChallenger;

  if (otherConcluded) {
    update.status = "concluded";
    update.concludedAt = new Date();
  }

  await db
    .update(dialogues)
    .set(update)
    .where(eq(dialogues.id, params.id));

  const [updated] = await db
    .select()
    .from(dialogues)
    .where(eq(dialogues.id, params.id));

  return NextResponse.json(updated);
}
