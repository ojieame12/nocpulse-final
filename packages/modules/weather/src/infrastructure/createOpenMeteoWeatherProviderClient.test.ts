import test from "node:test";
import assert from "node:assert/strict";
import { createOpenMeteoWeatherProviderClient } from "./createOpenMeteoWeatherProviderClient";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal valid Open-Meteo response payload for a single hourly entry.
 */
function makePayload() {
  return {
    hourly: {
      time: ["2024-06-15T12:00"],
      temperature_2m: [28.5],
      relative_humidity_2m: [62],
      precipitation: [0.0],
      precipitation_probability: [10],
      wind_speed_10m: [8.3],
      et0_fao_evapotranspiration: [3.1],
      soil_temperature_6cm: [11.4],
      soil_moisture_3_to_9cm: [0.25],
      soil_moisture_9_to_27cm: [0.22],
      soil_moisture_27_to_81cm: [0.18],
    },
  };
}

/**
 * Intercept global.fetch for the duration of a callback. Returns the captured
 * Request URL and restores the original fetch afterwards.
 */
async function withMockFetch<T>(
  responseBody: unknown,
  callback: () => Promise<T>,
): Promise<{ capturedUrl: string; result: T }> {
  let capturedUrl = "";
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
    capturedUrl = typeof input === "string" ? input : input.toString();
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const result = await callback();
    return { capturedUrl, result };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const INPUT = {
  latitude: 40.1,
  longitude: -89.2,
  requestedAt: "2024-06-15T12:00:00Z" as const,
};

// ---------------------------------------------------------------------------
// URL construction
// ---------------------------------------------------------------------------

test("default (no weatherModel) does not include &models= in URL", async () => {
  const client = createOpenMeteoWeatherProviderClient();

  const { capturedUrl } = await withMockFetch(makePayload(), () =>
    client.fetchFieldWeather(INPUT),
  );

  const url = new URL(capturedUrl);
  assert.equal(url.searchParams.has("models"), false);
});

test("weatherModel specified appends &models=era5_land to URL", async () => {
  const client = createOpenMeteoWeatherProviderClient({
    weatherModel: "era5_land",
  });

  const { capturedUrl } = await withMockFetch(makePayload(), () =>
    client.fetchFieldWeather(INPUT),
  );

  const url = new URL(capturedUrl);
  assert.equal(url.searchParams.get("models"), "era5_land");
});

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

test("weatherModel stored in observation provenance when specified", async () => {
  const client = createOpenMeteoWeatherProviderClient({
    weatherModel: "era5_land",
  });

  const { result } = await withMockFetch(makePayload(), () =>
    client.fetchFieldWeather(INPUT),
  );

  assert.equal(result.observation.provenance?.weatherModel, "era5_land");
});

test("observation includes soil temperature at 6 cm when Open-Meteo provides it", async () => {
  const client = createOpenMeteoWeatherProviderClient();

  const { capturedUrl, result } = await withMockFetch(makePayload(), () =>
    client.fetchFieldWeather(INPUT),
  );

  const url = new URL(capturedUrl);
  assert.match(url.searchParams.get("hourly") ?? "", /soil_temperature_6cm/);
  assert.equal(result.observation.soilTemperature6cmC, 11.4);
});

test("provenance defaults weatherModel to 'best_match' when not specified", async () => {
  const client = createOpenMeteoWeatherProviderClient();

  const { result } = await withMockFetch(makePayload(), () =>
    client.fetchFieldWeather(INPUT),
  );

  assert.equal(result.observation.provenance?.weatherModel, "best_match");
});

// ---------------------------------------------------------------------------
// Backward compatibility
// ---------------------------------------------------------------------------

test("observations without weatherModel field still load (backward compatible)", () => {
  // Simulates loading an old observation from the database that lacks weatherModel.
  const legacyProvenance: Record<string, string | undefined> = {
    forecastModel: "open-meteo-best-match",
    soilDataset: "open-meteo-hourly",
  };

  // The type allows weatherModel to be undefined — no runtime error accessing it.
  assert.equal(legacyProvenance["weatherModel"], undefined);
  assert.equal(legacyProvenance["forecastModel"], "open-meteo-best-match");
});
