import type {
  Audited,
  EntityId,
  JsonValue,
  TimestampIso,
  WorkspaceScoped,
} from "@fieldpulse/platform-db";

export type AlertSeverity = "low" | "medium" | "high" | "critical";

export type AlertStatus = "active" | "resolved" | "dismissed";

export type AlertFamily =
  | "hail_risk"
  | "weather_risk"
  | "moisture_stress"
  | "crop_health"
  | "disease_risk"
  | "action_brief"
  | "imagery_gap"
  | "system";

export type FieldAlert = WorkspaceScoped &
  Audited & {
    id: EntityId;
    fieldId: EntityId;
    family: AlertFamily;
    severity: AlertSeverity;
    status: AlertStatus;
    sourceKey: string;
    dedupeKey: string;
    title: string;
    summary: string | null;
    explanation: string | null;
    recommendedAction: string | null;
    facts: JsonValue;
    evidence: JsonValue;
    startedAt: TimestampIso;
    endedAt: TimestampIso | null;
    acknowledgedAt: TimestampIso | null;
    acknowledgedByUserId: string | null;
    resolvedAt: TimestampIso | null;
    resolutionNote: string | null;
  };
