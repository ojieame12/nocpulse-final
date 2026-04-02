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
    forecastSampleCount168h:
      typeof value.forecastSampleCount168h === "number"
        ? value.forecastSampleCount168h
        : undefined,
    observationSampleCount72h:
      typeof value.observationSampleCount72h === "number"
        ? value.observationSampleCount72h
        : undefined,
    observationSampleCount168h:
      typeof value.observationSampleCount168h === "number"
        ? value.observationSampleCount168h
        : undefined,
    soilTempThresholdC:
      typeof value.soilTempThresholdC === "number"
        ? value.soilTempThresholdC
        : undefined,
    windowHours24:
      typeof value.windowHours24 === "number" ? value.windowHours24 : undefined,
    windowHours72:
      typeof value.windowHours72 === "number" ? value.windowHours72 : undefined,
    windowHours168:
      typeof value.windowHours168 === "number" ? value.windowHours168 : undefined,
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
    frostRiskMinTempC7d:
      row.frost_risk_min_temp_c_7d == null
        ? null
        : coerceNumber(row.frost_risk_min_temp_c_7d),
    frostRiskNights7d:
      row.frost_risk_nights_7d == null
        ? null
        : coerceNumber(row.frost_risk_nights_7d),
    recentPrecipTotal72hMm:
      row.recent_precip_total_72h_mm == null
        ? null
        : coerceNumber(row.recent_precip_total_72h_mm),
    freezeThawCycles7d:
      row.freeze_thaw_cycles_7d == null
        ? null
        : coerceNumber(row.freeze_thaw_cycles_7d),
    soilTemp6cmCurrentC:
      row.soil_temp_6cm_current_c == null
        ? null
        : coerceNumber(row.soil_temp_6cm_current_c),
    soilTemp6cmSustainedDays:
      row.soil_temp_6cm_sustained_days == null
        ? null
        : coerceNumber(row.soil_temp_6cm_sustained_days),
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
            frost_risk_min_temp_c_7d: input.frostRiskMinTempC7d ?? null,
            frost_risk_nights_7d: input.frostRiskNights7d ?? null,
            recent_precip_total_72h_mm: input.recentPrecipTotal72hMm ?? null,
            freeze_thaw_cycles_7d: input.freezeThawCycles7d ?? null,
            soil_temp_6cm_current_c: input.soilTemp6cmCurrentC ?? null,
            soil_temp_6cm_sustained_days: input.soilTemp6cmSustainedDays ?? null,
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
