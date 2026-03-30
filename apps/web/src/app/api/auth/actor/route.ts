import { jsonError, jsonOk } from "../../../../server/http/json";
import { resolveRequestAuthViewer } from "../../../../server/auth/resolveAuthViewer";
import { getWebServerRuntime } from "../../../../server/runtime/getWebServerRuntime";
import {
  RequestContextError,
} from "../../../../server/runtime/resolveRequestContext";

export async function GET(request: Request) {
  try {
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const { actor, viewer } = await resolveRequestAuthViewer({
      request,
      runtime,
    });

    return jsonOk({
      actor,
      viewer,
    });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonError(
      500,
      error instanceof Error ? error.message : "Actor resolution failed.",
    );
  }
}
