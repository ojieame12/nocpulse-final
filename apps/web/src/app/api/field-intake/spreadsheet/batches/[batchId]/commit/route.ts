import { jsonError, jsonOk, readJsonObject } from "../../../../../../../server/http/json";
import { getWebServerRuntime } from "../../../../../../../server/runtime/getWebServerRuntime";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../../../../../server/runtime/resolveRequestContext";

type RouteContext = {
  params: Promise<{
    batchId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonError(400, "Expected a JSON request body.");
  }

  const { batchId } = await context.params;
  const requestedWorkspaceId =
    typeof body.workspaceId === "string" ? body.workspaceId : null;
  const onboardingDryRun =
    typeof body.onboardingDryRun === "boolean" ? body.onboardingDryRun : undefined;

  if (!batchId) {
    return jsonError(400, "Route param `batchId` is required.");
  }

  try {
    const runtime = getWebServerRuntime({
      jobDispatcher: "persistent",
    });

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const actor = await resolveRequestActor(request, runtime, {
      preferredWorkspaceId: requestedWorkspaceId,
    });
    const result = await runtime.services.fieldIntake.commitSpreadsheetImportBatch({
      actorUserId: actor.userId,
      workspaceId: actor.workspaceId,
      batchId,
      onboardingDryRun,
    });

    return jsonOk({
      result,
    });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonError(
      400,
      error instanceof Error ? error.message : "Import batch commit failed.",
    );
  }
}
