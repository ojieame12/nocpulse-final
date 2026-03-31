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
import { buildGrantAccessUrl } from "../../../server/auth/grantAccessToken";
import { getAppOrigin } from "../../../server/auth/getAppOrigin";
import { createSupabaseAdminClient } from "../../../server/auth/createSupabaseAdminClient";
import {
  createRequestAccessRecord,
  resolveSingleGrantAccessContext,
} from "../../../server/auth/requestAccessRepository";
import { createServerDatabaseClient } from "../../../server/runtime/createServerDatabaseClient";

const OWNER_NOTIFY_EMAIL = "nathan@ojieame.design";
const DEFAULT_GRANT_ACCESS_ROLE = "owner" as const;

const REQUEST_ACCESS_IP_RATE_LIMIT = {
  scope: "request-access:ip",
  maxAttempts: 8,
  windowSeconds: 15 * 60,
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
  reviewAccessUrl?: string;
}) {
  const { Resend } = await import("resend");
  const resend = new Resend(input.resendApiKey);
  const { subject, html, text } = renderRequestAccessNotificationEmail(
    input.submission,
    input.reviewAccessUrl,
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

    const databaseClient = createServerDatabaseClient(runtime);
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

    const requestRecord = await createRequestAccessRecord({
      client: databaseClient,
      submission,
    });
    const envRecipients = resolveRequestAccessNotificationRecipients(
      runtime.env.requestAccess.notifyEmail,
    );
    const recipients = envRecipients.length > 0
      ? envRecipients
      : [OWNER_NOTIFY_EMAIL];
    const reviewRecipientEmail = recipients.length === 1 ? recipients[0] : null;
    const adminClient = createSupabaseAdminClient({
      url: runtime.env.supabase.url!,
      serviceRoleKey: runtime.env.supabase.serviceRoleKey!,
    });

    let reviewAccessUrl: string | undefined;

    try {
      const grantAccessContext = await resolveSingleGrantAccessContext({
        client: databaseClient,
        adminClient,
        recipientEmail: reviewRecipientEmail,
        explicitWorkspaceId: runtime.env.requestAccess.reviewWorkspaceId,
        explicitGrantedByUserId: runtime.env.requestAccess.reviewGrantedByUserId,
        role: DEFAULT_GRANT_ACCESS_ROLE,
      });

      if (grantAccessContext) {
        reviewAccessUrl = buildGrantAccessUrl({
          appOrigin: getAppOrigin(request),
          secret: runtime.env.supabase.serviceRoleKey!,
          payload: {
            requestId: requestRecord.id,
            requestEmail: submission.email,
            workspaceId: grantAccessContext.workspaceId,
            grantedByUserId: grantAccessContext.grantedByUserId,
            role: grantAccessContext.role,
            recipientEmail: grantAccessContext.recipientEmail,
          },
        });
      }
    } catch (error) {
      console.warn("[request-access] could not build review-access URL", error);
    }

    let notificationSent = false;

    if (runtime.env.email.resendApiKey && recipients.length > 0) {
      try {
        await sendRequestAccessNotification({
          resendApiKey: runtime.env.email.resendApiKey,
          from: runtime.env.email.from,
          to: recipients,
          submission,
          reviewAccessUrl,
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
          requestId: requestRecord.id,
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
