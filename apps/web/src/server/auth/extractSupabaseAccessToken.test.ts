import test from "node:test";
import assert from "node:assert/strict";
import { extractSupabaseAccessToken } from "./extractSupabaseAccessToken";

test("extractSupabaseAccessToken decodes base64 Supabase auth cookies", () => {
  const accessToken = "header.payload.signature";
  const cookiePayload = Buffer.from(
    JSON.stringify({
      access_token: accessToken,
      refresh_token: "refresh-token",
    }),
    "utf8",
  ).toString("base64");
  const request = new Request("http://localhost/api/auth/actor", {
    headers: {
      cookie: `sb-project-ref-auth-token=base64-${cookiePayload}`,
    },
  });

  assert.equal(
    extractSupabaseAccessToken(request, {
      projectRef: "project-ref",
    }),
    accessToken,
  );
});
