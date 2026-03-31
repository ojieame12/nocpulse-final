import { NextResponse } from "next/server";
import { readJsonObject } from "../../../../server/http/json";
import {
  parseWithSchema,
  requiredTrimmedString,
  z,
} from "../../../../server/http/validation";
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
import { createServerDatabaseClient } from "../../../../server/runtime/createServerDatabaseClient";
import { RequestContextError } from "../../../../server/runtime/resolveRequestContext";

const SHARE_CONSUME_IP_RATE_LIMIT = {
  scope: "share-consume:ip",
  maxAttempts: 20,
  windowSeconds: 10 * 60,
} as const;

const ShareConsumeBodySchema = z.object({
  token: requiredTrimmedString("A share token is required."),
});

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

  if (!body) {
    return clearGuestShareCookie(
      buildJsonError(400, "Expected a JSON request body."),
    );
  }

  let payload: z.infer<typeof ShareConsumeBodySchema>;

  try {
    payload = parseWithSchema(ShareConsumeBodySchema, body);
  } catch (error) {
    if (error instanceof RequestContextError) {
      return clearGuestShareCookie(
        buildJsonError(error.status, error.message),
      );
    }

    throw error;
  }

  const token = payload.token;

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

  const client = createServerDatabaseClient(runtime);
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
