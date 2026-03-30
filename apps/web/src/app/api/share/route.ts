import { createSupabaseDatabaseClient } from "@fieldpulse/platform-db";
import { jsonError, jsonOk, readJsonObject } from "../../../server/http/json";
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

function readFieldId(body: Record<string, unknown>) {
  const fieldId = typeof body.fieldId === "string" ? body.fieldId.trim() : "";

  if (!fieldId) {
    throw new RequestContextError(400, "A field identifier is required.");
  }

  return fieldId;
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

function readShareId(body: Record<string, unknown>) {
  const shareId = typeof body.shareId === "string" ? body.shareId.trim() : "";

  if (!shareId) {
    throw new RequestContextError(400, "A share identifier is required.");
  }

  return shareId;
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

    if (!canCreateWorkspaceShare(actor.role)) {
      return jsonError(
        403,
        "Only workspace members can view shared field links.",
      );
    }

    const client = createSupabaseDatabaseClient({
      url: runtime.env.supabase.url!,
      serviceKey: runtime.env.supabase.serviceRoleKey!,
    });
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

    return jsonError(
      500,
      error instanceof Error ? error.message : "Workspace share lookup failed.",
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
      allowDevelopmentFallback: false,
      preferredWorkspaceId: requestedWorkspaceId,
    });

    if (!canCreateWorkspaceShare(actor.role)) {
      return jsonError(
        403,
        "Only workspace members can generate shared field links.",
      );
    }

    const fieldId = readFieldId(body);
    const fieldSelection = await runtime.services.catalog.loadWorkspaceFieldDetail({
      actorUserId: actor.userId,
      preferredWorkspaceId: actor.workspaceId,
      fieldId,
    });

    if (!fieldSelection.selectedWorkspace || !fieldSelection.field) {
      return jsonError(404, `Field ${fieldId} was not found.`);
    }

    const client = createSupabaseDatabaseClient({
      url: runtime.env.supabase.url!,
      serviceKey: runtime.env.supabase.serviceRoleKey!,
    });
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

    return jsonError(
      500,
      error instanceof Error ? error.message : "Workspace share could not be created.",
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
      allowDevelopmentFallback: false,
      preferredWorkspaceId: requestedWorkspaceId,
    });

    if (!canCreateWorkspaceShare(actor.role)) {
      return jsonError(
        403,
        "Only workspace members can revoke shared field links.",
      );
    }

    const client = createSupabaseDatabaseClient({
      url: runtime.env.supabase.url!,
      serviceKey: runtime.env.supabase.serviceRoleKey!,
    });
    const revokedShare = await revokeWorkspaceShareById({
      client,
      workspaceId: actor.workspaceId,
      shareId: readShareId(body),
    });

    if (!revokedShare) {
      return jsonError(404, "This shared link is no longer active.");
    }

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

    return jsonError(
      500,
      error instanceof Error ? error.message : "Workspace share could not be revoked.",
    );
  }
}
