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

type WorkspaceMembershipRow =
  DatabaseSchema["app"]["Tables"]["workspace_memberships"]["Row"];

type BootstrapWorkspaceApproval = {
  workspaceId: string;
  bootstrapOwnerUserId: string | null;
};

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

export function resolveBootstrapWorkspaceOwnerRemovals(input: {
  approvals: readonly BootstrapWorkspaceApproval[];
  memberships: readonly Pick<
    WorkspaceMembershipRow,
    "workspace_id" | "user_id" | "role"
  >[];
  claimedUserId: string;
}) {
  const approvals = input.approvals.filter(
    (approval) =>
      approval.workspaceId &&
      approval.bootstrapOwnerUserId &&
      approval.bootstrapOwnerUserId !== input.claimedUserId,
  );

  if (approvals.length === 0) {
    return [];
  }

  const membershipsByWorkspace = new Map<
    string,
    Pick<WorkspaceMembershipRow, "workspace_id" | "user_id" | "role">[]
  >();

  for (const membership of input.memberships) {
    const workspaceMemberships =
      membershipsByWorkspace.get(membership.workspace_id) ?? [];
    workspaceMemberships.push(membership);
    membershipsByWorkspace.set(membership.workspace_id, workspaceMemberships);
  }

  const removals = new Map<string, { workspaceId: string; userId: string }>();

  for (const approval of approvals) {
    const workspaceMemberships =
      membershipsByWorkspace.get(approval.workspaceId) ?? [];
    const claimedMembership = workspaceMemberships.find(
      (membership) => membership.user_id === input.claimedUserId,
    );

    if (claimedMembership?.role !== "owner") {
      continue;
    }

    const bootstrapMembership = workspaceMemberships.find(
      (membership) => membership.user_id === approval.bootstrapOwnerUserId,
    );

    if (
      !bootstrapMembership ||
      bootstrapMembership.role !== "owner" ||
      bootstrapMembership.user_id === input.claimedUserId
    ) {
      continue;
    }

    const ownerCount = workspaceMemberships.filter(
      (membership) => membership.role === "owner",
    ).length;

    if (ownerCount < 2) {
      continue;
    }

    removals.set(`${approval.workspaceId}:${bootstrapMembership.user_id}`, {
      workspaceId: approval.workspaceId,
      userId: bootstrapMembership.user_id,
    });
  }

  return [...removals.values()];
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

export async function releaseBootstrapWorkspaceOwnerMemberships(input: {
  client: DatabaseClient;
  approvals: readonly BootstrapWorkspaceApproval[];
  claimedUserId: string;
}) {
  const approvals = input.approvals.filter(
    (approval) =>
      approval.workspaceId &&
      approval.bootstrapOwnerUserId &&
      approval.bootstrapOwnerUserId !== input.claimedUserId,
  );

  if (approvals.length === 0) {
    return {
      removedCount: 0,
      removedWorkspaceIds: [],
    };
  }

  const workspaceIds = [...new Set(approvals.map((approval) => approval.workspaceId))];
  const membershipsResult = await input.client
    .from("workspace_memberships")
    .select("workspace_id, user_id, role")
    .in("workspace_id", workspaceIds);

  const memberships = requireSupabaseData(
    membershipsResult,
    "workspaceEmailProvisions.releaseBootstrap.memberships",
  );
  const removals = resolveBootstrapWorkspaceOwnerRemovals({
    approvals,
    memberships,
    claimedUserId: input.claimedUserId,
  });

  for (const removal of removals) {
    const deleteResult = await input.client
      .from("workspace_memberships")
      .delete()
      .eq("workspace_id", removal.workspaceId)
      .eq("user_id", removal.userId);

    requireSupabaseSuccess(
      deleteResult,
      "workspaceEmailProvisions.releaseBootstrap.delete",
    );
  }

  return {
    removedCount: removals.length,
    removedWorkspaceIds: removals.map((removal) => removal.workspaceId),
  };
}
