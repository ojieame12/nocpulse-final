export class AddFieldApiError extends Error {
  readonly code: string | null;
  readonly status: number;
  readonly detail: string | null;
  readonly details: unknown;

  constructor(input: {
    message: string;
    status: number;
    code?: string | null;
    detail?: string | null;
    details?: unknown;
  }) {
    super(input.message);
    this.name = "AddFieldApiError";
    this.code = input.code ?? null;
    this.status = input.status;
    this.detail = input.detail ?? null;
    this.details = input.details;
  }
}

export type AddFieldRetryAction =
  | "lld-lookup"
  | "lld-create"
  | "boundary-parse"
  | "boundary-create"
  | "spreadsheet-preview"
  | "spreadsheet-commit";

export async function readAddFieldApiResult<T>(response: Response): Promise<T> {
  let payload: {
    result?: T;
    error?: {
      code?: string;
      message?: string;
      detail?: string;
      details?: unknown;
    };
  };

  try {
    payload = (await response.json()) as {
      result?: T;
      error?: {
        code?: string;
        message?: string;
        detail?: string;
        details?: unknown;
      };
    };
  } catch {
    throw new AddFieldApiError({
      status: response.status,
      code: "invalid_response",
      message: response.ok
        ? "Field intake completed with an unreadable response."
        : "Field intake returned an unreadable error response.",
    });
  }

  if (!response.ok) {
    throw new AddFieldApiError({
      status: response.status,
      code: payload.error?.code ?? null,
      message: payload.error?.message ?? "Field intake request failed.",
      detail: payload.error?.detail ?? null,
      details: payload.error?.details,
    });
  }

  if (!payload.result) {
    throw new AddFieldApiError({
      status: response.status,
      code: "missing_result",
      message: "Field intake completed without a result payload.",
    });
  }

  return payload.result;
}

export function describeAddFieldApiError(error: unknown) {
  if (!(error instanceof AddFieldApiError)) {
    return error instanceof Error ? error.message : "Field intake request failed.";
  }

  switch (error.code) {
    case "invalid_lld_format":
      return "That legal land description format was not recognized. Use quarter-section-township-range-meridian, for example NW-25-042-04-W4.";
    case "invalid_lld_component":
      return "That legal land description is incomplete or out of range. Check the quarter, section, township, range, and meridian and try again.";
    case "authentication_required":
      return "Your session expired. Sign in again, then retry the field intake step.";
    case "workspace_access_denied":
      return "You do not have access to add fields in this workspace.";
    case "runtime_unavailable":
      return "Field intake is temporarily unavailable. Retry in a minute.";
    case "request_timeout":
      return "That field intake step took too long to respond. Retry in a moment.";
    case "network_unreachable":
      return "We could not reach field intake. Check your connection and retry.";
    case "invalid_response":
      return "Field intake returned an unreadable response. Retry in a moment.";
    case "file_required":
      return "Choose a file before continuing.";
    case "file_empty":
      return "The uploaded file is empty.";
    case "file_too_large":
      return error.detail ?? "That file is too large for field intake.";
    case "unsupported_boundary_file":
      return "That boundary file format is not supported. Use GeoJSON, JSON, or KML.";
    case "invalid_boundary_file":
      return "We could not parse that boundary file into a usable field boundary.";
    case "spreadsheet_empty":
      return "We could not find any importable rows in that spreadsheet.";
    case "spreadsheet_preview_failed":
      return "We could not read that spreadsheet file. Check the file and try again.";
    case "import_batch_not_found":
      return "That saved spreadsheet import could not be found. Upload the file again and retry the import.";
    case "hydration_retry_failed":
      return "We could not retry field hydration for that field. Try again in a moment.";
    case "rate_limited":
      return error.message;
    case "invalid_request_body":
    case "invalid_payload":
      return error.message;
    default:
      return error.message;
  }
}

export function resolveAddFieldRetryLabel(action: AddFieldRetryAction | null) {
  switch (action) {
    case "lld-lookup":
      return "Retry lookup";
    case "lld-create":
      return "Retry create";
    case "boundary-parse":
      return "Retry parse";
    case "boundary-create":
      return "Retry create";
    case "spreadsheet-preview":
      return "Retry preview";
    case "spreadsheet-commit":
      return "Retry import";
    default:
      return null;
  }
}
