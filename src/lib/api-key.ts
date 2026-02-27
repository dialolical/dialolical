import { createHash } from "crypto";
import { db } from "@/db";
import { participants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function resolveParticipant(
  req: NextRequest
): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;

  const raw = auth.slice(7);
  const hash = hashApiKey(raw);

  const [participant] = await db
    .select({ id: participants.id })
    .from(participants)
    .where(eq(participants.apiKeyHash, hash));

  return participant?.id ?? null;
}
