import { requireSupabaseData, type DatabaseClient, type DatabaseSchema } from "@fieldpulse/platform-db";
import type { AcknowledgeFieldAlertInput } from "../contracts/AcknowledgeFieldAlertInput";
import type { AlertSummary } from "../contracts/AlertSummary";
import type {
  AlertFamily,
  AlertSeverity,
  AlertStatus,
  FieldAlert,
} from "../contracts/FieldAlert";
import type { ResolveFieldAlertInput } from "../contracts/ResolveFieldAlertInput";
import type { UpsertFieldAlertInput } from "../contracts/UpsertFieldAlertInput";
import type { AlertRepository } from "./AlertRepository";

type FieldAlertRow = DatabaseSchema["app"]["Tables"]["field_alerts"]["Row"];

function mapFieldAlert(row: FieldAlertRow): FieldAlert {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    fieldId: row.field_id,
    family: row.family as AlertFamily,
    severity: row.severity as AlertSeverity,
    status: row.status as AlertStatus,
    sourceKey: row.source_key,
    dedupeKey: row.dedupe_key,
    title: row.title,
    summary: row.summary,
    explanation: row.explanation,
    recommendedAction: row.recommended_action,
    facts: row.facts,
    evidence: row.evidence,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    acknowledgedAt: row.acknowledged_at,
    acknowledgedByUserId: row.acknowledged_by_user_id,
    resolvedAt: row.resolved_at,
    resolutionNote: row.resolution_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toAlertSummary(row: FieldAlertRow): AlertSummary {
  return {
    id: row.id,
    fieldId: row.field_id,
    family: row.family as AlertFamily,
    title: row.title,
    severity: row.severity as AlertSeverity,
    status: row.status as AlertStatus,
    sourceKey: row.source_key,
    dedupeKey: row.dedupe_key,
    startedAt: row.started_at,
    resolvedAt: row.resolved_at,
  };
}

export function createSupabaseAlertRepository(
  client: DatabaseClient,
): AlertRepository {
  return {
    async listActive(workspaceId, limit = 50) {
      const result = await client
        .from("field_alerts")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .order("severity", { ascending: false })
        .order("started_at", { ascending: false })
        .limit(limit);

      return requireSupabaseData(result, "alerts.listActive").map(toAlertSummary);
    },

    async listByField(workspaceId, fieldId, limit = 50, status) {
      let query = client
        .from("field_alerts")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("field_id", fieldId)
        .order("started_at", { ascending: false })
        .order("updated_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const result = await query.limit(limit);

      return requireSupabaseData(result, "alerts.listByField").map(mapFieldAlert);
    },

    async upsertAlert(input) {
      const result = await client
        .from("field_alerts")
        .upsert(
          {
            workspace_id: input.workspaceId,
            field_id: input.fieldId,
            family: input.family,
            severity: input.severity,
            status: input.status ?? "active",
            source_key: input.sourceKey,
            dedupe_key: input.dedupeKey,
            title: input.title,
            summary: input.summary ?? null,
            explanation: input.explanation ?? null,
            recommended_action: input.recommendedAction ?? null,
            facts: input.facts ?? {},
            evidence: input.evidence ?? {},
            started_at: input.startedAt,
            ended_at: input.endedAt ?? null,
            acknowledged_at: input.acknowledgedAt ?? null,
            acknowledged_by_user_id: input.acknowledgedByUserId ?? null,
            resolved_at: input.resolvedAt ?? null,
            resolution_note: input.resolutionNote ?? null,
          },
          {
            onConflict: "field_id,dedupe_key",
          },
        )
        .select("*")
        .single();

      return mapFieldAlert(requireSupabaseData(result, "alerts.upsertAlert"));
    },

    async acknowledgeAlert(input) {
      const result = await client
        .from("field_alerts")
        .update({
          acknowledged_at: input.acknowledgedAt ?? new Date().toISOString(),
          acknowledged_by_user_id: input.acknowledgedByUserId,
        })
        .eq("workspace_id", input.workspaceId)
        .eq("id", input.alertId)
        .select("*")
        .maybeSingle();

      if (result.error) {
        throw result.error;
      }

      return result.data ? mapFieldAlert(result.data) : null;
    },

    async resolveAlert(input) {
      const result = await client
        .from("field_alerts")
        .update({
          status: input.status ?? "resolved",
          resolved_at: input.resolvedAt ?? new Date().toISOString(),
          resolution_note: input.resolutionNote ?? null,
        })
        .eq("workspace_id", input.workspaceId)
        .eq("id", input.alertId)
        .select("*")
        .maybeSingle();

      if (result.error) {
        throw result.error;
      }

      return result.data ? mapFieldAlert(result.data) : null;
    },
  };
}
