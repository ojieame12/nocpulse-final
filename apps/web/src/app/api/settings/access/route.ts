import { canManageWorkspace } from "@fieldpulse/module-auth";
import {
  createSupabaseWorkspaceMembershipRepository,
  createSupabaseWorkspaceRepository,
} from "@fieldpulse/module-workspaces";
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
import {
  jsonError,
  jsonOk,
  jsonServerError,
  readJsonObject,
} from "../../../../server/http/json";
import {
  buildActorRateLimitIdentifier,
  buildIpRateLimitRule,
  enforceRouteRateLimits,
} from "../../../../server/auth/routeRateLimit";
import { logAuditEvent } from "../../../../server/audit/logAuditEvent";
import {
  nullableTrimmedText,
  optionalTrimmedText,
  parseWithSchema,
  requiredTrimmedString,
  z,
} from "../../../../server/http/validation";
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
import { createServerDatabaseClient } from "../../../../server/runtime/createServerDatabaseClient";

const SETTINGS_ACCESS_INVITE_ACTOR_RATE_LIMIT = {
  scope: "settings-access-invite:actor",
  maxAttempts: 20,
  windowSeconds: 5 * 60,
} as const;

const SETTINGS_ACCESS_INVITE_IP_RATE_LIMIT = {
  scope: "settings-access-invite:ip",
  maxAttempts: 40,
  windowSeconds: 5 * 60,
} as const;

const SETTINGS_ACCESS_MEMBER_ACTOR_RATE_LIMIT = {
  scope: "settings-access-member-mutation:actor",
  maxAttempts: 30,
  windowSeconds: 5 * 60,
} as const;

const SETTINGS_ACCESS_MEMBER_IP_RATE_LIMIT = {
  scope: "settings-access-member-mutation:ip",
  maxAttempts: 60,
  windowSeconds: 5 * 60,
} as const;

const WorkspaceAccessInviteBodySchema = z.object({
  workspaceId: nullableTrimmedText(),
  email: requiredTrimmedString("An email address is required.")
    .transform((value) => normalizeWorkspaceAccessEmail(value))
    .refine(isValidWorkspaceAccessEmail, "Enter a valid email address."),
  role: optionalTrimmedText(),
});

const WorkspaceAccessMemberBodySchema = z.object({
  workspaceId: nullableTrimmedText(),
  userId: requiredTrimmedString("A member identifier is required."),
  role: optionalTrimmedText(),
});

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
      allowDevelopmentFallback: true,
      preferredWorkspaceId: requestedWorkspaceId,
    });
    const databaseClient = createServerDatabaseClient(runtime);
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

    return jsonServerError(error, {
      event: "settings-access-get-route",
      message: "Workspace access lookup failed.",
    });
  }
}

