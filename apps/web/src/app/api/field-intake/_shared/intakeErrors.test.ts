import test from "node:test";
import assert from "node:assert/strict";

import { RequestContextError } from "../../../../server/runtime/resolveRequestContext";
import {
  handleFieldIntakeRouteError,
  withFieldIntakeRateLimitCode,
} from "./intakeErrors";

const FALLBACK = {
  code: "lld_lookup_failed" as const,
  event: "field-intake-test",
  message: "Fallback failure message.",
  status: 400,
};

test("handleFieldIntakeRouteError classifies invalid LLD format", async () => {
  const response = handleFieldIntakeRouteError(
    new Error("Use QUARTER-SECTION-TOWNSHIP-RANGE-WMERIDIAN, for example NW-25-042-04-W4."),
    FALLBACK,
  );
  const payload = (await response.json()) as {
    error: { code: string; message: string; detail?: string };
  };

  assert.equal(response.status, 400);
  assert.equal(payload.error.code, "invalid_lld_format");
  assert.match(payload.error.message, /legal land description format/i);
  assert.match(payload.error.detail ?? "", /NW-25-042-04-W4/);
});

test("handleFieldIntakeRouteError classifies request-context auth failures", async () => {
  const response = handleFieldIntakeRouteError(
    new RequestContextError(401, "[auth] No Supabase session was provided for this request."),
    FALLBACK,
  );
  const payload = (await response.json()) as {
    error: { code: string; message: string };
  };

  assert.equal(response.status, 401);
  assert.equal(payload.error.code, "authentication_required");
  assert.match(payload.error.message, /sign in again/i);
});

test("handleFieldIntakeRouteError classifies missing spreadsheet uploads", async () => {
  const response = handleFieldIntakeRouteError(
    new RequestContextError(400, "Form field `file` is required."),
    {
      code: "spreadsheet_preview_failed",
      event: "field-intake-spreadsheet-preview-test",
      message: "Spreadsheet preview failed.",
      status: 400,
    },
  );
  const payload = (await response.json()) as {
    error: { code: string; message: string };
  };

  assert.equal(payload.error.code, "file_required");
  assert.match(payload.error.message, /choose a file/i);
});

test("handleFieldIntakeRouteError uses spreadsheet-specific fallback for unknown preview errors", async () => {
  const response = handleFieldIntakeRouteError(
    new Error("Workbook parser exploded"),
    {
      code: "spreadsheet_preview_failed",
      event: "field-intake-spreadsheet-preview-test",
      message: "Spreadsheet preview failed.",
      status: 400,
    },
  );
  const payload = (await response.json()) as {
    error: { code: string; message: string; detail?: string };
  };

  assert.equal(payload.error.code, "spreadsheet_preview_failed");
  assert.match(payload.error.message, /could not read that spreadsheet/i);
  assert.equal(payload.error.detail, "Workbook parser exploded");
});

test("withFieldIntakeRateLimitCode preserves rate-limit details and adds code", async () => {
  const response = Response.json(
    {
      error: {
        message: "Too many LLD lookup requests. Wait 2 minutes and try again.",
        details: {
          retryAfterSeconds: 120,
        },
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": "120",
      },
    },
  );

  const wrapped = await withFieldIntakeRateLimitCode(response);
  const payload = (await wrapped.json()) as {
    error: { code: string; message: string; details?: { retryAfterSeconds?: number } };
  };

  assert.equal(wrapped.status, 429);
  assert.equal(wrapped.headers.get("Retry-After"), "120");
  assert.equal(payload.error.code, "rate_limited");
  assert.equal(payload.error.details?.retryAfterSeconds, 120);
});
