import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGuestShareCookiePayload,
  buildGuestShareCookieValue,
  getActiveWorkspaceShare,
  hasActiveGuestShareCookie,
  lookupWorkspaceShareToken,
  parseGuestShareCookieValue,
  revokeWorkspaceShareById,
  revokeWorkspaceSharesForField,
} from "./guestShareSession";

function createLookupClient(
  data: {
    id: string;
    workspace_id: string;
    field_id: string;
    created_at: string;
    expires_at: string;
    revoked_at: string | null;
  } | null,
) {
  const query = {
    select() {
      return query;
    },
    eq() {
      return query;
    },
    async maybeSingle() {
      return {
        data,
        error: null,
      };
    },
  };

  return {
    from() {
      return query;
    },
  } as Parameters<typeof lookupWorkspaceShareToken>[0]["client"];
}

function createActiveShareClient(
  data: {
    id: string;
    workspace_id: string;
    field_id: string;
    created_at: string;
    expires_at: string;
    revoked_at: string | null;
    last_accessed_at: string | null;
  } | null,
) {
  const query = {
    select() {
      return query;
    },
    eq() {
      return query;
    },
    is() {
      return query;
    },
    gt() {
      return query;
    },
    order() {
      return query;
    },
    limit() {
      return query;
    },
    async maybeSingle() {
      return {
        data,
        error: null,
      };
    },
  };

  return {
    from() {
      return query;
    },
  } as Parameters<typeof getActiveWorkspaceShare>[0]["client"];
}

test("guest share cookies round-trip through serialization", () => {
  const payload = buildGuestShareCookiePayload(
    "token-123",
    "2030-01-01T00:00:00.000Z",
  );
  const serialized = buildGuestShareCookieValue(payload);

  assert.deepEqual(parseGuestShareCookieValue(serialized), payload);
});

test("guest share cookies reject malformed payloads", () => {
  assert.equal(parseGuestShareCookieValue(null), null);
  assert.equal(parseGuestShareCookieValue("not-json"), null);
  assert.equal(
    parseGuestShareCookieValue(
      encodeURIComponent(JSON.stringify({ token: "", expiresAt: "bad" })),
    ),
    null,
  );
});

test("guest share cookies only count as active before expiry", () => {
  const futureCookie = buildGuestShareCookieValue(
    buildGuestShareCookiePayload(
      "future-token",
      "2030-01-01T00:00:00.000Z",
    ),
  );
  const expiredCookie = buildGuestShareCookieValue(
    buildGuestShareCookiePayload(
      "expired-token",
      "2020-01-01T00:00:00.000Z",
    ),
  );

  assert.equal(
    hasActiveGuestShareCookie(
      futureCookie,
      Date.parse("2029-12-31T23:00:00.000Z"),
    ),
    true,
  );
  assert.equal(
    hasActiveGuestShareCookie(
      expiredCookie,
      Date.parse("2029-12-31T23:00:00.000Z"),
    ),
    false,
  );
});

test("lookupWorkspaceShareToken returns revoked for revoked rows", async () => {
  const result = await lookupWorkspaceShareToken({
    client: createLookupClient({
      id: "share-1",
      workspace_id: "workspace-1",
      field_id: "field-1",
      created_at: "2026-03-30T10:00:00.000Z",
      expires_at: "2030-01-01T00:00:00.000Z",
      revoked_at: "2026-03-30T11:00:00.000Z",
    }),
    token: "token-123",
    now: Date.parse("2026-03-30T10:30:00.000Z"),
  });

  assert.equal(result.status, "revoked");
  assert.equal(result.status === "revoked" ? result.share.revokedAt : null, "2026-03-30T11:00:00.000Z");
});

test("lookupWorkspaceShareToken keeps unknown tokens invalid", async () => {
  const result = await lookupWorkspaceShareToken({
    client: createLookupClient(null),
    token: "missing-token",
  });

  assert.deepEqual(result, {
    status: "invalid",
  });
});

