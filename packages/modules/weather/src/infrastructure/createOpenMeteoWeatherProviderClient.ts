import type {
  FetchFieldWeatherInput,
  FetchFieldWeatherResult,
  WeatherProviderClient,
} from "../contracts/WeatherProviderClient";

type OpenMeteoHourlyPayload = {
  time: string[];
  temperature_2m?: Array<number | null>;
  relative_humidity_2m?: Array<number | null>;
  precipitation?: Array<number | null>;
  precipitation_probability?: Array<number | null>;
  wind_speed_10m?: Array<number | null>;
  et0_fao_evapotranspiration?: Array<number | null>;
  soil_temperature_6cm?: Array<number | null>;
  soil_moisture_3_to_9cm?: Array<number | null>;
  soil_moisture_9_to_27cm?: Array<number | null>;
  soil_moisture_27_to_81cm?: Array<number | null>;
};

type OpenMeteoForecastPayload = {
  hourly?: OpenMeteoHourlyPayload;
};

type OpenMeteoEnsembleHourlyPayload = {
  time: string[];
  temperature_2m?: Array<number | null>;
  [key: `temperature_2m_member${string}`]: Array<number | null> | string[] | undefined;
};

type OpenMeteoEnsemblePayload = {
  hourly?: OpenMeteoEnsembleHourlyPayload;
};

type CreateOpenMeteoWeatherProviderClientOptions = {
  apiKey?: string;
  forecastHours?: number;
  timeoutMs?: number;
  retries?: number;
  sourceKey?: string;
  /** Pin a specific Open-Meteo weather model (e.g. "era5_land", "era5"). When absent, uses Best Match. */
  weatherModel?: string;
  /** Ensemble model used to derive 7-day frost probability. Defaults to the documented sample model. */
  ensembleModel?: string;
};

const DEFAULT_FORECAST_HOURS = 168;
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_ENSEMBLE_MODEL = "icon_seamless_eps";
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const HOURLY_FIELDS = [
  "temperature_2m",
  "relative_humidity_2m",
  "precipitation_probability",
  "precipitation",
  "wind_speed_10m",
  "et0_fao_evapotranspiration",
  "soil_temperature_6cm",
  "soil_moisture_3_to_9cm",
  "soil_moisture_9_to_27cm",
  "soil_moisture_27_to_81cm",
].join(",");

