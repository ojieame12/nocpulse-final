import {
  jsonOk,
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
import {
  handleFieldIntakeRouteError,
  jsonFieldIntakeError,
  withFieldIntakeRateLimitCode,
} from "../../_shared/intakeErrors";

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
    return jsonFieldIntakeError({
      status: 400,
      code: "invalid_request_body",
      message: "We could not read that spreadsheet upload.",
    });
  }

  try {
    const file = readUploadedFile(formData, "file", {
      maxBytes: MAX_SPREADSHEET_UPLOAD_BYTES,
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
          ...FIELD_INTAKE_SPREADSHEET_PREVIEW_IP_RATE_LIMIT,
          message: "Too many spreadsheet preview requests.",
        }),
      ],
    });

    if (rateLimitResponse) {
      return withFieldIntakeRateLimitCode(rateLimitResponse);
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
      return handleFieldIntakeRouteError(error, {
        event: "field-intake-spreadsheet-preview-route",
        code: "spreadsheet_preview_failed",
        message: "We could not preview that spreadsheet import.",
        status: error.status,
      });
    }

    return handleFieldIntakeRouteError(error, {
      event: "field-intake-spreadsheet-preview-route",
      code: "spreadsheet_preview_failed",
      message: "We could not preview that spreadsheet import.",
      status: 400,
    });
  }
}
