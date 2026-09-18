import { NextResponse } from "next/server";

/** Process-local burst protection. Use a shared store (Redis/Upstash/platform
 * limiter) in multi-instance production; this is not a provider quota. */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(req: Request, scope: string, max: number, windowMs: number) {
  const forwarded = req.headers.get("x-forwarded-for");
  const client = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anonymous";
  const key = `${scope}:${client}`;
  const now = Date.now();
  const saved = buckets.get(key);
  const bucket = !saved || saved.resetAt <= now ? { count: 0, resetAt: now + windowMs } : saved;
  bucket.count += 1;
  buckets.set(key, bucket);
  if (bucket.count <= max) return null;
  return NextResponse.json({ error: "Muitas solicitações. Aguarde um instante e tente novamente." }, {
    status: 429,
    headers: { "Retry-After": String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))) },
  });
}

export function safeError(error: unknown) {
  return error instanceof Error
    ? error.message.replace(/(api[_-]?key|authorization|bearer)\s*[:=]\s*[^\s,]+/gi, "$1=[redacted]")
    : "erro desconhecido";
}
