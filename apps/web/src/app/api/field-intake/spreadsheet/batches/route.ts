import { jsonError, jsonOk, readJsonObject } from "../../../../../server/http/json";
import { getWebServerRuntime } from "../../../../../server/runtime/getWebServerRuntime";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../../../server/runtime/resolveRequestContext";

export async function POST(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonError(400, "Expected a JSON request body.");
  }

  const requestedWorkspaceId =
    typeof body.workspaceId === "string" ? body.workspaceId : null;
  const preview =
    typeof body.preview === "object" && body.preview !== null
      ? body.preview
      : null;

  if (!preview) {
    return jsonError(400, "Field `preview` is required.");
  }

  try {
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const actor = await resolveRequestActor(request, runtime, {
      preferredWorkspaceId: requestedWorkspaceId,
    });
    const result = await runtime.services.fieldIntake.saveSpreadsheetImportPreview({
      actorUserId: actor.userId,
      workspaceId: actor.workspaceId,
      preview: preview as Parameters<
        typeof runtime.services.fieldIntake.saveSpreadsheetImportPreview
      >[0]["preview"],
    });

    return jsonOk(
      {
        result,
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
      400,
      error instanceof Error ? error.message : "Import batch save failed.",
    );
  }
}
