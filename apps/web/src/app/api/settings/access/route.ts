import { canManageWorkspace } from "@fieldpulse/module-auth";
import {
  createSupabaseWorkspaceMembershipRepository,
  createSupabaseWorkspaceRepository,
} from "@fieldpulse/module-workspaces";
import { createSupabaseDatabaseClient } from "@fieldpulse/platform-db";
import {
  canChangeWorkspaceMemberRole,
  canRemoveWorkspaceMember,
  isValidWorkspaceAccessEmail,
  listAllowedWorkspaceMemberRoleChanges,
  listAllowedWorkspaceInviteRoles,
  normalizeWorkspaceAccessEmail,
  normalizeWorkspaceMemberRoleChange,
  normalizeWorkspaceInviteRole,
} from "../../../../features/settings/workspaceAccess";
import { jsonError, jsonOk, readJsonObject } from "../../../../server/http/json";
import { getWebServerRuntime } from "../../../../server/runtime/getWebServerRuntime";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../../server/runtime/resolveRequestContext";
import { createSupabaseAdminClient } from "../../../../server/auth/createSupabaseAdminClient";
import {
  findSupabaseAuthUserByEmail,
  loadSupabaseAuthUsersById,
} from "../../../../server/auth/workspaceAccessProvisioning";
import { upsertWorkspaceEmailProvision } from "../../../../server/auth/workspaceEmailProvisioning";

function readRequestedWorkspaceId(
  request: Request,
  body?: Record<string, unknown> | null,
) {
  const { searchParams } = new URL(request.url);
  const queryWorkspaceId = searchParams.get("workspaceId")?.trim();

  if (queryWorkspaceId) {
    return queryWorkspaceId;
  }

  const bodyWorkspaceId =
    typeof body?.workspaceId === "string" ? body.workspaceId.trim() : "";

  return bodyWorkspaceId || null;
}

function readInviteEmail(body: Record<string, unknown>) {
  const email = normalizeWorkspaceAccessEmail(body.email);

  if (!email) {
    throw new RequestContextError(400, "An email address is required.");
  }

  if (!isValidWorkspaceAccessEmail(email)) {
    throw new RequestContextError(400, "Enter a valid email address.");
  }

  return email;
}

function readMemberUserId(body: Record<string, unknown>) {
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";

  if (!userId) {
    throw new RequestContextError(400, "A member identifier is required.");
  }

  return userId;
}

async function loadWorkspaceAccessState(input: {
  actor: {
    userId: string;
    role: "owner" | "manager" | "member" | "viewer";
    workspaceId: string;
  };
  workspaceRepository: ReturnType<typeof createSupabaseWorkspaceRepository>;
  workspaceMemberships: ReturnType<
    typeof createSupabaseWorkspaceMembershipRepository
  >;
  adminClient: ReturnType<typeof createSupabaseAdminClient>;
}) {
  const [workspace, memberships] = await Promise.all([
    input.workspaceRepository.getById(input.actor.workspaceId),
    input.workspaceMemberships.listByWorkspace(input.actor.workspaceId),
  ]);
  const userDirectory = await loadSupabaseAuthUsersById(
    input.adminClient,
    memberships.flatMap((membership) =>
      membership.invitedBy
        ? [membership.userId, membership.invitedBy]
        : [membership.userId],
    ),
  );

  return {
    workspaceId: input.actor.workspaceId,
    workspaceName: workspace?.name ?? null,
    actorRole: input.actor.role,
    canManageAccess: canManageWorkspace(input.actor),
    allowedInviteRoles: listAllowedWorkspaceInviteRoles(input.actor.role),
    members: memberships.map((membership) => ({
      userId: membership.userId,
      email: userDirectory.get(membership.userId)?.email ?? null,
      role: membership.role,
      createdAt: membership.createdAt,
      invitedByUserId: membership.invitedBy,
      invitedByEmail: membership.invitedBy
        ? (userDirectory.get(membership.invitedBy)?.email ?? null)
        : null,
      isCurrentActor: membership.userId === input.actor.userId,
      canChangeRole: canChangeWorkspaceMemberRole(
        input.actor.role,
        membership.role,
        membership.userId === input.actor.userId,
      ),
      canRemove: canRemoveWorkspaceMember(
        input.actor.role,
        membership.role,
        membership.userId === input.actor.userId,
      ),
      allowedRoleChanges: listAllowedWorkspaceMemberRoleChanges(
        input.actor.role,
        membership.role,
        membership.userId === input.actor.userId,
      ),
    })),
  };
}

export async function GET(request: Request) {
  try {
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const requestedWorkspaceId = readRequestedWorkspaceId(request);
    const actor = await resolveRequestActor(request, runtime, {
      preferredWorkspaceId: requestedWorkspaceId,
    });
    const databaseClient = createSupabaseDatabaseClient({
      url: runtime.env.supabase.url!,
      serviceKey: runtime.env.supabase.serviceRoleKey!,
    });
    const accessState = await loadWorkspaceAccessState({
      actor,
      workspaceRepository: createSupabaseWorkspaceRepository(databaseClient),
      workspaceMemberships: createSupabaseWorkspaceMembershipRepository(
        databaseClient,
      ),
      adminClient: createSupabaseAdminClient({
        url: runtime.env.supabase.url!,
        serviceRoleKey: runtime.env.supabase.serviceRoleKey!,
      }),
    });

    return jsonOk({
      result: accessState,
    });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonError(
      500,
      error instanceof Error ? error.message : "Workspace access lookup failed.",
    );
  }
}

