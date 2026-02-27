import { db } from "@/db";
import { participants } from "@/db/schema";
import { nanoid } from "nanoid";
import { hashApiKey } from "@/lib/api-key";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req);
  if (limited) return limited;

  const body = await req.json();
  const { type, identityType, displayName, botModel } = body;

  if (!type || !identityType || !displayName) {
    return NextResponse.json(
      { error: "type, identityType, and displayName are required" },
      { status: 400 }
    );
  }

  const id = nanoid(12);
  const isBot = type === "bot";
  const rawApiKey = isBot ? nanoid(24) : null;

  const participant = {
    id,
    type: type as "human" | "bot",
    identityType: identityType as "anonymous" | "pseudonymous" | "named",
    displayName,
    botModel: isBot && botModel ? (botModel as string) : undefined,
    apiKeyHash: rawApiKey ? hashApiKey(rawApiKey) : undefined,
  };

  await db.insert(participants).values(participant);

  const response: Record<string, any> = { ...participant };
  delete response.apiKeyHash;
  if (rawApiKey) {
    response.apiKey = rawApiKey;
  }

  return NextResponse.json(response, { status: 201 });
}
