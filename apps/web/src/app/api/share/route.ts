import {
  jsonError,
  jsonOk,
  jsonServerError,
  readJsonObject,
} from "../../../server/http/json";
import {
  buildActorRateLimitIdentifier,
  buildIpRateLimitRule,
  enforceRouteRateLimits,
} from "../../../server/auth/routeRateLimit";
import { logAuditEvent } from "../../../server/audit/logAuditEvent";
import { getAppOrigin } from "../../../server/auth/getAppOrigin";
import {
  createWorkspaceShareToken,
  getActiveWorkspaceShare,
  revokeWorkspaceShareById,
  revokeWorkspaceSharesForField,
} from "../../../server/auth/guestShareSession";
import { getWebServerRuntime } from "../../../server/runtime/getWebServerRuntime";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../server/runtime/resolveRequestContext";
import { createServerDatabaseClient } from "../../../server/runtime/createServerDatabaseClient";
import {
  nullableTrimmedText,
  parseWithSchema,
  requiredTrimmedString,
  z,
} from "../../../server/http/validation";

const SHARE_LOOKUP_ACTOR_RATE_LIMIT = {
  scope: "share-get:actor",
  maxAttempts: 120,
  windowSeconds: 5 * 60,
} as const;

const SHARE_LOOKUP_IP_RATE_LIMIT = {
  scope: "share-get:ip",
  maxAttempts: 200,
  windowSeconds: 5 * 60,
} as const;

const SHARE_MUTATION_ACTOR_RATE_LIMIT = {
  scope: "share-mutation:actor",
  maxAttempts: 20,
  windowSeconds: 5 * 60,
} as const;

const SHARE_MUTATION_IP_RATE_LIMIT = {
  scope: "share-mutation:ip",
  maxAttempts: 40,
  windowSeconds: 5 * 60,
} as const;

const ShareCreateBodySchema = z.object({
  workspaceId: nullableTrimmedText(),
  fieldId: requiredTrimmedString("A field identifier is required."),
});

