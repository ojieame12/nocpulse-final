import { jsonError, jsonOk, readJsonObject } from "../../../../server/http/json";
import { getWebServerRuntime } from "../../../../server/runtime/getWebServerRuntime";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../../server/runtime/resolveRequestContext";
import { listWorkspaceJobDispatchesByIds } from "../../../../server/jobs/jobDispatchLookup";
import { createServerDatabaseClient } from "../../../../server/runtime/createServerDatabaseClient";

export async function POST(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonError(400, "Expected a JSON request body.");
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  const requestedWorkspaceId =
    typeof body.workspaceId === "string" ? body.workspaceId.trim() : null;

  if (ids.length === 0) {
    return jsonError(400, "At least one dispatch id is required.");
  }

  try {
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const actor = await resolveRequestActor(request, runtime, {
      preferredWorkspaceId: requestedWorkspaceId,
    });
    const client = createServerDatabaseClient(runtime);
    const dispatches = await listWorkspaceJobDispatchesByIds({
      client,
      ids,
      workspaceId: actor.workspaceId,
    });

    return jsonOk({
      result: {
        workspaceId: actor.workspaceId,
        dispatches,
      },
    });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonError(
      500,
      error instanceof Error ? error.message : "Job dispatch lookup failed.",
    );
  }
}
