import type { WorkspaceRole } from "@fieldpulse/module-workspaces";
import { getAppOrigin } from "./getAppOrigin";
import { createSupabasePublicAuthClient } from "./createSupabasePublicAuthClient";
import { renderWorkspaceInviteEmail } from "./workspaceInviteEmail";
import { createSupabaseAdminClient } from "./createSupabaseAdminClient";

export type WorkspaceAccessDeliveryStatus = "sent" | "manual-signin";

export type WorkspaceAccessDeliveryResult = {
  status: WorkspaceAccessDeliveryStatus;
  message: string;
};

async function sendCustomWorkspaceAccessEmail(input: {
  adminClient: ReturnType<typeof createSupabaseAdminClient>;
  resendApiKey: string;
  emailFrom: string;
  email: string;
  workspaceName?: string | null;
  role: WorkspaceRole;
  grantedByEmail?: string | null;
  redirectTo: string;
}) {
  const linkResult = await input.adminClient.auth.admin.generateLink({
    type: "magiclink",
    email: input.email,
    options: {
      redirectTo: input.redirectTo,
    },
  });

  if (linkResult.error) {
    throw linkResult.error;
  }

  const magicLink = linkResult.data.properties?.action_link;

  if (!magicLink) {
    throw new Error("Supabase did not return a workspace invite link.");
  }

  const { Resend } = await import("resend");
  const resend = new Resend(input.resendApiKey);
  const { subject, html } = renderWorkspaceInviteEmail({
    magicLink,
    email: input.email,
    workspaceName: input.workspaceName,
    role: input.role,
    grantedByEmail: input.grantedByEmail,
  });
  const sendResult = await resend.emails.send({
    from: input.emailFrom,
    to: input.email,
    subject,
    html,
  });

  if (sendResult.error) {
    throw new Error(sendResult.error.message);
  }
}

async function sendFallbackWorkspaceAccessEmail(input: {
  email: string;
  redirectTo: string;
}) {
  const client = createSupabasePublicAuthClient();
  const result = await client.auth.signInWithOtp({
    email: input.email,
    options: {
      emailRedirectTo: input.redirectTo,
      shouldCreateUser: false,
    },
  });

  if (result.error) {
    throw result.error;
  }
}

export async function deliverWorkspaceAccessEmail(input: {
  request: Request;
  adminClient: ReturnType<typeof createSupabaseAdminClient>;
  email: string;
  workspaceName?: string | null;
  role: WorkspaceRole;
  grantedByEmail?: string | null;
  resendApiKey?: string | null;
  emailFrom: string;
}) {
  const callbackUrl = new URL("/auth/callback", getAppOrigin(input.request));
  callbackUrl.searchParams.set("next", "/");

  if (input.resendApiKey) {
    try {
      await sendCustomWorkspaceAccessEmail({
        adminClient: input.adminClient,
        resendApiKey: input.resendApiKey,
        emailFrom: input.emailFrom,
        email: input.email,
        workspaceName: input.workspaceName,
        role: input.role,
        grantedByEmail: input.grantedByEmail,
        redirectTo: callbackUrl.toString(),
      });

      return {
        status: "sent" as const,
        message: `Access granted and an invite email was sent to ${input.email}.`,
      };
    } catch (error) {
      console.error(
        "[settings/access] Custom workspace invite email failed:",
        error,
      );
    }
  }

  try {
    await sendFallbackWorkspaceAccessEmail({
      email: input.email,
      redirectTo: callbackUrl.toString(),
    });

    return {
      status: "sent" as const,
      message: `Access granted and a sign-in email was sent to ${input.email}.`,
    };
  } catch (error) {
    console.error(
      "[settings/access] Fallback workspace invite email failed:",
      error,
    );

    return {
      status: "manual-signin" as const,
      message:
        "Access granted, but the invite email could not be delivered. Ask this teammate to use the standard sign-in form with the same email address.",
    };
  }
}
