import { jsonError, jsonOk } from "../../../../../server/http/json";
import { getWebServerRuntime } from "../../../../../server/runtime/getWebServerRuntime";

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

  const suggestedFieldNameValue = formData.get("suggestedFieldName");
  const suggestedFieldName =
    typeof suggestedFieldNameValue === "string" && suggestedFieldNameValue.trim()
      ? suggestedFieldNameValue
      : undefined;

  try {
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const result = await runtime.services.fieldIntake.parseBoundaryFile({
      content: await file.text(),
      fileName: file.name,
      mimeType: file.type || undefined,
      suggestedFieldName,
    });

    return jsonOk({
      result,
    });
  } catch (error) {
    return jsonError(
      400,
      error instanceof Error ? error.message : "Geofile parsing failed.",
    );
  }
}
