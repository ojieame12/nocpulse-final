/**
 * notifyFieldAlerts.ts
 *
 * Given a set of newly created/escalated field alerts, resolves workspace
 * members, checks their email notification preferences, looks up their
 * emails from Supabase auth, and sends alert emails via Resend.
 *
 * This is designed to be called from within an existing worker job
 * (e.g. after the onboarding/intake job generates findings and upserts alerts),
 * not as a standalone registered job.
 */

import type { FieldAlert } from "@fieldpulse/module-alerts";
import {
  dispatchAlertNotifications,
  type NotifiableWorkspaceMember,
} from "@fieldpulse/module-alerts";
import { createSupabaseDatabaseClient } from "@fieldpulse/platform-db";
import type { WorkerJobContext } from "./jobs/contracts/WorkerJobContext";

export type NotifyFieldAlertsInput = {
  context: WorkerJobContext;
  workspaceId: string;
  /**
   * Newly created or escalated alerts to notify about.
   */
  alerts: readonly FieldAlert[];
  /**
   * Field names keyed by fieldId — for email subject/body.
   */
  fieldNames: Record<string, string>;
};

export type NotifyFieldAlertsResult = {
  skipped: boolean;
  reason?: string;
  emailsSent?: number;
  emailsFailed?: number;
};

export async function notifyFieldAlerts(
  input: NotifyFieldAlertsInput,
): Promise<NotifyFieldAlertsResult> {
  const { context, workspaceId, alerts, fieldNames } = input;
  const { runtime, logger } = context;

  if (alerts.length === 0) {
    return { skipped: true, reason: "no-alerts" };
  }

  const resendApiKey = runtime.env.email.resendApiKey;
  if (!resendApiKey) {
    logger.warn("[notifications] RESEND_API_KEY not configured — skipping alert emails");
    return { skipped: true, reason: "no-resend-api-key" };
  }

  const supabaseUrl = runtime.env.supabase.url;
  const supabaseServiceKey = runtime.env.supabase.serviceRoleKey;
  if (!supabaseUrl || !supabaseServiceKey) {
    logger.warn("[notifications] Supabase credentials not available — skipping");
    return { skipped: true, reason: "no-supabase-credentials" };
  }

  const emailFrom = runtime.env.email.from ?? "NocPulse <alerts@nocpulse.org>";
  const appOrigin = runtime.env.appUrl ?? "https://fieldpulse-v3.vercel.app";

  // Create a service-role client for membership + auth lookups
  const adminClient = createSupabaseDatabaseClient({
    url: supabaseUrl,
    serviceKey: supabaseServiceKey,
  });

  // 1. Resolve workspace members
  const membershipsResult = await adminClient
    .from("workspace_memberships")
    .select("user_id")
    .eq("workspace_id", workspaceId);

  if (membershipsResult.error || !membershipsResult.data?.length) {
    logger.warn("[notifications] workspace has no members — skipping");
    return { skipped: true, reason: "no-members" };
  }

  // 2. Resolve workspace name
  const workspaceResult = await adminClient
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .maybeSingle();

  const workspaceName = workspaceResult.data?.name ?? null;

  // 3. Resolve user emails from Supabase auth + notification preferences
  //    emailAlerts defaults to true (matching DEFAULT_WORKSPACE_SETTINGS).
  const notifiableMembers: NotifiableWorkspaceMember[] = [];

  for (const membership of membershipsResult.data) {
    const userId = membership.user_id;

    try {
      // Look up user email from Supabase auth
      const userResult = await adminClient.auth.admin.getUserById(userId);

      if (userResult.error || !userResult.data?.user?.email) {
        logger.warn(
          `[notifications] could not resolve email for user ${userId}`,
        );
        continue;
      }

      const email = userResult.data.user.email;

      // Load notification preferences (defaults to emailAlerts: true)
      let emailAlertsEnabled = true;
      try {
        const settingsResult = await adminClient
          .from("workspace_user_settings")
          .select("email_alerts")
          .eq("workspace_id", workspaceId)
          .eq("user_id", userId)
          .maybeSingle();

        if (settingsResult.data) {
          emailAlertsEnabled = settingsResult.data.email_alerts ?? true;
        }
      } catch {
        // Settings table may not exist yet — default to enabled
        emailAlertsEnabled = true;
      }

      notifiableMembers.push({
        userId,
        email,
        emailAlertsEnabled,
      });
    } catch (err) {
      logger.warn(
        `[notifications] failed to resolve member ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  if (notifiableMembers.length === 0) {
    logger.warn("[notifications] no notifiable members resolved — skipping");
    return { skipped: true, reason: "no-notifiable-members" };
  }

  // 4. Dispatch
  const result = await dispatchAlertNotifications({
    alerts,
    fieldNames,
    members: notifiableMembers,
    resendApiKey,
    emailFrom,
    appOrigin,
    workspaceName,
    logger,
  });

  logger.info(
    `[notifications] dispatched ${result.emailsSent} emails (${result.emailsFailed} failed) for ${result.alertsProcessed} alerts`,
  );

  return {
    skipped: false,
    emailsSent: result.emailsSent,
    emailsFailed: result.emailsFailed,
  };
}
