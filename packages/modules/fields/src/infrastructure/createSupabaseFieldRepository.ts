import {
  coerceNumber,
  requireSupabaseData,
  requireSupabaseSuccess,
  type DatabaseClient,
  type DatabaseSchema,
  type JsonValue,
  type UserId,
  type WorkspaceId,
} from "@fieldpulse/platform-db";
import type { CreateFieldInput } from "../contracts/CreateFieldInput";
import type { FieldBoundary, GeoPoint } from "../contracts/FieldBoundary";
import type { FieldDetail } from "../contracts/FieldDetail";
import type { FieldOverview } from "../contracts/FieldOverview";
import type { FieldSummary } from "../contracts/FieldSummary";
import type { FieldOverviewRepository } from "./FieldOverviewRepository";
import type { FieldRepository } from "./FieldRepository";
import type { FieldSummaryRepository } from "./FieldSummaryRepository";

type FieldOverviewRow = DatabaseSchema["app"]["Views"]["field_overview"]["Row"];
type FieldDetailRow =
  DatabaseSchema["app"]["Functions"]["get_field_detail"]["Returns"][number];
type SelectedFieldOverviewRow = Pick<
  FieldOverviewRow,
  | "workspace_id"
  | "id"
  | "name"
  | "area_ha"
  | "legal_land_description"
  | "latest_moisture_observed_at"
  | "latest_root_zone_pct"
  | "latest_surface_pct"
  | "latest_moisture_confidence"
  | "latest_moisture_source_key"
>;

const FIELD_OVERVIEW_SELECT =
  "workspace_id,id,name,area_ha,legal_land_description,latest_moisture_observed_at,latest_root_zone_pct,latest_surface_pct,latest_moisture_confidence,latest_moisture_source_key";

function isFieldRepoPerfDebugEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.FIELDPULSE_DEBUG_PERF === "1";
}

function startPerfTimer(enabled: boolean) {
  return enabled ? performance.now() : 0;
}

function finishPerfTimer(startedAt: number, enabled: boolean) {
  if (!enabled) {
    return 0;
  }

  return Math.round((performance.now() - startedAt) * 100) / 100;
}

function isRecord(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toGeoPoint(value: JsonValue, context: string): GeoPoint {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    typeof value[0] !== "number" ||
    typeof value[1] !== "number"
  ) {
    throw new Error(`[fields] ${context}: invalid point coordinates`);
  }

  return [value[0], value[1]];
}

function toFieldBoundary(value: JsonValue): FieldBoundary {
  if (!isRecord(value) || value.type !== "MultiPolygon" || !Array.isArray(value.coordinates)) {
    throw new Error("[fields] invalid field boundary geojson");
  }

  // Validate coordinate nesting depth and filter degenerate rings.
  // ST_AsGeoJSON can produce empty inner rings or sub-4-point rings
  // that crash Deck.gl downstream.
  const coordinates = (value.coordinates as unknown[][][]).map(
    (polygon: unknown[][]) =>
      (polygon ?? []).filter((ring: unknown[]) => Array.isArray(ring) && ring.length >= 4),
  ).filter((polygon) => polygon.length > 0);

  if (coordinates.length === 0) {
    throw new Error("[fields] field boundary has no valid polygon rings");
  }

  return { type: "MultiPolygon", coordinates } as unknown as FieldBoundary;
}

function toLabelPoint(value: JsonValue): GeoPoint {
  if (!isRecord(value) || value.type !== "Point" || !("coordinates" in value)) {
    throw new Error("[fields] invalid label point geojson");
  }

  return toGeoPoint(value.coordinates, "labelPoint");
}

function mapFieldSummary(row: SelectedFieldOverviewRow): FieldSummary {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    areaHa: coerceNumber(row.area_ha),
    legalLandDescription: row.legal_land_description ?? null,
  };
}

function mapFieldOverview(row: SelectedFieldOverviewRow): FieldOverview {
  return {
    ...mapFieldSummary(row),
    latestMoisture:
      row.latest_moisture_observed_at &&
      row.latest_root_zone_pct != null &&
      row.latest_surface_pct != null &&
      row.latest_moisture_confidence &&
      row.latest_moisture_source_key
        ? {
            observedAt: row.latest_moisture_observed_at,
            rootZonePct: coerceNumber(row.latest_root_zone_pct),
            surfacePct: coerceNumber(row.latest_surface_pct),
            confidence: row.latest_moisture_confidence,
            sourceKey: row.latest_moisture_source_key,
          }
        : null,
  };
}

