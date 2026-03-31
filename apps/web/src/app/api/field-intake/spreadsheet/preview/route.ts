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
  MAX_SPREADSHEET_UPLOAD_BYTES,
  readUploadedFile,
} from "../../../../../server/http/uploads";
import { getWebServerRuntime } from "../../../../../server/runtime/getWebServerRuntime";
import { RequestContextError } from "../../../../../server/runtime/resolveRequestContext";

const FIELD_INTAKE_SPREADSHEET_PREVIEW_IP_RATE_LIMIT = {
  scope: "field-intake-spreadsheet-preview-upload:ip",
  maxAttempts: 20,
  windowSeconds: 15 * 60,
} as const;

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return jsonError(400, "Expected multipart form data.");
  }

  try {
    const file = readUploadedFile(formData, "file", {
      maxBytes: MAX_SPREADSHEET_UPLOAD_BYTES,
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
          ...FIELD_INTAKE_SPREADSHEET_PREVIEW_IP_RATE_LIMIT,
          message: "Too many spreadsheet preview requests.",
        }),
      ],
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const result = await runtime.services.fieldIntake.previewSpreadsheetImport({
      fileName: file.name || "spreadsheet-upload",
      buffer: await file.arrayBuffer(),
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
      event: "field-intake-spreadsheet-preview-route",
      message: "Spreadsheet preview failed.",
    });
  }
}