function sleep(durationMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function numberAt(
  values: Array<number | null> | undefined,
  index: number,
): number | null {
  const value = values?.[index];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function requireNumberAt(
  values: Array<number | null> | undefined,
  index: number,
  label: string,
): number {
  const value = numberAt(values, index);

  if (value == null) {
    throw new Error(`[weather] Open-Meteo did not return ${label} for hour index ${index}.`);
  }

  return value;
}

function weightedSoilMoisturePct(
  hourly: OpenMeteoHourlyPayload,
  index: number,
): number | null {
  const weighted = [
    [numberAt(hourly.soil_moisture_3_to_9cm, index), 6],
    [numberAt(hourly.soil_moisture_9_to_27cm, index), 18],
    [numberAt(hourly.soil_moisture_27_to_81cm, index), 54],
  ].filter((entry): entry is [number, number] => entry[0] != null);

  if (weighted.length === 0) {
    return null;
  }

  const moistureSum = weighted.reduce((sum, [value, weight]) => sum + value * weight, 0);
  const weightSum = weighted.reduce((sum, [, weight]) => sum + weight, 0);

  return roundTo((moistureSum / weightSum) * 100, 1);
}

function toIso(value: string): string {
  return new Date(value).toISOString();
}

function buildSearchParams(input: FetchFieldWeatherInput, forecastHours: number, weatherModel?: string) {
  const params = new URLSearchParams({
    latitude: input.latitude.toString(),
    longitude: input.longitude.toString(),
    hourly: HOURLY_FIELDS,
    forecast_hours: forecastHours.toString(),
    timezone: "UTC",
  });

  if (weatherModel) {
    params.set("models", weatherModel);
  }

  return params;
}

async function fetchPayloadFromBaseUrl(
  baseUrl: string,
  searchParams: URLSearchParams,
  options: CreateOpenMeteoWeatherProviderClientOptions,
  apiKey?: string,
): Promise<OpenMeteoForecastPayload> {
  const requestUrl = new URL(baseUrl);
  requestUrl.search = searchParams.toString();

  if (apiKey) {
    requestUrl.searchParams.set("apikey", apiKey);
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = Math.max(0, options.retries ?? DEFAULT_RETRIES);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => {
      controller.abort("Open-Meteo request timed out");
    }, timeoutMs);

    try {
      const response = await fetch(requestUrl, {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const error = new Error(
          `Open-Meteo request failed with ${response.status}${
            body.trim() ? `: ${body.trim().slice(0, 160)}` : "."
          }`,
        ) as Error & { retryable?: boolean };
        error.retryable = RETRYABLE_STATUSES.has(response.status);
        throw error;
      }

      return (await response.json()) as OpenMeteoForecastPayload;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const retryable =
        (typeof error === "object" &&
          error !== null &&
          "retryable" in error &&
          (error as { retryable?: boolean }).retryable === true)
        || lastError.name === "AbortError";

      if (!retryable || attempt === retries) {
        break;
      }

      await sleep(150 * (attempt + 1));
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  }

  throw lastError ?? new Error("Open-Meteo request failed.");
}

async function fetchOpenMeteoPayload(
  input: FetchFieldWeatherInput,
  options: CreateOpenMeteoWeatherProviderClientOptions,
): Promise<OpenMeteoForecastPayload> {
  const searchParams = buildSearchParams(
    input,
    Math.max(1, options.forecastHours ?? input.forecastHours ?? DEFAULT_FORECAST_HOURS),
    options.weatherModel,
  );
  const publicBaseUrl = "https://api.open-meteo.com/v1/forecast";
  const paidBaseUrl = "https://customer-api.open-meteo.com/v1/forecast";
  const apiKey = options.apiKey?.trim();

  if (!apiKey) {
    return fetchPayloadFromBaseUrl(publicBaseUrl, searchParams, options);
  }

  try {
    return await fetchPayloadFromBaseUrl(paidBaseUrl, searchParams, options, apiKey);
  } catch (primaryError) {
    try {
      return await fetchPayloadFromBaseUrl(publicBaseUrl, searchParams, options);
    } catch (fallbackError) {
      throw new Error(
        `Open-Meteo paid endpoint failed (${
          primaryError instanceof Error ? primaryError.message : String(primaryError)
        }); public fallback failed (${
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        }).`,
      );
    }
  }
}

async function fetchOpenMeteoEnsemblePayload(input: {
  latitude: number;
  longitude: number;
  forecastHours: number;
  ensembleModel: string;
  options: CreateOpenMeteoWeatherProviderClientOptions;
}): Promise<OpenMeteoEnsemblePayload> {
  const searchParams = new URLSearchParams({
    latitude: input.latitude.toString(),
    longitude: input.longitude.toString(),
    hourly: "temperature_2m",
    forecast_hours: input.forecastHours.toString(),
    models: input.ensembleModel,
    timezone: "UTC",
  });
  const publicBaseUrl = "https://ensemble-api.open-meteo.com/v1/ensemble";
  const paidBaseUrl = "https://customer-ensemble-api.open-meteo.com/v1/ensemble";
  const apiKey = input.options.apiKey?.trim();

  if (!apiKey) {
    return fetchPayloadFromBaseUrl(
      publicBaseUrl,
      searchParams,
      input.options,
    ) as Promise<OpenMeteoEnsemblePayload>;
  }

  try {
    return await (fetchPayloadFromBaseUrl(
      paidBaseUrl,
      searchParams,
      input.options,
      apiKey,
    ) as Promise<OpenMeteoEnsemblePayload>);
  } catch (primaryError) {
    try {
      return await (fetchPayloadFromBaseUrl(
        publicBaseUrl,
        searchParams,
        input.options,
      ) as Promise<OpenMeteoEnsemblePayload>);
    } catch (fallbackError) {
      throw new Error(
        `Open-Meteo ensemble paid endpoint failed (${
          primaryError instanceof Error ? primaryError.message : String(primaryError)
        }); public fallback failed (${
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        }).`,
      );
    }
  }
}

function calculateFrostProbabilityFromEnsemble(input: {
  payload: OpenMeteoEnsemblePayload;
  thresholdC: number;
}) {
  const hourly = input.payload.hourly;

  if (!hourly || hourly.time.length === 0) {
    return {
      frostProbabilityPct7d: null,
      memberCount: null,
    };
  }

  const memberEntries = Object.entries(hourly).filter(
    (entry): entry is [string, Array<number | null>] => {
      const [key, value] = entry;
      return /^temperature_2m_member\d+$/.test(key) && Array.isArray(value);
    },
  );

  if (memberEntries.length === 0) {
    return {
      frostProbabilityPct7d: null,
      memberCount: 0,
    };
  }

  const memberCount = memberEntries.length;
  const riskyMemberCount = memberEntries.reduce((count, [, values]) => {
    const memberMinimum = values.reduce<number | null>((minimum, value) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return minimum;
      }

      return minimum == null ? value : Math.min(minimum, value);
    }, null);

    return memberMinimum != null && memberMinimum <= input.thresholdC
      ? count + 1
      : count;
  }, 0);

  return {
    frostProbabilityPct7d: roundTo((riskyMemberCount / memberCount) * 100, 1),
    memberCount,
  };
}

function toFieldWeatherResult(
  payload: OpenMeteoForecastPayload,
  input: FetchFieldWeatherInput,
  options: CreateOpenMeteoWeatherProviderClientOptions,
  ensemble: FetchFieldWeatherResult["ensemble"] = null,
): FetchFieldWeatherResult {
  const hourly = payload.hourly;

  if (!hourly || hourly.time.length === 0) {
    throw new Error("[weather] Open-Meteo returned no hourly weather data.");
  }

  const observationIndex = 0;
  const sourceKey = options.sourceKey ?? "open-meteo:hourly-v1";
  const forecastRunAt = input.requestedAt ?? new Date().toISOString();
  const observation = {
    observedAt: toIso(hourly.time[observationIndex]),
    airTemperatureC: roundTo(
      requireNumberAt(hourly.temperature_2m, observationIndex, "temperature_2m"),
      1,
    ),
    precipitationMm: roundTo(
      requireNumberAt(hourly.precipitation, observationIndex, "precipitation"),
      1,
    ),
    windSpeedKph: roundTo(
      requireNumberAt(hourly.wind_speed_10m, observationIndex, "wind_speed_10m"),
      1,
    ),
    relativeHumidityPct: numberAt(hourly.relative_humidity_2m, observationIndex),
    soilMoisturePct: weightedSoilMoisturePct(hourly, observationIndex),
    soilTemperature6cmC: numberAt(hourly.soil_temperature_6cm, observationIndex),
    evapotranspirationMm: numberAt(
      hourly.et0_fao_evapotranspiration,
      observationIndex,
    ),
    provenance: {
      forecastModel: "open-meteo-best-match",
      weatherModel: options.weatherModel ?? "best_match",
      soilDataset: "open-meteo-hourly",
    },
  };

  const entries = hourly.time.map((time, index) => {
    const temperature = roundTo(
      requireNumberAt(hourly.temperature_2m, index, "temperature_2m"),
      1,
    );

    return {
      validAt: toIso(time),
      airTemperatureMinC: temperature,
      airTemperatureMaxC: temperature,
      precipitationMm: roundTo(
        requireNumberAt(hourly.precipitation, index, "precipitation"),
        1,
      ),
      windSpeedKph: roundTo(
        requireNumberAt(hourly.wind_speed_10m, index, "wind_speed_10m"),
        1,
      ),
      relativeHumidityPct: numberAt(hourly.relative_humidity_2m, index),
      evapotranspirationMm: numberAt(
        hourly.et0_fao_evapotranspiration,
        index,
      ),
      precipitationProbabilityPct: numberAt(
        hourly.precipitation_probability,
        index,
      ),
    };
  });

  return {
    providerKey: "open-meteo",
    sourceKey,
    observation,
    forecastSet: {
      forecastRunAt,
      entries,
    },
    ensemble,
  };
}

export function createOpenMeteoWeatherProviderClient(
  options: CreateOpenMeteoWeatherProviderClientOptions = {},
): WeatherProviderClient {
  return {
    providerKey: "open-meteo",
    async fetchFieldWeather(input) {
      const payload = await fetchOpenMeteoPayload(input, options);
      const forecastHours = Math.max(
        1,
        options.forecastHours ?? input.forecastHours ?? DEFAULT_FORECAST_HOURS,
      );
      let ensemble: FetchFieldWeatherResult["ensemble"] = null;

      if (
        typeof input.frostDamageThresholdC === "number" &&
        Number.isFinite(input.frostDamageThresholdC)
      ) {
        const ensembleModel = options.ensembleModel ?? DEFAULT_ENSEMBLE_MODEL;
        const ensemblePayload = await fetchOpenMeteoEnsemblePayload({
          latitude: input.latitude,
          longitude: input.longitude,
          forecastHours,
          ensembleModel,
          options,
        });
        const probability = calculateFrostProbabilityFromEnsemble({
          payload: ensemblePayload,
          thresholdC: input.frostDamageThresholdC,
        });

        ensemble = {
          frostProbabilityPct7d: probability.frostProbabilityPct7d,
          frostProbabilityThresholdC: input.frostDamageThresholdC,
          modelKey: ensembleModel,
          memberCount: probability.memberCount,
        };
      }

      return toFieldWeatherResult(payload, input, options, ensemble);
    },
  };
}