function mapFieldDetail(row: FieldDetailRow): FieldDetail {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    areaHa: coerceNumber(row.area_ha),
    legalLandDescription: row.legal_land_description ?? null,
    boundary: toFieldBoundary(row.boundary_geojson),
    labelPoint: toLabelPoint(row.label_point_geojson),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseFieldRepository(
  client: DatabaseClient,
): FieldRepository & FieldSummaryRepository & FieldOverviewRepository {
  return {
    async create(input: CreateFieldInput, actorUserId: UserId) {
      const result = await client
        .rpc("create_field_record", {
          target_workspace_id: input.workspaceId,
          field_name: input.name,
          field_area_ha: input.areaHa,
          field_boundary_geojson: input.boundary,
          actor_user_id: actorUserId,
        })
        .single();

      const detail = mapFieldDetail(
        requireSupabaseData(result, "fields.create"),
      );

      const legalLandDescription = input.legalLandDescription?.trim() ?? "";

      if (!legalLandDescription || detail.legalLandDescription === legalLandDescription) {
        return detail;
      }

      const updateResult = await client
        .from("fields")
        .update({
          legal_land_description: legalLandDescription,
        })
        .eq("workspace_id", input.workspaceId)
        .eq("id", detail.id)
        .select("updated_at")
        .single();
      const updatedField = requireSupabaseData(updateResult, "fields.create.legalLandDescription");

      return {
        ...detail,
        legalLandDescription,
        updatedAt:
          typeof updatedField.updated_at === "string"
            ? updatedField.updated_at
            : detail.updatedAt,
      };
    },

    async getById(workspaceId, fieldId) {
      const debugPerfEnabled = isFieldRepoPerfDebugEnabled();
      const startedAt = startPerfTimer(debugPerfEnabled);
      const result = await client
        .rpc("get_field_detail", {
          target_workspace_id: workspaceId,
          target_field_id: fieldId,
        })
        .maybeSingle();

      if (result.error) {
        throw result.error;
      }

      if (debugPerfEnabled) {
        console.debug("[stability][fields] getById", {
          workspaceId,
          fieldId,
          durationMs: finishPerfTimer(startedAt, debugPerfEnabled),
          found: result.data != null,
        });
      }

      return result.data ? mapFieldDetail(result.data) : null;
    },

    async renameField(workspaceId, fieldId, name) {
      const result = await client
        .from("fields")
        .update({
          name,
        })
        .eq("workspace_id", workspaceId)
        .eq("id", fieldId)
        .select("id")
        .single();

      requireSupabaseData(result, "fields.renameField.update");

      const detail = await this.getById(workspaceId, fieldId);

      if (!detail) {
        throw new Error(
          `[fields] updated field ${fieldId} could not be reloaded after rename`,
        );
      }

      return detail;
    },

    async setLegalLandDescription(workspaceId, fieldId, legalLandDescription) {
      const result = await client
        .from("fields")
        .update({
          legal_land_description: legalLandDescription,
        })
        .eq("workspace_id", workspaceId)
        .eq("id", fieldId)
        .select("id")
        .single();

      requireSupabaseData(result, "fields.setLegalLandDescription.update");

      const detail = await this.getById(workspaceId, fieldId);

      if (!detail) {
        throw new Error(
          `[fields] updated field ${fieldId} could not be reloaded after legal land description update`,
        );
      }

      return detail;
    },

    async deleteField(workspaceId, fieldId) {
      const result = await client
        .from("fields")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("id", fieldId);

      requireSupabaseSuccess(result, "fields.deleteField");
    },

    async listByWorkspace(workspaceId: WorkspaceId) {
      const debugPerfEnabled = isFieldRepoPerfDebugEnabled();
      const startedAt = startPerfTimer(debugPerfEnabled);
      const result = await client
        .from("field_overview")
        .select(FIELD_OVERVIEW_SELECT)
        .eq("workspace_id", workspaceId)
        .order("name", { ascending: true });

      if (debugPerfEnabled) {
        console.debug("[stability][fields] listByWorkspace", {
          workspaceId,
          durationMs: finishPerfTimer(startedAt, debugPerfEnabled),
          rowCount: result.data?.length ?? 0,
        });
      }

      return requireSupabaseData(
        result,
        "fields.listByWorkspace",
      ).map(mapFieldSummary);
    },

    async listOverviewByWorkspace(workspaceId: WorkspaceId) {
      const debugPerfEnabled = isFieldRepoPerfDebugEnabled();
      const startedAt = startPerfTimer(debugPerfEnabled);
      const result = await client
        .from("field_overview")
        .select(FIELD_OVERVIEW_SELECT)
        .eq("workspace_id", workspaceId)
        .order("name", { ascending: true });

      if (debugPerfEnabled) {
        console.debug("[stability][fields] listOverviewByWorkspace", {
          workspaceId,
          durationMs: finishPerfTimer(startedAt, debugPerfEnabled),
          rowCount: result.data?.length ?? 0,
        });
      }

      return requireSupabaseData(
        result,
        "fields.listOverviewByWorkspace",
      ).map(mapFieldOverview);
    },
  };
}
