import {
  coerceNumber,
  requireSupabaseData,
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

  return value as unknown as FieldBoundary;
}

function toLabelPoint(value: JsonValue): GeoPoint {
  if (!isRecord(value) || value.type !== "Point" || !("coordinates" in value)) {
    throw new Error("[fields] invalid label point geojson");
  }

  return toGeoPoint(value.coordinates, "labelPoint");
}

function mapFieldSummary(row: FieldOverviewRow): FieldSummary {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    areaHa: coerceNumber(row.area_ha),
    legalLandDescription: row.legal_land_description ?? null,
  };
}

function mapFieldOverview(row: FieldOverviewRow): FieldOverview {
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

      return mapFieldDetail(
        requireSupabaseData(result, "fields.create"),
      );
    },

    async getById(workspaceId, fieldId) {
      const result = await client
        .rpc("get_field_detail", {
          target_workspace_id: workspaceId,
          target_field_id: fieldId,
        })
        .maybeSingle();

      if (result.error) {
        throw result.error;
      }

      return result.data ? mapFieldDetail(result.data) : null;
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

    async listByWorkspace(workspaceId: WorkspaceId) {
      const result = await client
        .from("field_overview")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("name", { ascending: true });

      return requireSupabaseData(
        result,
        "fields.listByWorkspace",
      ).map(mapFieldSummary);
    },

    async listOverviewByWorkspace(workspaceId: WorkspaceId) {
      const result = await client
        .from("field_overview")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("name", { ascending: true });

      return requireSupabaseData(
        result,
        "fields.listOverviewByWorkspace",
      ).map(mapFieldOverview);
    },
  };
}
