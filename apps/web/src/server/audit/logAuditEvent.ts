import type { JsonValue } from "@fieldpulse/platform-db";
import type { ServerRuntime } from "@fieldpulse/platform-runtime";
import { logServerError } from "../runtime/installServerCrashLogging";
import { createServerDatabaseClient } from "../runtime/createServerDatabaseClient";

type AuditValue =
  | string
  | number
  | boolean
  | null
  | AuditValue[]
  | { [key: string]: AuditValue };

type AuditMetadata = Record<string, AuditValue>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeAuditValue(value: unknown): AuditValue | undefined {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeAuditValue(entry))
      .filter((entry): entry is AuditValue => entry !== undefined);
  }

  if (!isPlainObject(value)) {
    return undefined;
  }

  const normalized: Record<string, AuditValue> = {};

  for (const [key, entry] of Object.entries(value)) {
    const nextValue = normalizeAuditValue(entry);

    if (nextValue !== undefined) {
      normalized[key] = nextValue;
    }
  }

  return normalized;
}

export async function logAuditEvent(input: {
  runtime?: ServerRuntime;
  action: string;
  actorUserId: string;
  workspaceId?: string | null;
  resourceType: string;
  resourceId?: string | null;
  route: string;
  metadata?: Record<string, unknown>;
}) {
  const metadata = normalizeAuditValue(input.metadata);
  const createdAt = new Date().toISOString();

  const payload: {
    actorUserId: string;
    workspaceId: string | null;
    resourceType: string;
    resourceId: string | null;
    route: string;
    metadata?: AuditMetadata;
  } = {
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId ?? null,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    route: input.route,
  };

  if (metadata && !Array.isArray(metadata) && typeof metadata === "object") {
    payload.metadata = metadata;
  }

  console.log(
    JSON.stringify({
      level: "info",
      scope: "audit",
      event: input.action,
      payload,
      at: createdAt,
    }),
  );

  if (!input.runtime || input.runtime.mode !== "supabase") {
    return;
  }

  try {
    const client = createServerDatabaseClient(input.runtime);
    const { error } = await client.from("audit_events").insert({
      action: input.action,
      actor_user_id: input.actorUserId,
      workspace_id: input.workspaceId ?? null,
      resource_type: input.resourceType,
      resource_id: input.resourceId ?? null,
      route: input.route,
      metadata: (payload.metadata ?? {}) as JsonValue,
      created_at: createdAt,
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    logServerError("audit-event-persist", error, {
      action: input.action,
      route: input.route,
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId ?? null,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
    });
  }
}
