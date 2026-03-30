import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGrantAccessUrl,
  createGrantAccessToken,
  verifyGrantAccessToken,
} from "./grantAccessToken";

const SECRET = "test-secret";

test("grant access tokens round-trip a bound payload", () => {
  const token = createGrantAccessToken(
    {
      requestId: "8a53d5b1-9d4f-4f29-a0c7-ff0b6564a9ae",
      requestEmail: "Grower@Example.com",
      workspaceId: "1e3d9f8b-6273-48f5-8f40-b194d5cdba36",
      grantedByUserId: "2815ca4d-d1aa-4c9b-bc41-cf82cb5d61b4",
      role: "member",
      recipientEmail: "nathan@ojieame.design",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
    SECRET,
  );

  const verification = verifyGrantAccessToken(token, SECRET);

  assert.equal(verification.ok, true);

  if (verification.ok) {
    assert.equal(verification.payload.requestEmail, "grower@example.com");
    assert.equal(verification.payload.workspaceId, "1e3d9f8b-6273-48f5-8f40-b194d5cdba36");
    assert.equal(verification.payload.recipientEmail, "nathan@ojieame.design");
  }
});

test("grant access tokens reject tampering and expiry", () => {
  const expiredToken = createGrantAccessToken(
    {
      requestId: "8a53d5b1-9d4f-4f29-a0c7-ff0b6564a9ae",
      requestEmail: "grower@example.com",
      workspaceId: "1e3d9f8b-6273-48f5-8f40-b194d5cdba36",
      grantedByUserId: "2815ca4d-d1aa-4c9b-bc41-cf82cb5d61b4",
      role: "member",
      recipientEmail: "nathan@ojieame.design",
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    },
    SECRET,
  );
  const validToken = createGrantAccessToken(
    {
      requestId: "8a53d5b1-9d4f-4f29-a0c7-ff0b6564a9ae",
      requestEmail: "grower@example.com",
      workspaceId: "1e3d9f8b-6273-48f5-8f40-b194d5cdba36",
      grantedByUserId: "2815ca4d-d1aa-4c9b-bc41-cf82cb5d61b4",
      role: "member",
      recipientEmail: "nathan@ojieame.design",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
    SECRET,
  );

  assert.deepEqual(verifyGrantAccessToken(expiredToken, SECRET), {
    ok: false,
    reason: "expired",
  });

  const tamperedToken =
    `${validToken.slice(0, -1)}${validToken.endsWith("a") ? "b" : "a"}`;
  const verification = verifyGrantAccessToken(tamperedToken, SECRET);
  assert.equal(verification.ok, false);
  if (!verification.ok) {
    assert.equal(verification.reason, "invalid-signature");
  }
});

test("buildGrantAccessUrl emits a token query param", () => {
  const url = buildGrantAccessUrl({
    appOrigin: "https://fieldpulse-v3.vercel.app",
    secret: SECRET,
    payload: {
      requestId: "8a53d5b1-9d4f-4f29-a0c7-ff0b6564a9ae",
      requestEmail: "grower@example.com",
      workspaceId: "1e3d9f8b-6273-48f5-8f40-b194d5cdba36",
      grantedByUserId: "2815ca4d-d1aa-4c9b-bc41-cf82cb5d61b4",
      role: "member",
      recipientEmail: "nathan@ojieame.design",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  });

  assert.match(url, /^https:\/\/fieldpulse-v3\.vercel\.app\/api\/grant-access\?token=/);
});
