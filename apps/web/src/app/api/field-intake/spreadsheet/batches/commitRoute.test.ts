import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "./[batchId]/commit/route";

test("spreadsheet batch commit route rejects unreadable request bodies", async () => {
  const response = await POST(
    new Request("http://localhost/api/field-intake/spreadsheet/batches/batch-1/commit", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "{",
    }),
    {
      params: Promise.resolve({
        batchId: "batch-1",
      }),
    },
  );

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.error.code, "invalid_request_body");
});

test("spreadsheet batch commit route rejects missing batch ids", async () => {
  const response = await POST(
    new Request("http://localhost/api/field-intake/spreadsheet/batches//commit", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        onboardingDryRun: false,
      }),
    }),
    {
      params: Promise.resolve({
        batchId: "",
      }),
    },
  );

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.error.code, "invalid_payload");
  assert.match(payload.error.message, /missing a batch id/i);
});
