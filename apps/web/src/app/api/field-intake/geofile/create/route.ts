import { jsonError, jsonOk } from "../../../../../server/http/json";
import { createDraftField } from "../../../../../server/fields/createDraftField";
import { getWebServerRuntime } from "../../../../../server/runtime/getWebServerRuntime";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../../../server/runtime/resolveRequestContext";

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return jsonError(400, "Expected multipart form data.");
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return jsonError(400, "Form field `file` is required.");
  }

  const requestedWorkspaceIdValue = formData.get("workspaceId");
  const requestedWorkspaceId =
    typeof requestedWorkspaceIdValue === "string" && requestedWorkspaceIdValue.trim()
      ? requestedWorkspaceIdValue.trim()
      : null;
  const suggestedFieldNameValue = formData.get("suggestedFieldName");
  const suggestedFieldName =
    typeof suggestedFieldNameValue === "string" && suggestedFieldNameValue.trim()
      ? suggestedFieldNameValue.trim()
      : undefined;
  const cropTypeValue = formData.get("cropType");
  const cropType =
    typeof cropTypeValue === "string" && cropTypeValue.trim()
      ? cropTypeValue.trim()
      : null;
  const varietyValue = formData.get("variety");
  const variety =
    typeof varietyValue === "string" && varietyValue.trim()
      ? varietyValue.trim()
      : null;
  const seedingDateValue = formData.get("seedingDate");
  const seedingDate =
    typeof seedingDateValue === "string" && seedingDateValue.trim()
      ? seedingDateValue.trim()
      : null;

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
    const parsed = await runtime.services.fieldIntake.parseBoundaryFile({
      content: await file.text(),
      fileName: file.name,
      mimeType: file.type || undefined,
      suggestedFieldName,
    });
    const result = await createDraftField({
      runtime,
      actor,
      name: parsed.draft.name,
      boundary: parsed.draft.boundary,
      areaHa: parsed.draft.areaHa,
      legalLandDescription: null,
      cropType,
      variety,
      seedingDate,
      sourceKey: "field-intake:geofile-create",
      metadata: {
        intakeMethod: "geofile",
        fileName: file.name,
        mimeType: file.type || null,
        format: parsed.format,
      },
      dispatchOnboarding: true,
    });

    return jsonOk(
      {
        result,
      },
      {
        status: result.action === "created" ? 201 : 200,
      },
    );
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonError(
      400,
      error instanceof Error ? error.message : "Geofile field create failed.",
    );
  }
}
