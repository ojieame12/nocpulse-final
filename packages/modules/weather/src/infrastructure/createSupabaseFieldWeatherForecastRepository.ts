import {
  coerceNumber,
  requireSupabaseData,
  requireSupabaseSuccess,
  type DatabaseClient,
  type DatabaseSchema,
} from "@fieldpulse/platform-db";
import type { FieldWeatherForecast } from "../contracts/FieldWeatherForecast";
import type { ReplaceFieldWeatherForecastSetInput } from "../contracts/ReplaceFieldWeatherForecastSetInput";
import type { FieldWeatherForecastRepository } from "./FieldWeatherForecastRepository";

type FieldWeatherForecastRow =
  DatabaseSchema["app"]["Tables"]["field_weather_forecasts"]["Row"];

function mapFieldWeatherForecast(
  row: FieldWeatherForecastRow,
): FieldWeatherForecast {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    fieldId: row.field_id,
    forecastRunAt: row.forecast_run_at,
    validAt: row.valid_at,
    sourceKey: row.source_key,
    providerKey: row.provider_key,
    airTemperatureMinC: coerceNumber(row.air_temperature_min_c),
    airTemperatureMaxC: coerceNumber(row.air_temperature_max_c),
    precipitationMm: coerceNumber(row.precipitation_mm),
    windSpeedKph: coerceNumber(row.wind_speed_kph),
    relativeHumidityPct:
      row.relative_humidity_pct == null
        ? null
        : coerceNumber(row.relative_humidity_pct),
    evapotranspirationMm:
      row.evapotranspiration_mm == null
        ? null
        : coerceNumber(row.evapotranspiration_mm),
    precipitationProbabilityPct:
      row.precipitation_probability_pct == null
        ? null
        : coerceNumber(row.precipitation_probability_pct),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseFieldWeatherForecastRepository(
  client: DatabaseClient,
): FieldWeatherForecastRepository {
  return {
    async listByField(input) {
      let query = client
        .from("field_weather_forecasts")
        .select("*")
        .eq("workspace_id", input.workspaceId)
        .eq("field_id", input.fieldId)
        .order("valid_at", { ascending: true })
        .order("updated_at", { ascending: false });

      if (input.validAfter) {
        query = query.gte("valid_at", input.validAfter);
      }

      const result = await query.limit(input.limit ?? 24);

      return requireSupabaseData(
        result,
        "weather.listForecastsByField",
      ).map(mapFieldWeatherForecast);
    },

    async replaceForecastSet(input) {
      const deleteResult = await client
        .from("field_weather_forecasts")
        .delete()
        .eq("workspace_id", input.workspaceId)
        .eq("field_id", input.fieldId)
        .eq("forecast_run_at", input.forecastRunAt)
        .eq("source_key", input.sourceKey);

      requireSupabaseSuccess(deleteResult, "weather.replaceForecastSet.delete");

      if (input.entries.length === 0) {
        return [];
      }

      const result = await client
        .from("field_weather_forecasts")
        .insert(
          input.entries.map((entry) => ({
            workspace_id: input.workspaceId,
            field_id: input.fieldId,
            forecast_run_at: input.forecastRunAt,
            valid_at: entry.validAt,
            source_key: input.sourceKey,
            provider_key: input.providerKey,
            air_temperature_min_c: entry.airTemperatureMinC,
            air_temperature_max_c: entry.airTemperatureMaxC,
            precipitation_mm: entry.precipitationMm,
            wind_speed_kph: entry.windSpeedKph,
            relative_humidity_pct: entry.relativeHumidityPct ?? null,
            evapotranspiration_mm: entry.evapotranspirationMm ?? null,
            precipitation_probability_pct:
              entry.precipitationProbabilityPct ?? null,
          })),
        )
        .select("*")
        .order("valid_at", { ascending: true });

      return requireSupabaseData(
        result,
        "weather.replaceForecastSet.insert",
      ).map(mapFieldWeatherForecast);
    },
  };
}
