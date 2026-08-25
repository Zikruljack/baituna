import { beforeEach, describe, expect, it, vi } from 'vitest';

import rateLimitMiddleware, { checkRateLimit, resetRateLimitStore } from './rate-limit';

const getRequestIP = vi.fn();
const createError = vi.fn((input: Record<string, unknown>) => Object.assign(
  new Error(String(input.statusMessage)),
  input,
));

vi.stubGlobal('getRequestIP', getRequestIP);
vi.stubGlobal('createError', createError);

describe('checkRateLimit', () => {
  beforeEach(() => {
    resetRateLimitStore();
    vi.clearAllMocks();
  });

  it('allows exactly 60 requests and blocks the 61st with a retry duration', () => {
    for (let request = 0; request < 60; request += 1) {
      expect(checkRateLimit('client-a', 60, 60_000).allowed).toBe(true);
    }

    const blocked = checkRateLimit('client-a', 60, 60_000);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('keeps separate client keys in independent buckets', () => {
    for (let request = 0; request < 60; request += 1) {
      checkRateLimit('client-a', 60, 60_000);
    }

    expect(checkRateLimit('client-a', 60, 60_000).allowed).toBe(false);
    expect(checkRateLimit('client-b', 60, 60_000).allowed).toBe(true);
  });
});

describe('rate limit middleware', () => {
  beforeEach(() => {
    resetRateLimitStore();
    vi.clearAllMocks();
    getRequestIP.mockReturnValue('203.0.113.10');
  });

  it('returns a 429 error after 60 requests to a public mosque list endpoint', () => {
    const event = { path: '/api/mosques/search' } as Parameters<typeof rateLimitMiddleware>[0];

    for (let request = 0; request < 60; request += 1) {
      expect(rateLimitMiddleware(event)).toBeUndefined();
    }

    expect(() => rateLimitMiddleware(event)).toThrow();
    expect(createError).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 429,
      statusMessage: 'Too many requests',
      data: expect.objectContaining({ retryAfterMs: expect.any(Number) }),
    }));
  });

  it('leaves non-target paths untouched', () => {
    expect(rateLimitMiddleware({ path: '/api/mosques' } as Parameters<typeof rateLimitMiddleware>[0])).toBeUndefined();
    expect(getRequestIP).not.toHaveBeenCalled();
  });
});
