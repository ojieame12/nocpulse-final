import { jsonError, jsonOk, readJsonObject } from "../../../../../server/http/json";
import { createDraftField } from "../../../../../server/fields/createDraftField";
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
    typeof body.workspaceId === "string" ? body.workspaceId.trim() : null;
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const suggestedFieldName =
    typeof body.suggestedFieldName === "string" ? body.suggestedFieldName.trim() : "";
  const cropType = typeof body.cropType === "string" ? body.cropType.trim() : "";
  const variety = typeof body.variety === "string" ? body.variety.trim() : "";
  const seedingDate =
    typeof body.seedingDate === "string" ? body.seedingDate.trim() : "";

  if (!code) {
    return jsonError(400, "Field `code` is required.");
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
    const lookup = await runtime.services.fieldIntake.lookupLldBoundary({
      code,
      suggestedFieldName: suggestedFieldName || undefined,
    });
    const result = await createDraftField({
      runtime,
      actor,
      name: lookup.draft.name,
      boundary: lookup.draft.boundary,
      areaHa: lookup.draft.areaHa,
      legalLandDescription: lookup.parsed.normalized,
      cropType: cropType || null,
      variety: variety || null,
      seedingDate: seedingDate || null,
      sourceKey: "field-intake:lld-create",
      metadata: {
        intakeMethod: "lld",
        lldCode: lookup.parsed.normalized,
        lldResolution: lookup.resolution,
      },
      dispatchOnboarding: true,
    });

    return jsonOk(
      {
        result: {
          ...result,
          intakeMetadata: {
            method: "lld",
            lldResolution: lookup.resolution,
            boundaryConfidenceLabel:
              lookup.resolution === "cached"
                ? "Cached parcel geometry"
                : "Synthetic DLS geometry",
          },
        },
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
      error instanceof Error ? error.message : "LLD field create failed.",
    );
  }
}
