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
import { buildGrantAccessUrl } from "../../../server/auth/grantAccessToken";
import { getAppOrigin } from "../../../server/auth/getAppOrigin";
import { createSupabaseAdminClient } from "../../../server/auth/createSupabaseAdminClient";
import { findSupabaseAuthUserByEmail } from "../../../server/auth/workspaceAccessProvisioning";

const OWNER_NOTIFY_EMAIL = "nathan@ojieame.design";
const DEFAULT_GRANT_ACCESS_ROLE = "member" as const;

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

async function resolveGrantAccessContext(input: {
  databaseClient: ReturnType<typeof createSupabaseDatabaseClient>;
  adminClient: ReturnType<typeof createSupabaseAdminClient>;
  recipientEmail: string | null;
  explicitWorkspaceId?: string | null;
  explicitGrantedByUserId?: string | null;
}) {
  if (input.explicitWorkspaceId && input.explicitGrantedByUserId) {
    const explicitMembershipResult = await input.databaseClient
      .from("workspace_memberships")
      .select("workspace_id, user_id, role")
      .eq("workspace_id", input.explicitWorkspaceId)
      .eq("user_id", input.explicitGrantedByUserId)
      .in("role", ["owner", "manager"])
      .maybeSingle();

    if (explicitMembershipResult.error) {
      throw explicitMembershipResult.error;
    }

    if (explicitMembershipResult.data) {
      return {
        workspaceId: explicitMembershipResult.data.workspace_id,
        grantedByUserId: explicitMembershipResult.data.user_id,
        recipientEmail: input.recipientEmail,
        role: DEFAULT_GRANT_ACCESS_ROLE,
      };
    }

    console.warn(
      "[request-access] explicit review grant binding is invalid; falling back to recipient lookup",
      {
        workspaceId: input.explicitWorkspaceId,
        grantedByUserId: input.explicitGrantedByUserId,
      },
    );
  }

  if (!input.recipientEmail) {
    return null;
  }

  const recipientUser = await findSupabaseAuthUserByEmail(
    input.adminClient,
    input.recipientEmail,
  );

  if (!recipientUser) {
    return null;
  }

  const membershipResult = await input.databaseClient
    .from("workspace_memberships")
    .select("workspace_id, user_id, role, created_at")
    .eq("user_id", recipientUser.id)
    .in("role", ["owner", "manager"])
    .order("created_at", { ascending: true })
    .limit(2);

  if (membershipResult.error) {
    throw membershipResult.error;
  }

  if (membershipResult.data.length !== 1) {
    return null;
  }

  const membership = membershipResult.data[0];

  return {
    workspaceId: membership.workspace_id,
    grantedByUserId: membership.user_id,
    recipientEmail: input.recipientEmail,
    role: DEFAULT_GRANT_ACCESS_ROLE,
  };
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
      })
      .select("*")
      .single();

    if (insertResult.error || !insertResult.data) {
      return jsonError(
        500,
        insertResult.error?.message ?? "Request access insert failed.",
      );
    }

    const requestRecord = insertResult.data;
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
      const grantAccessContext = await resolveGrantAccessContext({
        databaseClient,
        adminClient,
        recipientEmail: reviewRecipientEmail,
        explicitWorkspaceId: runtime.env.requestAccess.reviewWorkspaceId,
        explicitGrantedByUserId: runtime.env.requestAccess.reviewGrantedByUserId,
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
