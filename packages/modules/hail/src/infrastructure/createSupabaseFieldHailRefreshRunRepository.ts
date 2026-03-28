import {
  coerceNumber,
  requireSupabaseData,
  type DatabaseClient,
  type DatabaseSchema,
} from "@fieldpulse/platform-db";
import type { FieldHailRefreshRun } from "../contracts/FieldHailRefreshRun";
import type { HailProvider } from "../contracts/HailProvider";
import type { HailRefreshRunStatus } from "../contracts/FieldHailRefreshRun";
import type { UpsertFieldHailRefreshRunInput } from "../contracts/UpsertFieldHailRefreshRunInput";
import type { FieldHailRefreshRunRepository } from "./FieldHailRefreshRunRepository";

type FieldHailRefreshRunRow =
  DatabaseSchema["app"]["Tables"]["field_hail_refresh_runs"]["Row"];

function mapFieldHailRefreshRun(
  row: FieldHailRefreshRunRow,
): FieldHailRefreshRun {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    fieldId: row.field_id,
    providerKey: row.provider_key as HailProvider,
    sourceKey: row.source_key,
    requestedAt: row.requested_at,
    completedAt: row.completed_at,
    status: row.status as HailRefreshRunStatus,
    matchedEventCount: coerceNumber(row.matched_event_count),
    latestMatchedReportedAt: row.latest_matched_reported_at,
    errorMessage: row.error_message,
    provenance: row.provenance,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseFieldHailRefreshRunRepository(
  client: DatabaseClient,
): FieldHailRefreshRunRepository {
  return {
    async upsertRun(input) {
      const result = await client
        .from("field_hail_refresh_runs")
        .upsert(
          {
            workspace_id: input.workspaceId,
            field_id: input.fieldId,
            provider_key: input.providerKey,
            source_key: input.sourceKey,
            requested_at: input.requestedAt,
            completed_at: input.completedAt ?? null,
            status: input.status,
            matched_event_count: input.matchedEventCount,
            latest_matched_reported_at: input.latestMatchedReportedAt ?? null,
            error_message: input.errorMessage ?? null,
            provenance: input.provenance ?? {},
          },
          {
            onConflict: "field_id,source_key,requested_at",
          },
        )
        .select("*")
        .single();

      return mapFieldHailRefreshRun(
        requireSupabaseData(result, "hail.upsertRefreshRun"),
      );
    },

    async listLatestByWorkspace(workspaceId) {
      const result = await client
        .from("field_hail_refresh_runs")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("field_id", { ascending: true })
        .order("requested_at", { ascending: false })
        .order("updated_at", { ascending: false });

      const rows = requireSupabaseData(result, "hail.listLatestRefreshRunsByWorkspace");
      const latestByField = new Map<string, FieldHailRefreshRunRow>();

      for (const row of rows) {
        if (!latestByField.has(row.field_id)) {
          latestByField.set(row.field_id, row);
        }
      }

      return Array.from(latestByField.values()).map(mapFieldHailRefreshRun);
    },

    async listRecentRuns(input) {
      let query = client
        .from("field_hail_refresh_runs")
        .select("*")
        .order("requested_at", { ascending: false })
        .order("updated_at", { ascending: false });

      if (input.workspaceId) {
        query = query.eq("workspace_id", input.workspaceId);
      }

      if (input.requestedAfter) {
        query = query.gte("requested_at", input.requestedAfter);
      }

      const result = await query.limit(input.limit ?? 200);

      return requireSupabaseData(
        result,
        "hail.listRecentRefreshRuns",
      ).map(mapFieldHailRefreshRun);
    },
  };
}
