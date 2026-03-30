import type { DatabaseClient } from "@fieldpulse/platform-db";

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: string;
};

export function normalizeRateLimitIdentifier(value: string | null | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, 256);
}

export function resolveRequestRateLimitIp(request: Pick<Request, "headers">) {
  const headerCandidates = [
    request.headers.get("x-vercel-forwarded-for"),
    request.headers.get("x-forwarded-for"),
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-real-ip"),
  ];

  for (const candidate of headerCandidates) {
    const value = normalizeRateLimitIdentifier(candidate?.split(",")[0] ?? null);

    if (value) {
      return value;
    }
  }

  return "unknown";
}

export function formatRateLimitDuration(seconds: number) {
  if (seconds < 60) {
    return `${Math.max(1, seconds)} second${seconds === 1 ? "" : "s"}`;
  }

  const minutes = Math.ceil(seconds / 60);

  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

export function buildRateLimitHeaders(decision: RateLimitDecision) {
  const headers = new Headers({
    "X-RateLimit-Limit": String(decision.limit),
    "X-RateLimit-Remaining": String(decision.remaining),
    "X-RateLimit-Reset": String(
      Math.max(0, Math.ceil(Date.parse(decision.resetAt) / 1000)),
    ),
  });

  if (!decision.allowed) {
    headers.set("Retry-After", String(decision.retryAfterSeconds));
  }

  return headers;
}

export function jsonRateLimitError(
  message: string,
  decision: RateLimitDecision,
) {
  return Response.json(
    {
      error: {
        message,
        details: {
          retryAfterSeconds: decision.retryAfterSeconds,
          resetAt: decision.resetAt,
        },
      },
    },
    {
      status: 429,
      headers: buildRateLimitHeaders(decision),
    },
  );
}

export async function consumeRateLimit(input: {
  client: DatabaseClient;
  scope: string;
  identifier: string;
  maxAttempts: number;
  windowSeconds: number;
}) {
  const identifier = normalizeRateLimitIdentifier(input.identifier);

  if (!identifier) {
    throw new Error("Rate limit identifier is required.");
  }

  const result = await input.client
    .rpc("consume_rate_limit", {
      target_scope: input.scope,
      target_identifier: identifier,
      max_attempts: input.maxAttempts,
      window_seconds: input.windowSeconds,
    })
    .single();

  if (result.error || !result.data) {
    throw result.error ?? new Error("Rate limit check failed.");
  }

  return {
    allowed: result.data.allowed,
    limit: result.data.limit_count,
    remaining: result.data.remaining_count,
    retryAfterSeconds: result.data.retry_after_seconds,
    resetAt: result.data.reset_at,
  } satisfies RateLimitDecision;
}
