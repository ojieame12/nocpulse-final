import { jsonError, jsonOk, readJsonObject } from "../../../server/http/json";
import { createDraftField } from "../../../server/fields/createDraftField";
import { buildManualFieldDraft } from "../../../server/fields/manualFieldDraft";
import { getWebServerRuntime } from "../../../server/runtime/getWebServerRuntime";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../server/runtime/resolveRequestContext";

function readRequiredString(body: Record<string, unknown>, key: string) {
  const value = typeof body[key] === "string" ? body[key].trim() : "";

  if (!value) {
    throw new RequestContextError(400, `Field \`${key}\` is required.`);
  }

  return value;
}

function readOptionalString(body: Record<string, unknown>, key: string) {
  const value = typeof body[key] === "string" ? body[key].trim() : "";
  return value.length > 0 ? value : null;
}

function readRequiredNumber(body: Record<string, unknown>, key: string) {
  const raw = body[key];
  const value =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim().length > 0
        ? Number(raw.trim())
        : Number.NaN;

  if (!Number.isFinite(value)) {
    throw new RequestContextError(400, `Field \`${key}\` must be a valid number.`);
  }

  return value;
}

export async function POST(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonError(400, "Expected a JSON request body.");
  }

  const requestedWorkspaceId =
    typeof body.workspaceId === "string" ? body.workspaceId.trim() : null;

  try {
    const name = readRequiredString(body, "name");
    const latitude = readRequiredNumber(body, "latitude");
    const longitude = readRequiredNumber(body, "longitude");
    const areaHa = readRequiredNumber(body, "areaHa");
    const cropType = readOptionalString(body, "cropType");
    const variety = readOptionalString(body, "variety");
    const seedingDate = readOptionalString(body, "seedingDate");
    const legalLandDescription = readOptionalString(body, "legalLandDescription");

    const runtime = getWebServerRuntime({
      jobDispatcher: "persistent",
    });

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const actor = await resolveRequestActor(request, runtime, {
      preferredWorkspaceId: requestedWorkspaceId,
    });
    const manualDraft = buildManualFieldDraft({
      latitude,
      longitude,
      areaHa,
    });
    const result = await createDraftField({
      runtime,
      actor,
      name,
      boundary: manualDraft.boundary,
      areaHa: manualDraft.areaHa,
      legalLandDescription,
      cropType,
      variety,
      seedingDate,
      sourceKey: "manual-entry",
      metadata: {
        enteredPoint: {
          latitude,
          longitude,
        },
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
      error instanceof Error ? error.message : "Field create request failed.",
    );
  }
}
