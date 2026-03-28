import { jsonError, jsonOk } from "../../../../server/http/json";
import { getWebServerRuntime } from "../../../../server/runtime/getWebServerRuntime";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../../server/runtime/resolveRequestContext";

export async function GET(request: Request) {
  try {
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const actor = await resolveRequestActor(request, runtime);
    const { searchParams } = new URL(request.url);
    const fieldId = searchParams.get("fieldId")?.trim();
    const requestedAt = searchParams.get("requestedAt")?.trim() || undefined;
    const diagnostics = fieldId
      ? await runtime.services.imagery.inspectProvidersForField({
          workspaceId: actor.workspaceId,
          fieldId,
          requestedAt,
        })
      : await runtime.services.imagery.inspectProviders();

    return jsonOk({
      diagnostics,
    });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonError(
      500,
      error instanceof Error
        ? error.message
        : "Imagery provider diagnostics failed.",
    );
  }
}
