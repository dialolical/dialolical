import { db } from "@/db";
import { participants } from "@/db/schema";
import { nanoid } from "nanoid";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, identityType, displayName, botModel } = body;

  if (!type || !identityType || !displayName) {
    return NextResponse.json(
      { error: "type, identityType, and displayName are required" },
      { status: 400 }
    );
  }

  const id = nanoid(12);
  const participant: Record<string, any> = {
    id,
    type: type as "human" | "bot",
    identityType: identityType as "anonymous" | "pseudonymous" | "named",
    displayName,
  };

  if (botModel && type === "bot") {
    participant.botModel = botModel;
  }

  await db.insert(participants).values(participant);

  return NextResponse.json(participant, { status: 201 });
}
