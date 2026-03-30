import { createSupabaseDatabaseClient } from "@fieldpulse/platform-db";
import { jsonError, jsonOk, readJsonObject } from "../../../server/http/json";
import {
  normalizeRequestAccessSubmission,
  renderRequestAccessNotificationEmail,
  RequestAccessSubmissionError,
  resolveRequestAccessNotificationRecipients,
} from "../../../server/auth/requestAccess";
import {
  consumeRateLimit,
  formatRateLimitDuration,
  jsonRateLimitError,
  resolveRequestRateLimitIp,
} from "../../../server/auth/rateLimit";
import { getWebServerRuntime } from "../../../server/runtime/getWebServerRuntime";

const REQUEST_ACCESS_IP_RATE_LIMIT = {
  scope: "request-access:ip",
  maxAttempts: 5,
  windowSeconds: 60 * 60,
} as const;

const REQUEST_ACCESS_EMAIL_RATE_LIMIT = {
  scope: "request-access:email",
  maxAttempts: 3,
  windowSeconds: 24 * 60 * 60,
} as const;

async function sendRequestAccessNotification(input: {
  resendApiKey: string;
  from: string;
  to: readonly string[];
  submission: ReturnType<typeof normalizeRequestAccessSubmission>;
}) {
  const { Resend } = await import("resend");
  const resend = new Resend(input.resendApiKey);
  const { subject, html, text } = renderRequestAccessNotificationEmail(
    input.submission,
  );
  const result = await resend.emails.send({
    from: input.from,
    to: [...input.to],
    subject,
    html,
    text,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }
}

export async function POST(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonError(400, "Expected a JSON request body.");
  }

  try {
    const submission = normalizeRequestAccessSubmission(body);
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const databaseClient = createSupabaseDatabaseClient({
      url: runtime.env.supabase.url!,
      serviceKey: runtime.env.supabase.serviceRoleKey!,
    });
    const ipRateLimit = await consumeRateLimit({
      client: databaseClient,
      scope: REQUEST_ACCESS_IP_RATE_LIMIT.scope,
      identifier: resolveRequestRateLimitIp(request),
      maxAttempts: REQUEST_ACCESS_IP_RATE_LIMIT.maxAttempts,
      windowSeconds: REQUEST_ACCESS_IP_RATE_LIMIT.windowSeconds,
    });

    if (!ipRateLimit.allowed) {
      return jsonRateLimitError(
        `Too many access requests have been submitted from this network. Wait ${formatRateLimitDuration(ipRateLimit.retryAfterSeconds)} and try again.`,
        ipRateLimit,
      );
    }

    const emailRateLimit = await consumeRateLimit({
      client: databaseClient,
      scope: REQUEST_ACCESS_EMAIL_RATE_LIMIT.scope,
      identifier: submission.email,
      maxAttempts: REQUEST_ACCESS_EMAIL_RATE_LIMIT.maxAttempts,
      windowSeconds: REQUEST_ACCESS_EMAIL_RATE_LIMIT.windowSeconds,
    });

    if (!emailRateLimit.allowed) {
      return jsonRateLimitError(
        `Too many access requests have been submitted for this email. Wait ${formatRateLimitDuration(emailRateLimit.retryAfterSeconds)} and try again.`,
        emailRateLimit,
      );
    }

    const insertResult = await databaseClient
      .from("request_access_requests")
      .insert({
        name: submission.name,
        email: submission.email,
        farm_name: submission.farmName,
        acreage: submission.acreage,
        message: submission.message,
      });

    if (insertResult.error) {
      return jsonError(500, insertResult.error.message);
    }

    const recipients = resolveRequestAccessNotificationRecipients(
      runtime.env.requestAccess.notifyEmail,
    );
    let notificationSent = false;

    if (runtime.env.email.resendApiKey && recipients.length > 0) {
      try {
        await sendRequestAccessNotification({
          resendApiKey: runtime.env.email.resendApiKey,
          from: runtime.env.email.from,
          to: recipients,
          submission,
        });
        notificationSent = true;
      } catch (error) {
        console.error("[request-access] notification failed:", error);
      }
    }

    return jsonOk(
      {
        ok: true,
        result: {
          email: submission.email,
          notificationSent,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    if (error instanceof RequestAccessSubmissionError) {
      return jsonError(error.status, error.message);
    }

    return jsonError(
      500,
      error instanceof Error
        ? error.message
        : "Request access submission failed.",
    );
  }
}
