import { jsonError, jsonOk, readJsonObject } from "../../../../server/http/json";
import { createAdminSupabaseClient } from "../../../../server/auth/createAdminSupabaseClient";
import { renderMagicLinkEmail } from "../../../../server/auth/magicLinkEmail";
import { getAppOrigin } from "../../../../server/auth/getAppOrigin";
import {
  consumeRateLimit,
  formatRateLimitDuration,
  jsonRateLimitError,
  resolveRequestRateLimitIp,
} from "../../../../server/auth/rateLimit";
import { sanitizeNextPath } from "../../../../server/auth/sanitizeNextPath";
import { resolveEmailSignInPolicy } from "../../../../server/auth/emailSignInEligibility";
import { readAppEnv } from "@fieldpulse/platform-config";
import { createSupabaseDatabaseClient } from "@fieldpulse/platform-db";

const AUTH_EMAIL_IP_RATE_LIMIT = {
  scope: "auth-email:ip",
  maxAttempts: 5,
  windowSeconds: 15 * 60,
} as const;

const AUTH_EMAIL_ADDRESS_RATE_LIMIT = {
  scope: "auth-email:email",
  maxAttempts: 3,
  windowSeconds: 15 * 60,
} as const;

/**
 * POST /api/auth/email
 *
 * Generates a magic link via Supabase admin API and sends a branded
 * NocPulse email via Resend (or falls back to Supabase's default OTP
 * flow if Resend is not configured).
 */
export async function POST(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonError(400, "Expected a JSON request body.");
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const allowSignup =
    typeof body.allowSignup === "boolean" ? body.allowSignup : true;
  const nextPath = sanitizeNextPath(body.next, "/preview");

  if (!email) {
    return jsonError(400, "Field `email` is required.");
  }

  const env = readAppEnv(process.env);
  const resendApiKey = env.email.resendApiKey;

  if (!env.supabase.url || !env.supabase.serviceRoleKey) {
    return jsonError(500, "Email sign-in is not configured.");
  }

  const databaseClient = createSupabaseDatabaseClient({
    url: env.supabase.url,
    serviceKey: env.supabase.serviceRoleKey,
  });
  const ipRateLimit = await consumeRateLimit({
    client: databaseClient,
    scope: AUTH_EMAIL_IP_RATE_LIMIT.scope,
    identifier: resolveRequestRateLimitIp(request),
    maxAttempts: AUTH_EMAIL_IP_RATE_LIMIT.maxAttempts,
    windowSeconds: AUTH_EMAIL_IP_RATE_LIMIT.windowSeconds,
  });

  if (!ipRateLimit.allowed) {
    return jsonRateLimitError(
      `Too many sign-in attempts from this network. Wait ${formatRateLimitDuration(ipRateLimit.retryAfterSeconds)} and try again.`,
      ipRateLimit,
    );
  }

  const emailRateLimit = await consumeRateLimit({
    client: databaseClient,
    scope: AUTH_EMAIL_ADDRESS_RATE_LIMIT.scope,
    identifier: email.toLowerCase(),
    maxAttempts: AUTH_EMAIL_ADDRESS_RATE_LIMIT.maxAttempts,
    windowSeconds: AUTH_EMAIL_ADDRESS_RATE_LIMIT.windowSeconds,
  });

  if (!emailRateLimit.allowed) {
    return jsonRateLimitError(
      `Too many sign-in links have been requested for this email. Wait ${formatRateLimitDuration(emailRateLimit.retryAfterSeconds)} and try again.`,
      emailRateLimit,
    );
  }

  // ── Custom pipeline: admin generateLink + Resend ──
  if (resendApiKey && env.supabase.serviceRoleKey) {
    try {
      const callbackUrl = new URL("/auth/callback", getAppOrigin(request));
      callbackUrl.searchParams.set("next", nextPath);

      const access = await resolveEmailSignInPolicy({
        supabaseUrl: env.supabase.url,
        serviceRoleKey: env.supabase.serviceRoleKey,
        email,
      });

      if (!access.canRequestSignIn || (access.shouldCreateUser && !allowSignup)) {
        return jsonError(
          404,
          "This email has not been provisioned for NocPulse yet.",
        );
      }

      const admin = createAdminSupabaseClient();

      const result = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });

      if (result.error) {
        return jsonError(400, result.error.message);
      }

      const tokenHash = result.data.properties?.hashed_token;
      const verificationType = result.data.properties?.verification_type;

      if (!tokenHash || !verificationType) {
        return jsonError(500, "Supabase did not return a verifiable email token.");
      }

      const magicLink = new URL("/auth/callback", getAppOrigin(request));
      magicLink.searchParams.set("next", nextPath);
      magicLink.searchParams.set("token_hash", tokenHash);
      magicLink.searchParams.set("type", verificationType);

      // Send branded email via Resend
      const { Resend } = await import("resend");
      const resend = new Resend(resendApiKey);
      const { subject, html } = renderMagicLinkEmail({
        magicLink: magicLink.toString(),
        email,
      });

      const sendResult = await resend.emails.send({
        from: env.email.from,
        to: email,
        subject,
        html,
      });

      if (sendResult.error) {
        console.error("[auth/email] Resend error:", sendResult.error);
        return jsonError(500, "Failed to send sign-in email.");
      }

      return jsonOk({ ok: true, email, next: nextPath, provider: "resend" });
    } catch (error) {
      console.error("[auth/email] Custom pipeline error:", error);
      return jsonError(
        500,
        error instanceof Error ? error.message : "Email sign-in failed.",
      );
    }
  }

  // ── Fallback: Supabase default OTP email ──
  try {
    const { createRouteHandlerSupabaseClient } = await import(
      "../../../../server/auth/createRouteHandlerSupabaseClient"
    );
    const access = await resolveEmailSignInPolicy({
      supabaseUrl: env.supabase.url,
      serviceRoleKey: env.supabase.serviceRoleKey,
      email,
    });

    if (!access.canRequestSignIn || (access.shouldCreateUser && !allowSignup)) {
      return jsonError(
        404,
        "This email has not been provisioned for NocPulse yet.",
      );
    }

    const callbackUrl = new URL("/auth/callback", getAppOrigin(request));
    callbackUrl.searchParams.set("next", nextPath);
    const { client } = createRouteHandlerSupabaseClient(request);
    const result = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl.toString(),
        shouldCreateUser: access.shouldCreateUser,
      },
    });

    if (result.error) {
      return jsonError(400, result.error.message);
    }

    return jsonOk({ ok: true, email, next: nextPath, provider: "supabase" });
  } catch (error) {
    return jsonError(
      500,
      error instanceof Error ? error.message : "Email sign-in failed.",
    );
  }
}
