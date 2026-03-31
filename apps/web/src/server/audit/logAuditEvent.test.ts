import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { logAuditEvent } from "./logAuditEvent";

test("logAuditEvent emits structured console audit logs even without persistence", async () => {
  const calls: unknown[][] = [];
  const originalLog = console.log;

  console.log = (...args: unknown[]) => {
    calls.push(args);
  };

  try {
    await logAuditEvent({
      action: "field.created",
      actorUserId: "11111111-1111-4111-8111-111111111111",
      workspaceId: "22222222-2222-4222-8222-222222222222",
      resourceType: "field",
      resourceId: "33333333-3333-4333-8333-333333333333",
      route: "/api/fields",
      metadata: {
        nested: {
          ok: true,
          when: new Date("2026-03-31T10:00:00.000Z"),
        },
        ignored: new Map(),
      },
    });
  } finally {
    console.log = originalLog;
  }

  assert.equal(calls.length, 1);

  const [serialized] = calls[0];
  assert.equal(typeof serialized, "string");

  const parsed = JSON.parse(serialized as string) as {
    level: string;
    scope: string;
    event: string;
    payload: {
      actorUserId: string;
      workspaceId: string | null;
      resourceType: string;
      resourceId: string | null;
      route: string;
      metadata?: Record<string, unknown>;
    };
  };

  assert.equal(parsed.level, "info");
  assert.equal(parsed.scope, "audit");
  assert.equal(parsed.event, "field.created");
  assert.equal(parsed.payload.actorUserId, "11111111-1111-4111-8111-111111111111");
  assert.equal(parsed.payload.workspaceId, "22222222-2222-4222-8222-222222222222");
  assert.deepEqual(parsed.payload.metadata, {
    nested: {
      ok: true,
      when: "2026-03-31T10:00:00.000Z",
    },
  });
});

test("logAuditEvent persists normalized metadata when a client is provided", async () => {
  let insertedTable: string | null = null;
  let insertedRow: Record<string, unknown> | null = null;

  const client = {
    from(table: string) {
      insertedTable = table;

      return {
        async insert(row: Record<string, unknown>) {
          insertedRow = row;
          return { error: null };
        },
      };
    },
  };

  await logAuditEvent({
    client,
    action: "workspace.settings_updated",
    actorUserId: "11111111-1111-4111-8111-111111111111",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    resourceType: "workspace-settings",
    resourceId: "settings-1",
    route: "/api/settings",
    metadata: {
      emailAlerts: true,
      tags: ["weekly", "digest"],
      ignored: new Set(["skip"]),
    },
  });

  assert.equal(insertedTable, "audit_events");
  assert.ok(insertedRow);
  assert.equal(insertedRow.action, "workspace.settings_updated");
  assert.equal(insertedRow.actor_user_id, "11111111-1111-4111-8111-111111111111");
  assert.equal(insertedRow.workspace_id, "22222222-2222-4222-8222-222222222222");
  assert.equal(insertedRow.resource_type, "workspace-settings");
  assert.equal(insertedRow.resource_id, "settings-1");
  assert.equal(insertedRow.route, "/api/settings");
  assert.deepEqual(insertedRow.metadata, {
    emailAlerts: true,
    tags: ["weekly", "digest"],
  });
  assert.equal(typeof insertedRow.created_at, "string");
});

test("logAuditEvent does not throw when persistence fails and records the failure", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "fieldpulse-audit-log-"));
  const logFile = join(tempDir, "server.log");
  const previousLogFile = process.env.FIELDPULSE_SERVER_LOG_FILE;

  process.env.FIELDPULSE_SERVER_LOG_FILE = logFile;

  try {
    await logAuditEvent({
      client: {
        from() {
          return {
            async insert() {
              return {
                error: new Error("audit insert failed"),
              };
            },
          };
        },
      },
      action: "field.deleted",
      actorUserId: "11111111-1111-4111-8111-111111111111",
      workspaceId: "22222222-2222-4222-8222-222222222222",
      resourceType: "field",
      resourceId: "33333333-3333-4333-8333-333333333333",
      route: "/api/fields/[fieldId]",
    });

    assert.equal(existsSync(logFile), true);
    const logContents = readFileSync(logFile, "utf8");
    assert.match(logContents, /audit-event-persist/);
    assert.match(logContents, /field\.deleted/);
  } finally {
    if (previousLogFile === undefined) {
      delete process.env.FIELDPULSE_SERVER_LOG_FILE;
    } else {
      process.env.FIELDPULSE_SERVER_LOG_FILE = previousLogFile;
    }

    rmSync(tempDir, { recursive: true, force: true });
  }
});
