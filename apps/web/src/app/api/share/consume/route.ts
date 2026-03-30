import { NextResponse } from "next/server";
import { createSupabaseDatabaseClient } from "@fieldpulse/platform-db";
import { readJsonObject } from "../../../../server/http/json";
import {
  GUEST_SHARE_COOKIE_NAME,
  buildGuestShareCookieAttributes,
  buildGuestShareCookiePayload,
  buildGuestShareCookieValue,
  lookupWorkspaceShareToken,
  touchWorkspaceShareToken,
} from "../../../../server/auth/guestShareSession";
import {
  buildRateLimitHeaders,
  consumeRateLimit,
  formatRateLimitDuration,
  resolveRequestRateLimitIp,
} from "../../../../server/auth/rateLimit";
import { getWebServerRuntime } from "../../../../server/runtime/getWebServerRuntime";

const SHARE_CONSUME_IP_RATE_LIMIT = {
  scope: "share-consume:ip",
  maxAttempts: 20,
  windowSeconds: 10 * 60,
} as const;

function buildJsonError(status: number, message: string) {
  return NextResponse.json(
    {
      error: {
        message,
      },
    },
    {
      status,
    },
  );
}

function clearGuestShareCookie(response: NextResponse) {
  response.cookies.set(GUEST_SHARE_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });

  return response;
}

export async function POST(request: Request) {
  const body = await readJsonObject(request);
  const token = typeof body?.token === "string" ? body.token.trim() : "";

  if (!token) {
    return clearGuestShareCookie(
      buildJsonError(400, "A share token is required."),
    );
  }

  const runtime = getWebServerRuntime();

  if (runtime.mode !== "supabase") {
    return clearGuestShareCookie(
      buildJsonError(503, "Supabase runtime is not configured."),
    );
  }

  const client = createSupabaseDatabaseClient({
    url: runtime.env.supabase.url!,
    serviceKey: runtime.env.supabase.serviceRoleKey!,
  });
  const ipRateLimit = await consumeRateLimit({
    client,
    scope: SHARE_CONSUME_IP_RATE_LIMIT.scope,
    identifier: resolveRequestRateLimitIp(request),
    maxAttempts: SHARE_CONSUME_IP_RATE_LIMIT.maxAttempts,
    windowSeconds: SHARE_CONSUME_IP_RATE_LIMIT.windowSeconds,
  });

  if (!ipRateLimit.allowed) {
    return clearGuestShareCookie(
      NextResponse.json(
        {
          error: {
            message: `Too many shared-link attempts. Wait ${formatRateLimitDuration(ipRateLimit.retryAfterSeconds)} and try again.`,
            details: {
              retryAfterSeconds: ipRateLimit.retryAfterSeconds,
              resetAt: ipRateLimit.resetAt,
            },
          },
        },
        {
          status: 429,
          headers: buildRateLimitHeaders(ipRateLimit),
        },
      ),
    );
  }

  const lookup = await lookupWorkspaceShareToken({
    client,
    token,
  });

  if (lookup.status === "invalid") {
    return clearGuestShareCookie(
      buildJsonError(404, "This shared link is not valid."),
    );
  }

  if (lookup.status === "expired" || lookup.status === "revoked") {
    return clearGuestShareCookie(
      buildJsonError(410, "This shared link has expired."),
    );
  }

  await touchWorkspaceShareToken({
    client,
    shareId: lookup.share.id,
  });

  const response = NextResponse.json({
    result: {
      previewPath: "/preview",
      fieldId: lookup.share.fieldId,
      expiresAt: lookup.share.expiresAt,
    },
  });

  response.cookies.set(
    GUEST_SHARE_COOKIE_NAME,
    buildGuestShareCookieValue(
      buildGuestShareCookiePayload(token, lookup.share.expiresAt),
    ),
    buildGuestShareCookieAttributes(lookup.share.expiresAt),
  );

  return response;
}
