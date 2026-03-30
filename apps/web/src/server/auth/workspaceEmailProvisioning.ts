import {
  requireSupabaseData,
  requireSupabaseSuccess,
  type DatabaseClient,
  type DatabaseSchema,
} from "@fieldpulse/platform-db";
import type { WorkspaceRole } from "@fieldpulse/module-workspaces";

type WorkspaceEmailProvisionRow =
  DatabaseSchema["app"]["Tables"]["workspace_email_provisions"]["Row"];

type WorkspaceMembershipInsert =
  DatabaseSchema["app"]["Tables"]["workspace_memberships"]["Insert"];

export function normalizeWorkspaceProvisionEmail(email: string) {
  return email.trim().toLowerCase();
}

export function buildWorkspaceProvisionMembershipRows(
  provisions: readonly WorkspaceEmailProvisionRow[],
  userId: string,
  claimedAt: string,
): WorkspaceMembershipInsert[] {
  return provisions.map((provision) => ({
    workspace_id: provision.workspace_id,
    user_id: userId,
    role: provision.role,
    invited_by: provision.created_by,
    created_at: claimedAt,
  }));
}

export async function listWorkspaceEmailProvisionsByEmail(
  client: DatabaseClient,
  email: string,
) {
  const normalizedEmail = normalizeWorkspaceProvisionEmail(email);

  if (!normalizedEmail) {
    return [];
  }

  const result = await client
    .from("workspace_email_provisions")
    .select("*")
    .eq("email", normalizedEmail)
    .order("created_at", { ascending: true });

  return requireSupabaseData(
    result,
    "workspaceEmailProvisions.listByEmail",
  );
}

export async function upsertWorkspaceEmailProvision(input: {
  client: DatabaseClient;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  createdBy: string | null;
}) {
  const normalizedEmail = normalizeWorkspaceProvisionEmail(input.email);
  const result = await input.client
    .from("workspace_email_provisions")
    .upsert(
      {
        workspace_id: input.workspaceId,
        email: normalizedEmail,
        role: input.role,
        created_by: input.createdBy,
        claimed_by: null,
        claimed_at: null,
      },
      {
        onConflict: "workspace_id,email",
      },
    )
    .select("*")
    .single();

  return requireSupabaseData(
    result,
    "workspaceEmailProvisions.upsert",
  );
}

export async function claimWorkspaceEmailProvisions(input: {
  client: DatabaseClient;
  email: string;
  userId: string;
}) {
  const normalizedEmail = normalizeWorkspaceProvisionEmail(input.email);

  if (!normalizedEmail) {
    return {
      claimedCount: 0,
      claimedWorkspaceIds: [],
    };
  }

  const allProvisions = await listWorkspaceEmailProvisionsByEmail(
    input.client,
    normalizedEmail,
  );
  const unclaimedProvisions = allProvisions.filter(
    (provision) => provision.claimed_at == null,
  );

  if (unclaimedProvisions.length === 0) {
    return {
      claimedCount: 0,
      claimedWorkspaceIds: [],
    };
  }

  const claimedAt = new Date().toISOString();
  const claimedWorkspaceIds = unclaimedProvisions.map(
    (provision) => provision.workspace_id,
  );
  const membershipUpsertResult = await input.client
    .from("workspace_memberships")
    .upsert(
      buildWorkspaceProvisionMembershipRows(
        unclaimedProvisions,
        input.userId,
        claimedAt,
      ),
      {
        onConflict: "workspace_id,user_id",
      },
    );

  requireSupabaseSuccess(
    membershipUpsertResult,
    "workspaceEmailProvisions.claim.memberships",
  );

  const claimResult = await input.client
    .from("workspace_email_provisions")
    .update({
      claimed_by: input.userId,
      claimed_at: claimedAt,
    })
    .eq("email", normalizedEmail)
    .in("workspace_id", claimedWorkspaceIds)
    .is("claimed_at", null);

  requireSupabaseSuccess(
    claimResult,
    "workspaceEmailProvisions.claim.update",
  );

  return {
    claimedCount: unclaimedProvisions.length,
    claimedWorkspaceIds,
  };
}
