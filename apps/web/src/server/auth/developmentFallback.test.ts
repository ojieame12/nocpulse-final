import assert from "node:assert/strict";
import test from "node:test";
import {
  createDevelopmentFallbackToken,
  DEVELOPMENT_FALLBACK_COOKIE_NAME,
  DEVELOPMENT_FALLBACK_HEADER,
  isDevelopmentFallbackRequestAllowed,
  requestHasValidDevelopmentFallbackToken,
} from "./developmentFallback";

test("development fallback is allowed for localhost requests in development", () => {
  const request = new Request("http://localhost:3010/api/test");

  assert.equal(
    isDevelopmentFallbackRequestAllowed({
      nodeEnv: "development",
      request,
    }),
    true,
  );
});

test("development fallback is rejected for non-loopback hosts", () => {
  const request = new Request("https://preview.fieldpulse.app/api/test", {
    headers: {
      origin: "https://preview.fieldpulse.app",
    },
  });

  assert.equal(
    isDevelopmentFallbackRequestAllowed({
      nodeEnv: "development",
      request,
    }),
    false,
  );
});

test("development fallback token validates from header and cookie", async () => {
  const token = await createDevelopmentFallbackToken({
    serviceRoleKey: "test-service-role-key",
    devActorUserId: "11111111-1111-4111-8111-111111111111",
  });

  assert.ok(token);

  const headerRequest = new Request("http://localhost/api/test", {
    headers: {
      [DEVELOPMENT_FALLBACK_HEADER]: token!,
    },
  });
  const cookieRequest = new Request("http://localhost/api/test", {
    headers: {
      cookie: `${DEVELOPMENT_FALLBACK_COOKIE_NAME}=${token}`,
    },
  });

  assert.equal(
    await requestHasValidDevelopmentFallbackToken({
      request: headerRequest,
      serviceRoleKey: "test-service-role-key",
      devActorUserId: "11111111-1111-4111-8111-111111111111",
    }),
    true,
  );
  assert.equal(
    await requestHasValidDevelopmentFallbackToken({
      request: cookieRequest,
      serviceRoleKey: "test-service-role-key",
      devActorUserId: "11111111-1111-4111-8111-111111111111",
    }),
    true,
  );
});
