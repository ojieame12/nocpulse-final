import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "./route";

test("spreadsheet preview route rejects unreadable upload bodies", async () => {
  const response = await POST(
    new Request("http://localhost/api/field-intake/spreadsheet/preview", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        file: "not-a-form-upload",
      }),
    }),
  );

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.error.code, "invalid_request_body");
});

test("spreadsheet preview route rejects missing files", async () => {
  const formData = new FormData();

  const response = await POST(
    new Request("http://localhost/api/field-intake/spreadsheet/preview", {
      method: "POST",
      body: formData,
    }),
  );

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.error.code, "file_required");
});

test("spreadsheet preview route rejects empty files", async () => {
  const formData = new FormData();
  formData.set(
    "file",
    new File([""], "empty.csv", {
      type: "text/csv",
    }),
  );

  const response = await POST(
    new Request("http://localhost/api/field-intake/spreadsheet/preview", {
      method: "POST",
      body: formData,
    }),
  );

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.error.code, "file_empty");
});
