type RateLimitResult = {
  allowed: boolean;
  retryAfterMs: number;
};

type Bucket = {
  count: number;
  startedAt: number;
};

const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.startedAt >= windowMs) {
    buckets.set(key, { count: 1, startedAt: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.count < limit) {
    bucket.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  }

  return {
    allowed: false,
    retryAfterMs: Math.max(1, windowMs - (now - bucket.startedAt)),
  };
}

export function resetRateLimitStore(): void {
  buckets.clear();
}

const LIMITED_PATHS = new Set(['/api/mosques/nearby', '/api/mosques/search']);
const REQUEST_LIMIT = 60;
const WINDOW_MS = 60_000;

export default function rateLimitMiddleware(event: Parameters<typeof getRequestIP>[0]): void {
  if (!LIMITED_PATHS.has(event.path)) {
    return;
  }

  const key = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
  const result = checkRateLimit(key, REQUEST_LIMIT, WINDOW_MS);

  if (!result.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many requests',
      data: { retryAfterMs: result.retryAfterMs },
    });
  }
}