const ShareDeleteBodySchema = z.object({
  workspaceId: nullableTrimmedText(),
  shareId: requiredTrimmedString("A share identifier is required."),
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

function readFieldIdFromRequest(
  request: Request,
  body?: Record<string, unknown> | null,
) {
  const { searchParams } = new URL(request.url);
  const queryFieldId = searchParams.get("fieldId")?.trim();

  if (queryFieldId) {
    return queryFieldId;
  }

  const bodyFieldId =
    typeof body?.fieldId === "string" ? body.fieldId.trim() : "";

  return bodyFieldId || null;
}

function canCreateWorkspaceShare(role: string) {
  return role === "owner" || role === "manager" || role === "member";
}

function buildShareResult(request: Request, share: {
  id: string;
  fieldId: string;
  expiresAt: string;
  createdAt: string;
  lastAccessedAt?: string | null;
}, token?: string) {
  return {
    shareId: share.id,
    fieldId: share.fieldId,
    shareUrl: token ? `${getAppOrigin(request)}/share/${token}` : null,
    expiresAt: share.expiresAt,
    createdAt: share.createdAt,
    lastAccessedAt: share.lastAccessedAt ?? null,
  };
}

export async function GET(request: Request) {
  try {
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const requestedWorkspaceId = readRequestedWorkspaceId(request);
    const fieldId = readFieldIdFromRequest(request);

    if (!fieldId) {
      return jsonOk({
        result: null,
      });
    }

    const actor = await resolveRequestActor(request, runtime, {
      allowDevelopmentFallback: false,
      preferredWorkspaceId: requestedWorkspaceId,
    });
    const rateLimitResponse = await enforceRouteRateLimits({
      runtime,
      rules: [
        buildIpRateLimitRule({
          request,
          ...SHARE_LOOKUP_IP_RATE_LIMIT,
          message: "Too many workspace share lookup requests.",
        }),
        {
          ...SHARE_LOOKUP_ACTOR_RATE_LIMIT,
          identifier: buildActorRateLimitIdentifier({
            workspaceId: actor.workspaceId,
            userId: actor.userId,
            resourceId: fieldId,
          }),
          message: "Too many workspace share lookup requests.",
        },
      ],
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    if (!canCreateWorkspaceShare(actor.role)) {
      return jsonError(
        403,
        "Only workspace members can view shared field links.",
      );
    }

    const client = createServerDatabaseClient(runtime);
    const activeShare = await getActiveWorkspaceShare({
      client,
      workspaceId: actor.workspaceId,
      fieldId,
    });

    return jsonOk({
      result: activeShare
        ? buildShareResult(request, activeShare)
        : null,
    });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonServerError(error, {
      event: "share-get-route",
      message: "Workspace share lookup failed.",
    });
  }
}

export async function POST(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonError(400, "Expected a JSON request body.");
  }

  try {
    const payload = parseWithSchema(ShareCreateBodySchema, body);
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const requestedWorkspaceId = readRequestedWorkspaceId(request, body);
    const actor = await resolveRequestActor(request, runtime, {
      allowDevelopmentFallback: false,
      preferredWorkspaceId: payload.workspaceId ?? requestedWorkspaceId,
    });
    const rateLimitResponse = await enforceRouteRateLimits({
      runtime,
      rules: [
        buildIpRateLimitRule({
          request,
          ...SHARE_MUTATION_IP_RATE_LIMIT,
          message: "Too many workspace share mutation requests.",
        }),
        {
          ...SHARE_MUTATION_ACTOR_RATE_LIMIT,
          identifier: buildActorRateLimitIdentifier({
            workspaceId: actor.workspaceId,
            userId: actor.userId,
            resourceId: payload.fieldId,
          }),
          message: "Too many workspace share mutation requests.",
        },
      ],
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    if (!canCreateWorkspaceShare(actor.role)) {
      return jsonError(
        403,
        "Only workspace members can generate shared field links.",
      );
    }

    const fieldSelection = await runtime.services.catalog.loadWorkspaceFieldDetail({
      actorUserId: actor.userId,
      preferredWorkspaceId: actor.workspaceId,
      fieldId: payload.fieldId,
    });

    if (!fieldSelection.selectedWorkspace || !fieldSelection.field) {
      return jsonError(404, `Field ${payload.fieldId} was not found.`);
    }

    const client = createServerDatabaseClient(runtime);
    const created = await createWorkspaceShareToken({
      client,
      workspaceId: fieldSelection.selectedWorkspace.id,
      fieldId: fieldSelection.field.detail.id,
      createdBy: actor.userId,
    });
    await revokeWorkspaceSharesForField({
      client,
      workspaceId: fieldSelection.selectedWorkspace.id,
      fieldId: fieldSelection.field.detail.id,
      excludedShareId: created.share.id,
    });

    await logAuditEvent({
      runtime,
      action: "workspace.share_created",
      actorUserId: actor.userId,
      workspaceId: fieldSelection.selectedWorkspace.id,
      resourceType: "workspace-share",
      resourceId: created.share.id,
      route: "/api/share",
      metadata: {
        fieldId: fieldSelection.field.detail.id,
        fieldName: fieldSelection.field.detail.name,
        expiresAt: created.share.expiresAt,
      },
    });

    return jsonOk(
      {
        result: {
          workspaceId: fieldSelection.selectedWorkspace.id,
          fieldName: fieldSelection.field.detail.name,
          ...buildShareResult(request, created.share, created.token),
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
      event: "share-post-route",
      message: "Workspace share could not be created.",
    });
  }
}

export async function DELETE(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonError(400, "Expected a JSON request body.");
  }

  try {
    const payload = parseWithSchema(ShareDeleteBodySchema, body);
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const requestedWorkspaceId = readRequestedWorkspaceId(request, body);
    const actor = await resolveRequestActor(request, runtime, {
      allowDevelopmentFallback: false,
      preferredWorkspaceId: payload.workspaceId ?? requestedWorkspaceId,
    });
    const rateLimitResponse = await enforceRouteRateLimits({
      runtime,
      rules: [
        buildIpRateLimitRule({
          request,
          ...SHARE_MUTATION_IP_RATE_LIMIT,
          message: "Too many workspace share mutation requests.",
        }),
        {
          ...SHARE_MUTATION_ACTOR_RATE_LIMIT,
          identifier: buildActorRateLimitIdentifier({
            workspaceId: actor.workspaceId,
            userId: actor.userId,
            resourceId: payload.shareId,
          }),
          message: "Too many workspace share mutation requests.",
        },
      ],
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    if (!canCreateWorkspaceShare(actor.role)) {
      return jsonError(
        403,
        "Only workspace members can revoke shared field links.",
      );
    }

    const client = createServerDatabaseClient(runtime);
    const revokedShare = await revokeWorkspaceShareById({
      client,
      workspaceId: actor.workspaceId,
      shareId: payload.shareId,
    });

    if (!revokedShare) {
      return jsonError(404, "This shared link is no longer active.");
    }

    await logAuditEvent({
      runtime,
      action: "workspace.share_revoked",
      actorUserId: actor.userId,
      workspaceId: actor.workspaceId,
      resourceType: "workspace-share",
      resourceId: revokedShare.id,
      route: "/api/share",
      metadata: {
        revokedAt: revokedShare.revokedAt,
      },
    });

    return jsonOk({
      result: {
        shareId: revokedShare.id,
        revokedAt: revokedShare.revokedAt,
      },
    });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonServerError(error, {
      event: "share-delete-route",
      message: "Workspace share could not be revoked.",
    });
  }
}
