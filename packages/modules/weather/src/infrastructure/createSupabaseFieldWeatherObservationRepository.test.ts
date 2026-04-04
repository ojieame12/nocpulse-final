import assert from "node:assert/strict";
import test from "node:test";
import { createSupabaseFieldWeatherObservationRepository } from "./createSupabaseFieldWeatherObservationRepository";

test("upsertObservation retries without soil temperature when the column is unavailable", async () => {
  const calls: unknown[] = [];

  const client = {
    from(table: string) {
      assert.equal(table, "field_weather_observations");

      return {
        upsert(row: unknown) {
          calls.push(row);

          const hasSoilTemperature =
            typeof row === "object" &&
            row !== null &&
            "soil_temperature_6cm_c" in row;

          if (hasSoilTemperature) {
            return {
              select() {
                return {
                  async single() {
                    return {
                      data: null,
                      error: {
                        message:
                          "Could not find the 'soil_temperature_6cm_c' column of 'field_weather_observations' in the schema cache",
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
                      id: "obs-1",
                      workspace_id: "workspace-1",
                      field_id: "field-1",
                      observed_at: "2026-04-04T03:20:00.000Z",
                      source_key: "open-meteo:hourly-v1",
                      provider_key: "open-meteo",
                      air_temperature_c: 6.4,
                      precipitation_mm: 0.5,
                      wind_speed_kph: 18,
                      relative_humidity_pct: 64,
                      soil_moisture_pct: 22,
                      evapotranspiration_mm: 1.2,
                      provenance: {},
                      created_at: "2026-04-04T03:20:00.000Z",
                      updated_at: "2026-04-04T03:20:00.000Z",
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

  const repository = createSupabaseFieldWeatherObservationRepository(client as never);

  const observation = await repository.upsertObservation({
    workspaceId: "workspace-1",
    fieldId: "field-1",
    observedAt: "2026-04-04T03:20:00.000Z",
    sourceKey: "open-meteo:hourly-v1",
    providerKey: "open-meteo",
    airTemperatureC: 6.4,
    precipitationMm: 0.5,
    windSpeedKph: 18,
    relativeHumidityPct: 64,
    soilMoisturePct: 22,
    soilTemperature6cmC: 4.8,
    evapotranspirationMm: 1.2,
    provenance: {},
  });

  assert.equal(calls.length, 2);
  assert.equal(
    typeof calls[0] === "object" && calls[0] !== null && "soil_temperature_6cm_c" in calls[0],
    true,
  );
  assert.equal(
    typeof calls[1] === "object" && calls[1] !== null && "soil_temperature_6cm_c" in calls[1],
    false,
  );
  assert.equal(observation.soilTemperature6cmC, null);
  assert.equal(observation.fieldId, "field-1");
});
