import type { FieldAlert } from "../contracts/FieldAlert";
import { renderFieldAlertEmail } from "./renderFieldAlertEmail";

/**
 * A workspace member with an email address.
 * Typically resolved from workspace_memberships + Supabase auth.admin.getUserById.
 */
export type NotifiableWorkspaceMember = {
  userId: string;
  email: string;
  emailAlertsEnabled: boolean;
};

export type DispatchAlertNotificationsInput = {
  /**
   * Newly created or escalated alerts to notify about.
   * Only `active` alerts with status that just changed should be passed.
   */
  alerts: readonly FieldAlert[];
  /**
   * Field names keyed by fieldId — used for email subject and body.
   */
  fieldNames: Record<string, string>;
  /**
   * Workspace members who could receive notifications.
   * The function filters by `emailAlertsEnabled`.
   */
  members: readonly NotifiableWorkspaceMember[];
  /**
   * Resend API key for sending.
   */
  resendApiKey: string;
  /**
   * Sender address, e.g. "NocPulse <alerts@nocpulse.org>".
   */
  emailFrom: string;
  /**
   * App origin for field detail links, e.g. "https://fieldpulse-v3.vercel.app".
   */
  appOrigin: string;
  /**
   * Workspace name for email footer context.
   */
  workspaceName?: string | null;
  /**
   * Optional logger.
   */
  logger?: {
    info(message: string): void;
    warn(message: string): void;
    error(message: string, error?: unknown): void;
  };
};

export type DispatchAlertNotificationsResult = {
  alertsProcessed: number;
  emailsSent: number;
  emailsFailed: number;
  details: readonly {
    alertId: string;
    fieldId: string;
    recipientEmail: string;
    status: "sent" | "failed";
    error?: string;
  }[];
};

export async function dispatchAlertNotifications(
  input: DispatchAlertNotificationsInput,
): Promise<DispatchAlertNotificationsResult> {
  const {
    alerts,
    fieldNames,
    members,
    resendApiKey,
    emailFrom,
    appOrigin,
    workspaceName,
    logger,
  } = input;

  const eligibleMembers = members.filter((m) => m.emailAlertsEnabled);

  if (eligibleMembers.length === 0) {
    logger?.info("[notifications] no members with email alerts enabled — skipping");
    return { alertsProcessed: alerts.length, emailsSent: 0, emailsFailed: 0, details: [] };
  }

  if (alerts.length === 0) {
    return { alertsProcessed: 0, emailsSent: 0, emailsFailed: 0, details: [] };
  }

  // Dynamic import to avoid requiring resend at module load time
  const { Resend } = await import("resend");
  const resend = new Resend(resendApiKey);

  const details: DispatchAlertNotificationsResult["details"][number][] = [];
  let emailsSent = 0;
  let emailsFailed = 0;

  for (const alert of alerts) {
    const fieldName = fieldNames[alert.fieldId] ?? "Unknown Field";

    const { subject, html } = renderFieldAlertEmail({
      alert,
      fieldName,
      workspaceName,
      appOrigin,
      fieldId: alert.fieldId,
    });

    for (const member of eligibleMembers) {
      try {
        const sendResult = await resend.emails.send({
          from: emailFrom,
          to: member.email,
          subject,
          html,
        });

        if (sendResult.error) {
          throw new Error(sendResult.error.message);
        }

        logger?.info(
          `[notifications] sent alert email: "${alert.title}" → ${member.email}`,
        );
        details.push({
          alertId: alert.id,
          fieldId: alert.fieldId,
          recipientEmail: member.email,
          status: "sent",
        });
        emailsSent++;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : String(err);
        logger?.error(
          `[notifications] failed to send alert email to ${member.email}: ${errorMessage}`,
          err,
        );
        details.push({
          alertId: alert.id,
          fieldId: alert.fieldId,
          recipientEmail: member.email,
          status: "failed",
          error: errorMessage,
        });
        emailsFailed++;
      }
    }
  }

  return {
    alertsProcessed: alerts.length,
    emailsSent,
    emailsFailed,
    details,
  };
}
