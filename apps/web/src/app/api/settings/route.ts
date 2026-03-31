import { jsonError, jsonOk, readJsonObject } from "../../../server/http/json";
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

    return jsonError(
      500,
      error instanceof Error ? error.message : "Settings lookup failed.",
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
    const settings = normalizeWorkspaceSettings(
      (typeof body.settings === "object" && body.settings !== null
        ? body.settings
        : body) as Partial<WorkspaceSettingsState>,
    );
    const client = createServerDatabaseClient(runtime);

    return jsonOk(
      {
        result: {
          workspaceId: actor.workspaceId,
          settings: await saveWorkspaceSettingsState({
            client,
            workspaceId: actor.workspaceId,
            userId: actor.userId,
            settings,
          }),
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

    return jsonError(
      500,
      error instanceof Error ? error.message : "Settings save failed.",
    );
  }
}
