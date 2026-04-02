import {
  jsonOk,
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
import {
  handleFieldIntakeRouteError,
  jsonFieldIntakeError,
  withFieldIntakeRateLimitCode,
} from "../../_shared/intakeErrors";

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
    return jsonFieldIntakeError({
      status: 400,
      code: "invalid_request_body",
      message: "We could not read that boundary upload.",
    });
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
      return jsonFieldIntakeError({
        status: 503,
        code: "runtime_unavailable",
        message: "Field intake is temporarily unavailable.",
      });
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
      return withFieldIntakeRateLimitCode(rateLimitResponse);
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
      return handleFieldIntakeRouteError(error, {
        event: "field-intake-geofile-parse-route",
        code: "boundary_parse_failed",
        message: "We could not parse that boundary file.",
        status: error.status,
      });
    }

    return handleFieldIntakeRouteError(error, {
      event: "field-intake-geofile-parse-route",
      code: "boundary_parse_failed",
      message: "We could not parse that boundary file.",
      status: 400,
    });
  }
}
