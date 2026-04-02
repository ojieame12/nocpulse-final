import test from "node:test";
import assert from "node:assert/strict";

import {
  AddFieldApiError,
  describeAddFieldApiError,
  readAddFieldApiResult,
} from "../addFieldPanelErrors";

test("describeAddFieldApiError returns actionable copy for invalid LLD format", () => {
  const message = describeAddFieldApiError(
    new AddFieldApiError({
      status: 400,
      code: "invalid_lld_format",
      message: "That legal land description format was not recognized.",
    }),
  );

  assert.match(message, /quarter-section-township-range-meridian/i);
});

test("describeAddFieldApiError preserves rate-limit messaging", () => {
  const message = describeAddFieldApiError(
    new AddFieldApiError({
      status: 429,
      code: "rate_limited",
      message: "Too many field intake requests. Wait 2 minutes and try again.",
    }),
  );

  assert.equal(message, "Too many field intake requests. Wait 2 minutes and try again.");
});

test("readAddFieldApiResult throws AddFieldApiError with code and detail", async () => {
  const response = Response.json(
    {
      error: {
        code: "spreadsheet_preview_failed",
        message: "We could not preview that spreadsheet import.",
        detail: "Workbook parser exploded",
      },
    },
    { status: 400 },
  );

  await assert.rejects(
    () => readAddFieldApiResult(response),
    (error: unknown) => {
      assert.ok(error instanceof AddFieldApiError);
      assert.equal(error.code, "spreadsheet_preview_failed");
      assert.equal(error.detail, "Workbook parser exploded");
      return true;
    },
  );
});
