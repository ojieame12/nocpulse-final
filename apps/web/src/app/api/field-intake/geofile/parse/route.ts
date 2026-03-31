import {
  jsonError,
  jsonOk,
  jsonServerError,
} from "../../../../../server/http/json";
import {
  buildIpRateLimitRule,
  enforceRouteRateLimits,
} from "../../../../../server/auth/routeRateLimit";
import {
  nullableTrimmedText,
  parseWithSchema,
  z,
} from "../../../../../server/http/validation";
import {
  MAX_BOUNDARY_UPLOAD_BYTES,
  readUploadedFile,
} from "../../../../../server/http/uploads";
import { getWebServerRuntime } from "../../../../../server/runtime/getWebServerRuntime";
import { RequestContextError } from "../../../../../server/runtime/resolveRequestContext";

const FIELD_INTAKE_GEOFILE_PARSE_IP_RATE_LIMIT = {
  scope: "field-intake-geofile-parse:ip",
  maxAttempts: 25,
  windowSeconds: 15 * 60,
} as const;

const GeofileParseFormSchema = z.object({
  suggestedFieldName: nullableTrimmedText(),
});

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return jsonError(400, "Expected multipart form data.");
  }

  try {
    const file = readUploadedFile(formData, "file", {
      maxBytes: MAX_BOUNDARY_UPLOAD_BYTES,
    });
    const payload = parseWithSchema(GeofileParseFormSchema, {
      suggestedFieldName: formData.get("suggestedFieldName"),
    });
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }
    const rateLimitResponse = await enforceRouteRateLimits({
      runtime,
      rules: [
        buildIpRateLimitRule({
          request,
          ...FIELD_INTAKE_GEOFILE_PARSE_IP_RATE_LIMIT,
          message: "Too many geofile parse requests.",
        }),
      ],
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const result = await runtime.services.fieldIntake.parseBoundaryFile({
      content: await file.text(),
      fileName: file.name,
      mimeType: file.type || undefined,
      suggestedFieldName: payload.suggestedFieldName ?? undefined,
    });

    return jsonOk({
      result,
    });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonServerError(error, {
      status: 400,
      event: "field-intake-geofile-parse-route",
      message: "Geofile parsing failed.",
    });
  }
}
