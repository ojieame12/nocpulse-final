import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRateLimitHeaders,
  consumeRateLimit,
  formatRateLimitDuration,
  normalizeRateLimitIdentifier,
  resolveRequestRateLimitIp,
} from "./rateLimit";

test("resolveRequestRateLimitIp prefers the first forwarded address", () => {
  const request = new Request("https://nocpulse.test/api/auth/email", {
    headers: {
      "x-forwarded-for": "198.51.100.42, 10.0.0.1",
      "cf-connecting-ip": "203.0.113.9",
    },
  });

  assert.equal(resolveRequestRateLimitIp(request), "198.51.100.42");
});

test("resolveRequestRateLimitIp falls back to unknown without IP headers", () => {
  const request = new Request("https://nocpulse.test/api/auth/email");

  assert.equal(resolveRequestRateLimitIp(request), "unknown");
});

test("normalizeRateLimitIdentifier trims and rejects blanks", () => {
  assert.equal(normalizeRateLimitIdentifier("  farmer@example.com  "), "farmer@example.com");
  assert.equal(normalizeRateLimitIdentifier("   "), null);
});

test("formatRateLimitDuration returns user-facing retry copy", () => {
  assert.equal(formatRateLimitDuration(30), "30 seconds");
  assert.equal(formatRateLimitDuration(60), "1 minute");
  assert.equal(formatRateLimitDuration(5400), "2 hours");
});

test("buildRateLimitHeaders includes retry metadata", () => {
  const headers = buildRateLimitHeaders({
    allowed: false,
    limit: 5,
    remaining: 0,
    retryAfterSeconds: 900,
    resetAt: "2030-01-01T00:15:00.000Z",
  });

  assert.equal(headers.get("X-RateLimit-Limit"), "5");
  assert.equal(headers.get("X-RateLimit-Remaining"), "0");
  assert.equal(headers.get("Retry-After"), "900");
});

test("consumeRateLimit maps the typed RPC response", async () => {
  const client = {
    rpc(name: string, args: Record<string, unknown>) {
      assert.equal(name, "consume_rate_limit");
      assert.deepEqual(args, {
        target_scope: "auth-email:ip",
        target_identifier: "198.51.100.42",
        max_attempts: 5,
        window_seconds: 900,
      });

      return {
        async single() {
          return {
            data: {
              allowed: true,
              limit_count: 5,
              remaining_count: 4,
              retry_after_seconds: 900,
              reset_at: "2030-01-01T00:15:00.000Z",
            },
            error: null,
          };
        },
      };
    },
  } as Parameters<typeof consumeRateLimit>[0]["client"];

  const decision = await consumeRateLimit({
    client,
    scope: "auth-email:ip",
    identifier: "198.51.100.42",
    maxAttempts: 5,
    windowSeconds: 900,
  });

  assert.deepEqual(decision, {
    allowed: true,
    limit: 5,
    remaining: 4,
    retryAfterSeconds: 900,
    resetAt: "2030-01-01T00:15:00.000Z",
  });
});
