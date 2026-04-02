import { jsonServerError } from "../../../../server/http/json";
import { RequestContextError } from "../../../../server/runtime/resolveRequestContext";

export type FieldIntakeErrorCode =
  | "authentication_required"
  | "boundary_create_failed"
  | "boundary_parse_failed"
  | "file_empty"
  | "file_required"
  | "file_too_large"
  | "import_batch_commit_failed"
  | "import_batch_not_found"
  | "import_batch_save_failed"
  | "invalid_boundary_file"
  | "invalid_lld_component"
  | "invalid_lld_format"
  | "invalid_payload"
  | "invalid_request_body"
  | "lld_create_failed"
  | "lld_lookup_failed"
  | "rate_limited"
  | "runtime_unavailable"
  | "spreadsheet_empty"
  | "spreadsheet_preview_failed"
  | "unsupported_boundary_file"
  | "workspace_access_denied";

type FieldIntakeRouteFallback = {
  code: FieldIntakeErrorCode;
  message: string;
  event: string;
  status?: number;
};

type ClassifiedFieldIntakeError = {
  code: FieldIntakeErrorCode;
  message: string;
  status: number;
  detail?: string;
};

type FieldIntakeErrorResponseBody = {
  error: {
    code: FieldIntakeErrorCode;
    message: string;
    detail?: string;
    details?: unknown;
  };
};

function buildFieldIntakeErrorBody(input: {
  code: FieldIntakeErrorCode;
  message: string;
  detail?: string;
  details?: unknown;
}): FieldIntakeErrorResponseBody {
  return {
    error: {
      code: input.code,
      message: input.message,
      ...(input.detail ? { detail: input.detail } : {}),
      ...(input.details === undefined ? {} : { details: input.details }),
    },
  };
}

export function jsonFieldIntakeError(input: {
  status: number;
  code: FieldIntakeErrorCode;
  message: string;
  detail?: string;
  details?: unknown;
  headers?: HeadersInit;
}) {
  return Response.json(buildFieldIntakeErrorBody(input), {
    status: input.status,
    headers: input.headers,
  });
}

export async function withFieldIntakeRateLimitCode(response: Response) {
  const headers = new Headers(response.headers);

  try {
    const payload = (await response.json()) as {
      error?: {
        message?: string;
        detail?: string;
        details?: unknown;
      };
    };

    return jsonFieldIntakeError({
      status: response.status,
      code: "rate_limited",
      message:
        payload.error?.message ??
        "Too many field intake requests. Wait a moment and try again.",
      detail: payload.error?.detail,
      details: payload.error?.details,
      headers,
    });
  } catch {
    return jsonFieldIntakeError({
      status: response.status,
      code: "rate_limited",
      message: "Too many field intake requests. Wait a moment and try again.",
      headers,
    });
  }
}

export function handleFieldIntakeRouteError(
  error: unknown,
  fallback: FieldIntakeRouteFallback,
) {
  const classified = classifyFieldIntakeError(error, fallback);

  if (classified) {
    return jsonFieldIntakeError(classified);
  }

  return jsonServerError(error, {
    status: fallback.status ?? 500,
    event: fallback.event,
    message: fallback.message,
  });
}

