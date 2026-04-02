import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "./route";

test("lld lookup route rejects unreadable request bodies", async () => {
  const response = await POST(
    new Request("http://localhost/api/field-intake/lld/lookup", {
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

test("lld lookup route rejects missing LLD code payloads", async () => {
  const response = await POST(
    new Request("http://localhost/api/field-intake/lld/lookup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        suggestedFieldName: "North Quarter",
      }),
    }),
  );

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.error.code, "invalid_payload");
  assert.match(payload.error.detail, /code: Required/);
});