export async function POST(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonError(400, "Expected a JSON request body.");
  }

  try {
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const requestedWorkspaceId = readRequestedWorkspaceId(request, body);
    const actor = await resolveRequestActor(request, runtime, {
      preferredWorkspaceId: requestedWorkspaceId,
    });

    if (!canManageWorkspace(actor)) {
      return jsonError(
        403,
        "Only workspace owners and managers can provision workspace access.",
      );
    }

    const email = readInviteEmail(body);
    const inviteRole = normalizeWorkspaceInviteRole(body.role, actor.role);
    const databaseClient = createSupabaseDatabaseClient({
      url: runtime.env.supabase.url!,
      serviceKey: runtime.env.supabase.serviceRoleKey!,
    });
    const workspaceMemberships = createSupabaseWorkspaceMembershipRepository(
      databaseClient,
    );
    const adminClient = createSupabaseAdminClient({
      url: runtime.env.supabase.url!,
      serviceRoleKey: runtime.env.supabase.serviceRoleKey!,
    });
    const existingUser = await findSupabaseAuthUserByEmail(adminClient, email);

    if (existingUser) {
      if (await workspaceMemberships.isMember(actor.workspaceId, existingUser.id)) {
        return jsonError(
          409,
          "That email already has access to this workspace.",
        );
      }

      await workspaceMemberships.addMembership({
        workspaceId: actor.workspaceId,
        userId: existingUser.id,
        role: inviteRole,
        invitedBy: actor.userId,
        createdAt: new Date().toISOString(),
      });

      return jsonOk(
        {
          result: {
            workspaceId: actor.workspaceId,
            email,
            role: inviteRole,
            authUserCreated: false,
            message:
              "Access provisioned for an existing NocPulse account. This user can open the app immediately.",
          },
        },
        {
          status: 201,
        },
      );
    }

    await upsertWorkspaceEmailProvision({
      client: databaseClient,
      workspaceId: actor.workspaceId,
      email,
      role: inviteRole,
      createdBy: actor.userId,
    });

    return jsonOk(
      {
        result: {
          workspaceId: actor.workspaceId,
          email,
          role: inviteRole,
          authUserCreated: false,
          message:
            "Access provisioned. The first successful sign-in with this email will attach the new account to this workspace automatically.",
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonError(
      500,
      error instanceof Error ? error.message : "Workspace access update failed.",
    );
  }
}

export async function PATCH(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonError(400, "Expected a JSON request body.");
  }

  try {
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const requestedWorkspaceId = readRequestedWorkspaceId(request, body);
    const actor = await resolveRequestActor(request, runtime, {
      preferredWorkspaceId: requestedWorkspaceId,
    });

    if (!canManageWorkspace(actor)) {
      return jsonError(
        403,
        "Only workspace owners and managers can update workspace members.",
      );
    }

    const userId = readMemberUserId(body);
    const databaseClient = createSupabaseDatabaseClient({
      url: runtime.env.supabase.url!,
      serviceKey: runtime.env.supabase.serviceRoleKey!,
    });
    const workspaceMemberships = createSupabaseWorkspaceMembershipRepository(
      databaseClient,
    );
    const membership = await workspaceMemberships.getByWorkspaceAndUser(
      actor.workspaceId,
      userId,
    );

    if (!membership) {
      return jsonError(404, "That workspace member could not be found.");
    }

    const nextRole = normalizeWorkspaceMemberRoleChange(
      body.role,
      actor.role,
      membership.role,
      membership.userId === actor.userId,
    );

    if (!nextRole) {
      return jsonError(
        403,
        "You cannot change that member to the requested role.",
      );
    }

    const updatedMembership = await workspaceMemberships.updateMembershipRole(
      actor.workspaceId,
      userId,
      nextRole,
    );

    if (!updatedMembership) {
      return jsonError(404, "That workspace member could not be updated.");
    }

    return jsonOk({
      result: {
        workspaceId: actor.workspaceId,
        userId,
        role: updatedMembership.role,
        message: "Workspace member role updated.",
      },
    });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonError(
      500,
      error instanceof Error ? error.message : "Workspace access update failed.",
    );
  }
}

export async function DELETE(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonError(400, "Expected a JSON request body.");
  }

  try {
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const requestedWorkspaceId = readRequestedWorkspaceId(request, body);
    const actor = await resolveRequestActor(request, runtime, {
      preferredWorkspaceId: requestedWorkspaceId,
    });

    if (!canManageWorkspace(actor)) {
      return jsonError(
        403,
        "Only workspace owners and managers can remove workspace members.",
      );
    }

    const userId = readMemberUserId(body);
    const databaseClient = createSupabaseDatabaseClient({
      url: runtime.env.supabase.url!,
      serviceKey: runtime.env.supabase.serviceRoleKey!,
    });
    const workspaceMemberships = createSupabaseWorkspaceMembershipRepository(
      databaseClient,
    );
    const membership = await workspaceMemberships.getByWorkspaceAndUser(
      actor.workspaceId,
      userId,
    );

    if (!membership) {
      return jsonError(404, "That workspace member could not be found.");
    }

    if (
      !canRemoveWorkspaceMember(
        actor.role,
        membership.role,
        membership.userId === actor.userId,
      )
    ) {
      return jsonError(
        403,
        "You cannot remove that workspace member.",
      );
    }

    const removed = await workspaceMemberships.removeMembership(
      actor.workspaceId,
      userId,
    );

    if (!removed) {
      return jsonError(404, "That workspace member could not be removed.");
    }

    return jsonOk({
      result: {
        workspaceId: actor.workspaceId,
        userId,
        message: "Workspace member removed.",
      },
    });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonError(
      500,
      error instanceof Error ? error.message : "Workspace access update failed.",
    );
  }
}
