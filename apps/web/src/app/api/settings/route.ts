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
import {
  nullableTrimmedText,
  parseWithSchema,
  z,
} from "../../../server/http/validation";
import { getWebServerRuntime } from "../../../server/runtime/getWebServerRuntime";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../server/runtime/resolveRequestContext";
import {
  normalizeWorkspaceSettings,
  type WorkspaceSettingsState,
} from "../../../features/settings/workspaceSettings";
import { createServerDatabaseClient } from "../../../server/runtime/createServerDatabaseClient";
import {
  isMissingWorkspaceSettingsTable,
  loadWorkspaceSettingsState,
  saveWorkspaceSettingsState,
} from "../../../server/settings/workspaceUserSettings";

const SETTINGS_SAVE_ACTOR_RATE_LIMIT = {
  scope: "settings-save:actor",
  maxAttempts: 40,
  windowSeconds: 5 * 60,
} as const;

const SETTINGS_SAVE_IP_RATE_LIMIT = {
  scope: "settings-save:ip",
  maxAttempts: 80,
  windowSeconds: 5 * 60,
} as const;

const SettingsBodySchema = z
  .object({
    workspaceId: nullableTrimmedText(),
    settings: z.record(z.unknown()).optional(),
  })
  .passthrough();

function readRequestedWorkspaceId(request: Request, body?: Record<string, unknown> | null) {
  const { searchParams } = new URL(request.url);
  const queryWorkspaceId = searchParams.get("workspaceId")?.trim();

  if (queryWorkspaceId) {
    return queryWorkspaceId;
  }

  const bodyWorkspaceId =
    typeof body?.workspaceId === "string" ? body.workspaceId.trim() : "";

  return bodyWorkspaceId || null;
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
    const client = createServerDatabaseClient(runtime);

    return jsonOk({
      result: {
        workspaceId: actor.workspaceId,
        settings: await loadWorkspaceSettingsState({
          client,
          workspaceId: actor.workspaceId,
          userId: actor.userId,
        }),
      },
    });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    if (isMissingWorkspaceSettingsTable(error)) {
      return jsonError(
        503,
        "Workspace settings storage is not migrated yet.",
      );
    }

    return jsonServerError(error, {
      event: "settings-get-route",
      message: "Settings lookup failed.",
    });
  }
}

export async function POST(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonError(400, "Expected a JSON request body.");
  }

  try {
    const payload = parseWithSchema(SettingsBodySchema, body);
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
          ...SETTINGS_SAVE_IP_RATE_LIMIT,
          message: "Too many settings save requests.",
        }),
        {
          ...SETTINGS_SAVE_ACTOR_RATE_LIMIT,
          identifier: buildActorRateLimitIdentifier({
            workspaceId: actor.workspaceId,
            userId: actor.userId,
          }),
          message: "Too many settings save requests.",
        },
      ],
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const settings = normalizeWorkspaceSettings(
      (payload.settings ?? payload) as Partial<WorkspaceSettingsState>,
    );
    const client = createServerDatabaseClient(runtime);
    const savedSettings = await saveWorkspaceSettingsState({
      client,
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      settings,
    });

    await logAuditEvent({
      runtime,
      action: "workspace.settings_updated",
      actorUserId: actor.userId,
      workspaceId: actor.workspaceId,
      resourceType: "workspace-settings",
      resourceId: actor.workspaceId,
      route: "/api/settings",
      metadata: {
        emailAlerts: savedSettings.emailAlerts,
        healthWarnings: savedSettings.healthWarnings,
        sprayWindows: savedSettings.sprayWindows,
        weeklyDigest: savedSettings.weeklyDigest,
        units: savedSettings.units,
        tempUnit: savedSettings.tempUnit,
      },
    });

    return jsonOk(
      {
        result: {
          workspaceId: actor.workspaceId,
          settings: savedSettings,
        },
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    if (isMissingWorkspaceSettingsTable(error)) {
      return jsonError(
        503,
        "Workspace settings storage is not migrated yet.",
      );
    }

    return jsonServerError(error, {
      event: "settings-post-route",
      message: "Settings save failed.",
    });
  }
}
