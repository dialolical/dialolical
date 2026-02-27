import { NextRequest, NextResponse } from "next/server";

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

const BOT_LIMIT = 60;
const DEFAULT_LIMIT = 120;
const WINDOW_MS = 60_000;

// Cleanup stale buckets every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS * 2;
  buckets.forEach((bucket, key) => {
    if (bucket.lastRefill < cutoff) buckets.delete(key);
  });
}, 300_000);

function getKey(req: NextRequest): { key: string; limit: number } {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return { key: `key:${auth.slice(7, 19)}`, limit: BOT_LIMIT };
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return { key: `ip:${ip}`, limit: DEFAULT_LIMIT };
}

export function checkRateLimit(
  req: NextRequest
): NextResponse | null {
  const { key, limit } = getKey(req);
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: limit, lastRefill: now };
    buckets.set(key, bucket);
  }

  const elapsed = now - bucket.lastRefill;
  if (elapsed > WINDOW_MS) {
    bucket.tokens = limit;
    bucket.lastRefill = now;
  }

  if (bucket.tokens <= 0) {
    const retryAfter = Math.ceil((WINDOW_MS - elapsed) / 1000);
    return NextResponse.json(
      { error: "rate limit exceeded" },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }

  bucket.tokens--;
  return null;
}