export async function POST(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonError(400, "Expected a JSON request body.");
  }

  try {
    const payload = parseWithSchema(WorkspaceAccessInviteBodySchema, body);
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const requestedWorkspaceId = readRequestedWorkspaceId(request, body);
    const actor = await resolveRequestActor(request, runtime, {
      allowDevelopmentFallback: true,
      preferredWorkspaceId: requestedWorkspaceId,
    });
    const rateLimitResponse = await enforceRouteRateLimits({
      runtime,
      rules: [
        buildIpRateLimitRule({
          request,
          ...SETTINGS_ACCESS_INVITE_IP_RATE_LIMIT,
          message: "Too many workspace access invite requests.",
        }),
        {
          ...SETTINGS_ACCESS_INVITE_ACTOR_RATE_LIMIT,
          identifier: buildActorRateLimitIdentifier({
            workspaceId: actor.workspaceId,
            userId: actor.userId,
          }),
          message: "Too many workspace access invite requests.",
        },
      ],
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    if (!canManageWorkspace(actor)) {
      return jsonError(
        403,
        "Only workspace owners and managers can provision workspace access.",
      );
    }

    const email = payload.email;
    const inviteRole = normalizeWorkspaceInviteRole(payload.role, actor.role);
    const databaseClient = createServerDatabaseClient(runtime);
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
      await logAuditEvent({
        runtime,
        action: "workspace.access_granted",
        actorUserId: actor.userId,
        workspaceId: actor.workspaceId,
        resourceType: "workspace-membership",
        resourceId: existingUser.id,
        route: "/api/settings/access",
        metadata: {
          role: inviteRole,
          email,
          provisionMode: "existing-account",
        },
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
    await logAuditEvent({
      runtime,
      action: "workspace.access_invited",
      actorUserId: actor.userId,
      workspaceId: actor.workspaceId,
      resourceType: "workspace-invite",
      resourceId: email,
      route: "/api/settings/access",
      metadata: {
        role: inviteRole,
        email,
        provisionMode: "email-provision",
      },
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

    return jsonServerError(error, {
      event: "settings-access-post-route",
      message: "Workspace access update failed.",
    });
  }
}

export async function PATCH(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonError(400, "Expected a JSON request body.");
  }

  try {
    const payload = parseWithSchema(WorkspaceAccessMemberBodySchema, body);
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const requestedWorkspaceId = readRequestedWorkspaceId(request, body);
    const actor = await resolveRequestActor(request, runtime, {
      allowDevelopmentFallback: true,
      preferredWorkspaceId: requestedWorkspaceId,
    });
    const rateLimitResponse = await enforceRouteRateLimits({
      runtime,
      rules: [
        buildIpRateLimitRule({
          request,
          ...SETTINGS_ACCESS_MEMBER_IP_RATE_LIMIT,
          message: "Too many workspace member update requests.",
        }),
        {
          ...SETTINGS_ACCESS_MEMBER_ACTOR_RATE_LIMIT,
          identifier: buildActorRateLimitIdentifier({
            workspaceId: actor.workspaceId,
            userId: actor.userId,
          }),
          message: "Too many workspace member update requests.",
        },
      ],
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    if (!canManageWorkspace(actor)) {
      return jsonError(
        403,
        "Only workspace owners and managers can update workspace members.",
      );
    }

    const userId = payload.userId;
    const databaseClient = createServerDatabaseClient(runtime);
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
      payload.role,
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

    await logAuditEvent({
      runtime,
      action: "workspace.member_role_updated",
      actorUserId: actor.userId,
      workspaceId: actor.workspaceId,
      resourceType: "workspace-membership",
      resourceId: userId,
      route: "/api/settings/access",
      metadata: {
        role: updatedMembership.role,
      },
    });

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

    return jsonServerError(error, {
      event: "settings-access-patch-route",
      message: "Workspace access update failed.",
    });
  }
}

export async function DELETE(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonError(400, "Expected a JSON request body.");
  }

  try {
    const payload = parseWithSchema(WorkspaceAccessMemberBodySchema, body);
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const requestedWorkspaceId = readRequestedWorkspaceId(request, body);
    const actor = await resolveRequestActor(request, runtime, {
      allowDevelopmentFallback: true,
      preferredWorkspaceId: requestedWorkspaceId,
    });
    const rateLimitResponse = await enforceRouteRateLimits({
      runtime,
      rules: [
        buildIpRateLimitRule({
          request,
          ...SETTINGS_ACCESS_MEMBER_IP_RATE_LIMIT,
          message: "Too many workspace member removal requests.",
        }),
        {
          ...SETTINGS_ACCESS_MEMBER_ACTOR_RATE_LIMIT,
          identifier: buildActorRateLimitIdentifier({
            workspaceId: actor.workspaceId,
            userId: actor.userId,
          }),
          message: "Too many workspace member removal requests.",
        },
      ],
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    if (!canManageWorkspace(actor)) {
      return jsonError(
        403,
        "Only workspace owners and managers can remove workspace members.",
      );
    }

    const userId = payload.userId;
    const databaseClient = createServerDatabaseClient(runtime);
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

    await logAuditEvent({
      runtime,
      action: "workspace.member_removed",
      actorUserId: actor.userId,
      workspaceId: actor.workspaceId,
      resourceType: "workspace-membership",
      resourceId: userId,
      route: "/api/settings/access",
    });

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

    return jsonServerError(error, {
      event: "settings-access-delete-route",
      message: "Workspace access update failed.",
    });
  }
}
