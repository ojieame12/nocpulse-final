import type { ServerRuntime } from "@fieldpulse/platform-runtime";
import { createServerDatabaseClient } from "../runtime/createServerDatabaseClient";
import {
  consumeRateLimit,
  formatRateLimitDuration,
  jsonRateLimitError,
  resolveRequestRateLimitIp,
} from "./rateLimit";

type SupabaseRuntime = Extract<ServerRuntime, { mode: "supabase" }>;

export type RouteRateLimitRule = {
  scope: string;
  identifier: string;
  maxAttempts: number;
  windowSeconds: number;
  message: string;
};

export async function enforceRouteRateLimits(input: {
  runtime: SupabaseRuntime;
  rules: readonly RouteRateLimitRule[];
}) {
  if (input.rules.length === 0) {
    return null;
  }

  const client = createServerDatabaseClient(input.runtime);

  for (const rule of input.rules) {
    const decision = await consumeRateLimit({
      client,
      scope: rule.scope,
      identifier: rule.identifier,
      maxAttempts: rule.maxAttempts,
      windowSeconds: rule.windowSeconds,
    });

    if (!decision.allowed) {
      return jsonRateLimitError(
        `${rule.message} Wait ${formatRateLimitDuration(decision.retryAfterSeconds)} and try again.`,
        decision,
      );
    }
  }

  return null;
}

export function buildActorRateLimitIdentifier(input: {
  workspaceId: string;
  userId: string;
  resourceId?: string | null;
}) {
  return [
    input.workspaceId.trim(),
    input.userId.trim(),
    input.resourceId?.trim() ?? null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(":");
}

export function buildIpRateLimitRule(input: {
  request: Request;
  scope: string;
  maxAttempts: number;
  windowSeconds: number;
  message: string;
}): RouteRateLimitRule {
  const { request, ...rule } = input;

  return {
    ...rule,
    identifier: resolveRequestRateLimitIp(request),
  };
}
