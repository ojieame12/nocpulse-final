import {
  coerceNumber,
  requireSupabaseData,
  type DatabaseClient,
  type DatabaseSchema,
  type JsonValue,
} from "@fieldpulse/platform-db";
import type {
  FieldWeatherObservation,
  FieldWeatherObservationProvenance,
} from "../contracts/FieldWeatherObservation";
import type { UpsertFieldWeatherObservationInput } from "../contracts/UpsertFieldWeatherObservationInput";
import type { FieldWeatherObservationRepository } from "./FieldWeatherObservationRepository";

type FieldWeatherObservationRow =
  DatabaseSchema["app"]["Tables"]["field_weather_observations"]["Row"];

function isRecord(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toProvenance(value: JsonValue): FieldWeatherObservationProvenance {
  if (!isRecord(value)) {
    return {};
  }

  return {
    forecastModel:
      typeof value.forecastModel === "string" ? value.forecastModel : undefined,
    radarDataset:
      typeof value.radarDataset === "string" ? value.radarDataset : undefined,
    soilDataset:
      typeof value.soilDataset === "string" ? value.soilDataset : undefined,
    stationId:
      typeof value.stationId === "string" ? value.stationId : undefined,
  };
}

function mapFieldWeatherObservation(
  row: FieldWeatherObservationRow,
): FieldWeatherObservation {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    fieldId: row.field_id,
    observedAt: row.observed_at,
    sourceKey: row.source_key,
    providerKey: row.provider_key,
    airTemperatureC: coerceNumber(row.air_temperature_c),
    precipitationMm: coerceNumber(row.precipitation_mm),
    windSpeedKph: coerceNumber(row.wind_speed_kph),
    relativeHumidityPct:
      row.relative_humidity_pct == null
        ? null
        : coerceNumber(row.relative_humidity_pct),
    soilMoisturePct:
      row.soil_moisture_pct == null ? null : coerceNumber(row.soil_moisture_pct),
    evapotranspirationMm:
      row.evapotranspiration_mm == null
        ? null
        : coerceNumber(row.evapotranspiration_mm),
    provenance: toProvenance(row.provenance),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseFieldWeatherObservationRepository(
  client: DatabaseClient,
): FieldWeatherObservationRepository {
  return {
    async getLatestByField(workspaceId, fieldId) {
      const result = await client
        .from("field_weather_observations")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("field_id", fieldId)
        .order("observed_at", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (result.error) {
        throw result.error;
      }

      return result.data ? mapFieldWeatherObservation(result.data) : null;
    },

    async upsertObservation(input) {
      const result = await client
        .from("field_weather_observations")
        .upsert(
          {
            workspace_id: input.workspaceId,
            field_id: input.fieldId,
            observed_at: input.observedAt,
            source_key: input.sourceKey,
            provider_key: input.providerKey,
            air_temperature_c: input.airTemperatureC,
            precipitation_mm: input.precipitationMm,
            wind_speed_kph: input.windSpeedKph,
            relative_humidity_pct: input.relativeHumidityPct ?? null,
            soil_moisture_pct: input.soilMoisturePct ?? null,
            evapotranspiration_mm: input.evapotranspirationMm ?? null,
            provenance: input.provenance ?? {},
          },
          {
            onConflict: "field_id,observed_at,source_key",
          },
        )
        .select("*")
        .single();

      return mapFieldWeatherObservation(
        requireSupabaseData(result, "weather.upsertObservation"),
      );
    },

    async listLatestByWorkspace(workspaceId) {
      const result = await client
        .from("field_weather_observations")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("field_id", { ascending: true })
        .order("observed_at", { ascending: false })
        .order("updated_at", { ascending: false });

      const rows = requireSupabaseData(
        result,
        "weather.listLatestByWorkspace",
      );
      const latestByField = new Map<string, FieldWeatherObservationRow>();

      for (const row of rows) {
        if (!latestByField.has(row.field_id)) {
          latestByField.set(row.field_id, row);
        }
      }

      return Array.from(latestByField.values()).map(mapFieldWeatherObservation);
    },

    async listRecentObservations(input) {
      let query = client
        .from("field_weather_observations")
        .select("*")
        .order("updated_at", { ascending: false })
        .order("observed_at", { ascending: false });

      if (input.workspaceId) {
        query = query.eq("workspace_id", input.workspaceId);
      }

      if (input.updatedAfter) {
        query = query.gte("updated_at", input.updatedAfter);
      }

      const result = await query.limit(input.limit ?? 200);

      return requireSupabaseData(
        result,
        "weather.listRecentObservations",
      ).map(mapFieldWeatherObservation);
    },
  };
}