test("getActiveWorkspaceShare returns the current active share metadata", async () => {
  const result = await getActiveWorkspaceShare({
    client: createActiveShareClient({
      id: "share-1",
      workspace_id: "workspace-1",
      field_id: "field-1",
      created_at: "2026-03-30T10:00:00.000Z",
      expires_at: "2030-01-01T00:00:00.000Z",
      revoked_at: null,
      last_accessed_at: "2026-03-30T10:30:00.000Z",
    }),
    workspaceId: "workspace-1",
    fieldId: "field-1",
    now: "2026-03-30T10:15:00.000Z",
  });

  assert.deepEqual(result, {
    id: "share-1",
    workspaceId: "workspace-1",
    fieldId: "field-1",
    createdAt: "2026-03-30T10:00:00.000Z",
    expiresAt: "2030-01-01T00:00:00.000Z",
    revokedAt: null,
    lastAccessedAt: "2026-03-30T10:30:00.000Z",
  });
});

test("revokeWorkspaceSharesForField excludes the current share when requested", async () => {
  const calls: Array<[string, unknown]> = [];
  const query = {
    update(payload: Record<string, unknown>) {
      calls.push(["update", payload]);
      return query;
    },
    eq(field: string, value: unknown) {
      calls.push([`eq:${field}`, value]);
      return query;
    },
    is(field: string, value: unknown) {
      calls.push([`is:${field}`, value]);
      return query;
    },
    gt(field: string, value: unknown) {
      calls.push([`gt:${field}`, value]);
      return query;
    },
    neq(field: string, value: unknown) {
      calls.push([`neq:${field}`, value]);
      return query;
    },
    then(resolve: (value: { error: null }) => unknown) {
      return Promise.resolve(resolve({ error: null }));
    },
  };
  const client = {
    from() {
      return query;
    },
  } as Parameters<typeof revokeWorkspaceSharesForField>[0]["client"];

  await revokeWorkspaceSharesForField({
    client,
    workspaceId: "workspace-1",
    fieldId: "field-1",
    excludedShareId: "share-2",
    revokedAt: "2026-03-30T11:00:00.000Z",
  });

  assert.deepEqual(calls, [
    ["update", { revoked_at: "2026-03-30T11:00:00.000Z" }],
    ["eq:workspace_id", "workspace-1"],
    ["eq:field_id", "field-1"],
    ["is:revoked_at", null],
    ["gt:expires_at", "2026-03-30T11:00:00.000Z"],
    ["neq:id", "share-2"],
  ]);
});

test("revokeWorkspaceShareById returns the revoked share metadata", async () => {
  const query = {
    update() {
      return query;
    },
    eq() {
      return query;
    },
    is() {
      return query;
    },
    gt() {
      return query;
    },
    select() {
      return query;
    },
    async maybeSingle() {
      return {
        data: {
          id: "share-1",
          workspace_id: "workspace-1",
          field_id: "field-1",
          created_at: "2026-03-30T10:00:00.000Z",
          expires_at: "2030-01-01T00:00:00.000Z",
          revoked_at: "2026-03-30T11:00:00.000Z",
          last_accessed_at: "2026-03-30T10:30:00.000Z",
        },
        error: null,
      };
    },
  };
  const client = {
    from() {
      return query;
    },
  } as Parameters<typeof revokeWorkspaceShareById>[0]["client"];

  const result = await revokeWorkspaceShareById({
    client,
    workspaceId: "workspace-1",
    shareId: "share-1",
    revokedAt: "2026-03-30T11:00:00.000Z",
  });

  assert.deepEqual(result, {
    id: "share-1",
    workspaceId: "workspace-1",
    fieldId: "field-1",
    createdAt: "2026-03-30T10:00:00.000Z",
    expiresAt: "2030-01-01T00:00:00.000Z",
    revokedAt: "2026-03-30T11:00:00.000Z",
    lastAccessedAt: "2026-03-30T10:30:00.000Z",
  });
});
