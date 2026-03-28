import {
  coerceNumber,
  requireSupabaseData,
  type DatabaseClient,
  type DatabaseSchema,
  type JsonValue,
} from "@fieldpulse/platform-db";
import type {
  FieldWeatherDerivedSignalSet,
  FieldWeatherDerivedSignalSetProvenance,
} from "../contracts/FieldWeatherDerivedSignalSet";
import type { UpsertFieldWeatherDerivedSignalSetInput } from "../contracts/UpsertFieldWeatherDerivedSignalSetInput";
import type { FieldWeatherDerivedSignalSetRepository } from "./FieldWeatherDerivedSignalSetRepository";

type FieldWeatherDerivedSignalSetRow =
  DatabaseSchema["app"]["Tables"]["field_weather_signal_sets"]["Row"];

function isRecord(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toProvenance(value: JsonValue): FieldWeatherDerivedSignalSetProvenance {
  if (!isRecord(value)) {
    return {};
  }

  return {
    calculationMode:
      typeof value.calculationMode === "string" ? value.calculationMode : undefined,
    forecastSampleCount24h:
      typeof value.forecastSampleCount24h === "number"
        ? value.forecastSampleCount24h
        : undefined,
    forecastSampleCount72h:
      typeof value.forecastSampleCount72h === "number"
        ? value.forecastSampleCount72h
        : undefined,
    windowHours24:
      typeof value.windowHours24 === "number" ? value.windowHours24 : undefined,
    windowHours72:
      typeof value.windowHours72 === "number" ? value.windowHours72 : undefined,
  };
}

function mapSignalSet(
  row: FieldWeatherDerivedSignalSetRow,
): FieldWeatherDerivedSignalSet {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    fieldId: row.field_id,
    weatherObservationId: row.weather_observation_id,
    observedAt: row.observed_at,
    forecastRunAt: row.forecast_run_at,
    sourceKey: row.source_key,
    providerKey: row.provider_key as FieldWeatherDerivedSignalSet["providerKey"],
    signalVersion: row.signal_version,
    currentVpdKpa:
      row.current_vpd_kpa == null ? null : coerceNumber(row.current_vpd_kpa),
    peakForecastVpdKpa24h:
      row.peak_forecast_vpd_kpa_24h == null
        ? null
        : coerceNumber(row.peak_forecast_vpd_kpa_24h),
    netWaterBalance24hMm:
      row.net_water_balance_24h_mm == null
        ? null
        : coerceNumber(row.net_water_balance_24h_mm),
    netWaterBalance72hMm:
      row.net_water_balance_72h_mm == null
        ? null
        : coerceNumber(row.net_water_balance_72h_mm),
    leafWetHours24h: row.leaf_wet_hours_24h,
    sprayWindowCount24h: row.spray_window_count_24h,
    frostRiskMinTempC:
      row.frost_risk_min_temp_c == null
        ? null
        : coerceNumber(row.frost_risk_min_temp_c),
    gdd24h: row.gdd_24h == null ? null : coerceNumber(row.gdd_24h),
    gdd72h: row.gdd_72h == null ? null : coerceNumber(row.gdd_72h),
    gddBaseC: coerceNumber(row.gdd_base_c),
    provenance: toProvenance(row.provenance),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseFieldWeatherDerivedSignalSetRepository(
  client: DatabaseClient,
): FieldWeatherDerivedSignalSetRepository {
  return {
    async getLatestByField(workspaceId, fieldId) {
      const result = await client
        .from("field_weather_signal_sets")
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

      return result.data ? mapSignalSet(result.data) : null;
    },

    async upsertSignalSet(input) {
      const result = await client
        .from("field_weather_signal_sets")
        .upsert(
          {
            workspace_id: input.workspaceId,
            field_id: input.fieldId,
            weather_observation_id: input.weatherObservationId ?? null,
            observed_at: input.observedAt,
            forecast_run_at: input.forecastRunAt ?? null,
            source_key: input.sourceKey,
            provider_key: input.providerKey,
            signal_version: input.signalVersion,
            current_vpd_kpa: input.currentVpdKpa ?? null,
            peak_forecast_vpd_kpa_24h: input.peakForecastVpdKpa24h ?? null,
            net_water_balance_24h_mm: input.netWaterBalance24hMm ?? null,
            net_water_balance_72h_mm: input.netWaterBalance72hMm ?? null,
            leaf_wet_hours_24h: input.leafWetHours24h ?? 0,
            spray_window_count_24h: input.sprayWindowCount24h ?? 0,
            frost_risk_min_temp_c: input.frostRiskMinTempC ?? null,
            gdd_24h: input.gdd24h ?? null,
            gdd_72h: input.gdd72h ?? null,
            gdd_base_c: input.gddBaseC ?? 5,
            provenance: input.provenance ?? {},
          },
          {
            onConflict: "field_id,observed_at,source_key,signal_version",
          },
        )
        .select("*")
        .single();

      return mapSignalSet(
        requireSupabaseData(result, "weather.upsertSignalSet"),
      );
    },
  };
}
