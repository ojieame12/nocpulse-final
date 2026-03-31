import { jsonError, jsonOk, readJsonObject } from "../../../../server/http/json";
import { getWebServerRuntime } from "../../../../server/runtime/getWebServerRuntime";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../../server/runtime/resolveRequestContext";

function hasBodyKey(body: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function readRequiredName(body: Record<string, unknown>) {
  const value = typeof body.name === "string" ? body.name.trim() : "";

  if (!value) {
    throw new RequestContextError(400, "[fields] name must be a non-empty string.");
  }

  return value;
}

function readOptionalLegalLandDescription(body: Record<string, unknown>) {
  const value = body.legalLandDescription;

  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new RequestContextError(
      400,
      "[fields] legalLandDescription must be a string or null.",
    );
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ fieldId: string }> },
) {
  try {
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const actor = await resolveRequestActor(request, runtime);
    const { fieldId } = await context.params;
    const body = await readJsonObject(request);

    if (!body) {
      return jsonError(400, "Expected a JSON request body.");
    }

    const hasName = hasBodyKey(body, "name");
    const hasLegalLandDescription = hasBodyKey(body, "legalLandDescription");

    if (!hasName && !hasLegalLandDescription) {
      return jsonError(
        400,
        "[fields] expected at least one mutable field in the request body.",
      );
    }

    let detail = null;

    if (hasName) {
      detail = await runtime.services.fields.renameField({
        workspaceId: actor.workspaceId,
        fieldId,
        name: readRequiredName(body),
      });
    }

    if (hasLegalLandDescription) {
      detail = await runtime.services.fields.setLegalLandDescription({
        workspaceId: actor.workspaceId,
        fieldId,
        legalLandDescription: readOptionalLegalLandDescription(body),
      });
    }

    return jsonOk({ field: detail });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonError(
      500,
      error instanceof Error ? error.message : "Field update failed.",
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ fieldId: string }> },
) {
  try {
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const actor = await resolveRequestActor(request, runtime);
    const { fieldId } = await context.params;

    await runtime.services.fields.deleteField({
      workspaceId: actor.workspaceId,
      fieldId,
    });

    return jsonOk({ deleted: true });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonError(
      500,
      error instanceof Error ? error.message : "Field deletion failed.",
    );
  }
}
