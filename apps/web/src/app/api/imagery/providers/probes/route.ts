import {
  jsonError,
  jsonOk,
  jsonServerError,
  readJsonObject,
} from "../../../../../server/http/json";
import { getWebServerRuntime } from "../../../../../server/runtime/getWebServerRuntime";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../../../server/runtime/resolveRequestContext";

function readRequiredFieldId(request: Request) {
  const { searchParams } = new URL(request.url);
  const fieldId = searchParams.get("fieldId")?.trim();

  if (!fieldId) {
    throw new RequestContextError(
      400,
      "[imagery] fieldId is required for provider probe history routes.",
    );
  }

  return fieldId;
}

export async function GET(request: Request) {
  try {
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const actor = await resolveRequestActor(request, runtime, {
      allowDevelopmentFallback: false,
    });
    const { searchParams } = new URL(request.url);
    const fieldId = readRequiredFieldId(request);
    const limitValue = searchParams.get("limit")?.trim();
    const limit =
      typeof limitValue === "string" && limitValue.length > 0
        ? Number(limitValue)
        : undefined;

    if (limitValue && (!Number.isFinite(limit) || Number(limit) <= 0)) {
      return jsonError(400, "[imagery] limit must be a positive number.");
    }

    const records = await runtime.services.imagery.listProviderProbeHistoryForField({
      workspaceId: actor.workspaceId,
      fieldId,
      limit,
    });

    return jsonOk({
      records,
    });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonServerError(error, {
      event: "imagery-provider-probes-get-route",
      message: "Imagery provider probe history lookup failed.",
    });
  }
}

export async function POST(request: Request) {
  try {
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const actor = await resolveRequestActor(request, runtime, {
      allowDevelopmentFallback: false,
    });
    const fieldId = readRequiredFieldId(request);
    const body = await readJsonObject(request);
    const requestedAtValue = body?.requestedAt;
    const requestedAt =
      typeof requestedAtValue === "string" && requestedAtValue.trim().length > 0
        ? requestedAtValue.trim()
        : undefined;

    const records = await runtime.services.imagery.recordProviderProbeForField({
      workspaceId: actor.workspaceId,
      fieldId,
      requestedAt,
    });

    return jsonOk(
      {
        records,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonServerError(error, {
      event: "imagery-provider-probes-post-route",
      message: "Imagery provider probe history record failed.",
    });
  }
}
