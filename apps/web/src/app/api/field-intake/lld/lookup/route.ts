import { jsonError, jsonOk, readJsonObject } from "../../../../../server/http/json";
import { getWebServerRuntime } from "../../../../../server/runtime/getWebServerRuntime";

export async function POST(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonError(400, "Expected a JSON request body.");
  }

  const code = typeof body.code === "string" ? body.code : null;
  const suggestedFieldName =
    typeof body.suggestedFieldName === "string"
      ? body.suggestedFieldName
      : undefined;

  if (!code) {
    return jsonError(400, "Field `code` is required.");
  }

  try {
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const result = await runtime.services.fieldIntake.lookupLldBoundary({
      code,
      suggestedFieldName,
    });

    return jsonOk({
      result,
    });
  } catch (error) {
    return jsonError(
      400,
      error instanceof Error ? error.message : "LLD lookup failed.",
    );
  }
}
