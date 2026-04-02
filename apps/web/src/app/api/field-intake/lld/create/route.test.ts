import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "./route";

test("lld create route rejects unreadable request bodies", async () => {
  const response = await POST(
    new Request("http://localhost/api/field-intake/lld/create", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "{",
    }),
  );

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.error.code, "invalid_request_body");
});

test("lld create route rejects invalid seeding date payloads", async () => {
  const response = await POST(
    new Request("http://localhost/api/field-intake/lld/create", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        code: "NW-25-042-04-W4",
        seedingDate: "04/02/2026",
      }),
    }),
  );

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.error.code, "invalid_payload");
  assert.match(payload.error.detail, /Field `seedingDate` must use YYYY-MM-DD format\./);
});