function classifyFieldIntakeError(
  error: unknown,
  fallback: FieldIntakeRouteFallback,
): ClassifiedFieldIntakeError | null {
  if (error instanceof RequestContextError) {
    return classifyRequestContextError(error, fallback);
  }

  if (!(error instanceof Error)) {
    return null;
  }

  const message = error.message.trim();

  if (!message) {
    return null;
  }

  if (message.includes("Supabase runtime is not configured")) {
    return {
      code: "runtime_unavailable",
      message: "Field intake is temporarily unavailable.",
      status: 503,
    };
  }

  if (
    message === "Enter an LLD code before looking up a boundary."
    || message.startsWith("Use QUARTER-SECTION-TOWNSHIP-RANGE-WMERIDIAN")
  ) {
    return {
      code: "invalid_lld_format",
      message:
        "That legal land description format was not recognized. Use quarter-section-township-range-meridian.",
      status: 400,
      detail: message,
    };
  }

  if (
    message === "Quarter must be one of NE, NW, SE, or SW."
    || message === "Meridian must be W1, W2, W3, W4, W5, or W6."
    || message === "Section must be between 1 and 36."
    || message === "Township must be between 1 and 126."
    || message === "Range must be between 1 and 34."
    || message.endsWith("must contain digits only.")
  ) {
    return {
      code: "invalid_lld_component",
      message:
        "That legal land description is incomplete or out of range. Check the quarter, section, township, range, and meridian and try again.",
      status: 400,
      detail: message,
    };
  }

  if (message === "Expected a JSON request body." || message === "Expected multipart form data.") {
    return {
      code: "invalid_request_body",
      message: "We could not read that field intake request.",
      status: 400,
      detail: message,
    };
  }

  if (message.startsWith("Form field `file` is required.")) {
    return {
      code: "file_required",
      message: "Choose a file before continuing.",
      status: 400,
    };
  }

  if (message.startsWith("Uploaded file `file` is empty.")) {
    return {
      code: "file_empty",
      message: "The uploaded file is empty.",
      status: 400,
    };
  }

  if (message.startsWith("Uploaded file `file` exceeds")) {
    return {
      code: "file_too_large",
      message: "That file is too large for field intake.",
      status: 413,
      detail: message,
    };
  }

  if (message.includes("file format could not be detected")) {
    return {
      code: "unsupported_boundary_file",
      message: "That boundary file format is not supported. Use GeoJSON, JSON, or KML.",
      status: 400,
      detail: message,
    };
  }

  if (
    message.includes("GeoJSON file could not be parsed")
    || message.includes("file does not contain a valid GeoJSON object")
    || message.includes("feature collection does not contain features")
    || message.includes("geometry is missing or invalid")
    || message.includes("multipolygon coordinates are invalid")
    || message.includes("polygon coordinates are invalid")
    || message.includes("polygon ring must contain at least four points")
    || message.includes("invalid GeoJSON point coordinate")
  ) {
    return {
      code: "invalid_boundary_file",
      message: "We could not parse that boundary file into a usable field shape.",
      status: 400,
      detail: message,
    };
  }

  if (
    message.includes("spreadsheet does not contain any sheets")
    || message.includes("spreadsheet is empty")
  ) {
    return {
      code: "spreadsheet_empty",
      message: "That spreadsheet does not contain any importable rows.",
      status: 400,
      detail: message,
    };
  }

  if (message.includes("import batch") && message.includes("was not found")) {
    return {
      code: "import_batch_not_found",
      message: "That spreadsheet import could not be found. Upload the file again and retry the import.",
      status: 404,
      detail: message,
    };
  }

  if (message.includes(":") || message.includes("Field `")) {
    return {
      code: "invalid_payload",
      message: "We could not validate that field intake request.",
      status: 400,
      detail: message,
    };
  }

  if (fallback.code === "spreadsheet_preview_failed") {
    return {
      code: "spreadsheet_preview_failed",
      message: "We could not read that spreadsheet file.",
      status: fallback.status ?? 400,
      detail: message,
    };
  }

  if (fallback.code === "boundary_parse_failed") {
    return {
      code: "boundary_parse_failed",
      message: "We could not parse that boundary file.",
      status: fallback.status ?? 400,
      detail: message,
    };
  }

  return null;
}

function classifyRequestContextError(
  error: RequestContextError,
  fallback: FieldIntakeRouteFallback,
): ClassifiedFieldIntakeError | null {
  const message = error.message.trim();

  if (error.status === 401) {
    return {
      code: "authentication_required",
      message: "Your session is no longer valid. Sign in again and retry field intake.",
      status: 401,
      detail: message,
    };
  }

  if (error.status === 403) {
    return {
      code: "workspace_access_denied",
      message: "You do not have access to create or import fields in this workspace.",
      status: 403,
      detail: message,
    };
  }

  if (error.status === 413) {
    return {
      code: "file_too_large",
      message: "That file is too large for field intake.",
      status: 413,
      detail: message,
    };
  }

  if (
    message === "Expected a JSON request body."
    || message === "Expected multipart form data."
  ) {
    return {
      code: "invalid_request_body",
      message: "We could not read that field intake request.",
      status: 400,
      detail: message,
    };
  }

  if (message.startsWith("Form field `file` is required.")) {
    return {
      code: "file_required",
      message: "Choose a file before continuing.",
      status: 400,
    };
  }

  if (message.startsWith("Uploaded file `file` is empty.")) {
    return {
      code: "file_empty",
      message: "The uploaded file is empty.",
      status: 400,
    };
  }

  if (message.startsWith("Uploaded file `file` exceeds")) {
    return {
      code: "file_too_large",
      message: "That file is too large for field intake.",
      status: 413,
      detail: message,
    };
  }

  if (error.status === 400 && message) {
    return {
      code: "invalid_payload",
      message: "We could not validate that field intake request.",
      status: 400,
      detail: message,
    };
  }

  if (message) {
    return {
      code: fallback.code,
      message: fallback.message,
      status: error.status,
      detail: message,
    };
  }

  return null;
}
