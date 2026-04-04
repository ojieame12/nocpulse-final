import assert from "node:assert/strict";
import test from "node:test";
import { createSupabaseFieldWeatherDerivedSignalSetRepository } from "./createSupabaseFieldWeatherDerivedSignalSetRepository";

test("upsertSignalSet retries without agronomic columns when the schema is behind", async () => {
  const calls: unknown[] = [];

  const client = {
    from(table: string) {
      assert.equal(table, "field_weather_signal_sets");

      return {
        upsert(row: unknown) {
          calls.push(row);

          const hasFreezeThawColumn =
            typeof row === "object" &&
            row !== null &&
            "freeze_thaw_cycles_7d" in row;

          if (hasFreezeThawColumn) {
            return {
              select() {
                return {
                  async single() {
                    return {
                      data: null,
                      error: {
                        message:
                          "Could not find the 'freeze_thaw_cycles_7d' column of 'field_weather_signal_sets' in the schema cache",
                      },
                    };
                  },
                };
              },
            };
          }

          return {
            select() {
              return {
                async single() {
                  return {
                    data: {
                      id: "signal-1",
                      workspace_id: "workspace-1",
                      field_id: "field-1",
                      weather_observation_id: "obs-1",
                      observed_at: "2026-04-04T03:30:00.000Z",
                      forecast_run_at: null,
                      source_key: "open-meteo:signals-v1",
                      provider_key: "open-meteo",
                      signal_version: 1,
                      current_vpd_kpa: 0.9,
                      peak_forecast_vpd_kpa_24h: 1.3,
                      net_water_balance_24h_mm: -1.1,
                      net_water_balance_72h_mm: -3.4,
                      leaf_wet_hours_24h: 2,
                      spray_window_count_24h: 1,
                      frost_risk_min_temp_c: -1.5,
                      gdd_24h: 4.2,
                      gdd_72h: 12.1,
                      gdd_base_c: 5,
                      provenance: {},
                      created_at: "2026-04-04T03:30:00.000Z",
                      updated_at: "2026-04-04T03:30:00.000Z",
                    },
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const repository = createSupabaseFieldWeatherDerivedSignalSetRepository(client as never);

  const signalSet = await repository.upsertSignalSet({
    workspaceId: "workspace-1",
    fieldId: "field-1",
    weatherObservationId: "obs-1",
    observedAt: "2026-04-04T03:30:00.000Z",
    forecastRunAt: null,
    sourceKey: "open-meteo:signals-v1",
    providerKey: "open-meteo",
    signalVersion: 1,
    currentVpdKpa: 0.9,
    peakForecastVpdKpa24h: 1.3,
    netWaterBalance24hMm: -1.1,
    netWaterBalance72hMm: -3.4,
    leafWetHours24h: 2,
    sprayWindowCount24h: 1,
    frostRiskMinTempC: -1.5,
    frostRiskMinTempC7d: -3.2,
    frostRiskNights7d: 2,
    frostProbabilityPct7d: 55,
    recentPrecipTotal72hMm: 6.4,
    freezeThawCycles7d: 1,
    soilTemp6cmCurrentC: 4.7,
    soilTemp6cmSustainedDays: 2,
    gdd24h: 4.2,
    gdd72h: 12.1,
    gddBaseC: 5,
    provenance: {},
  });

  assert.equal(calls.length, 2);
  assert.equal(
    typeof calls[0] === "object" && calls[0] !== null && "freeze_thaw_cycles_7d" in calls[0],
    true,
  );
  assert.equal(
    typeof calls[1] === "object" && calls[1] !== null && "freeze_thaw_cycles_7d" in calls[1],
    false,
  );
  assert.equal(signalSet.freezeThawCycles7d, null);
  assert.equal(signalSet.fieldId, "field-1");
});
