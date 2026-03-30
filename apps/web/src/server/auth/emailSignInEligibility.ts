import {
  createSupabaseDatabaseClient,
  requireSupabaseSuccess,
} from "@fieldpulse/platform-db";
import { createSupabaseAdminClient } from "./createSupabaseAdminClient";
import {
  listWorkspaceEmailProvisionsByEmail,
  normalizeWorkspaceProvisionEmail,
} from "./workspaceEmailProvisioning";
import { findSupabaseAuthUserByEmail } from "./workspaceAccessProvisioning";

export function deriveEmailSignInPolicy(input: {
  hasProvision: boolean;
  hasWorkspaceMembership: boolean;
}) {
  return {
    canRequestSignIn: input.hasProvision || input.hasWorkspaceMembership,
    shouldCreateUser: input.hasProvision,
  };
}

export async function resolveEmailSignInPolicy(input: {
  supabaseUrl: string;
  serviceRoleKey: string;
  email: string;
}) {
  const normalizedEmail = normalizeWorkspaceProvisionEmail(input.email);
  const adminClient = createSupabaseAdminClient({
    url: input.supabaseUrl,
    serviceRoleKey: input.serviceRoleKey,
  });
  const databaseClient = createSupabaseDatabaseClient({
    url: input.supabaseUrl,
    serviceKey: input.serviceRoleKey,
  });
  const [provisions, existingUser] = await Promise.all([
    listWorkspaceEmailProvisionsByEmail(databaseClient, normalizedEmail),
    findSupabaseAuthUserByEmail(adminClient, normalizedEmail),
  ]);

  let hasWorkspaceMembership = false;

  if (existingUser) {
    const membershipResult = await databaseClient
      .from("workspace_memberships")
      .select("workspace_id", {
        count: "exact",
        head: true,
      })
      .eq("user_id", existingUser.id);

    requireSupabaseSuccess(
      membershipResult,
      "emailSignInEligibility.workspaceMemberships",
    );
    hasWorkspaceMembership = (membershipResult.count ?? 0) > 0;
  }

  const derived = deriveEmailSignInPolicy({
    hasProvision: provisions.length > 0,
    hasWorkspaceMembership,
  });

  return {
    normalizedEmail,
    existingUserId: existingUser?.id ?? null,
    hasProvision: provisions.length > 0,
    hasWorkspaceMembership,
    ...derived,
  };
}
