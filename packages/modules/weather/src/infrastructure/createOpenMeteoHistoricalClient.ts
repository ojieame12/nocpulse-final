/**
 * Open-Meteo Historical Archive API client.
 *
 * Fetches daily soil moisture reanalysis data for the past 5 years so that
 * current conditions can be compared against historical baselines (e.g.,
 * "12% drier than normal for early April").
 *
 * API docs: https://open-meteo.com/en/docs/historical-weather-api
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HistoricalSoilMoistureResult = {
  dailyValues: Array<{
    date: string; // YYYY-MM-DD
    layers: Record<string, number | null>; // soil moisture layer values
  }>;
  latitude: number;
  longitude: number;
};

export type CreateOpenMeteoHistoricalClientOptions = {
  /** Override archive API base URL (scheme + host). */
  baseUrl?: string;
  /** Request timeout in milliseconds. */
  timeoutMs?: number;
  /** Number of automatic retries on transient failures. */
  retries?: number;
};

export type OpenMeteoHistoricalClient = {
  fetchHistoricalSoilMoisture(input: {
    latitude: number;
    longitude: number;
    /** How many years of history to fetch (default 5). */
    yearsBack?: number;
  }): Promise<HistoricalSoilMoistureResult>;
};

// ---------------------------------------------------------------------------
// Internal types for raw API response
// ---------------------------------------------------------------------------

type OpenMeteoArchiveDailyPayload = {
  time: string[];
  soil_moisture_0_to_7cm?: Array<number | null>;
  soil_moisture_7_to_28cm?: Array<number | null>;
  soil_moisture_28_to_100cm?: Array<number | null>;
};

type OpenMeteoArchiveResponse = {
  latitude: number;
  longitude: number;
  daily?: OpenMeteoArchiveDailyPayload;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = "https://archive-api.open-meteo.com";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_YEARS_BACK = 5;
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

const DAILY_FIELDS = [
  "soil_moisture_0_to_7cm",
  "soil_moisture_7_to_28cm",
  "soil_moisture_28_to_100cm",
].join(",");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(durationMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// Fetch with retry
// ---------------------------------------------------------------------------

async function fetchWithRetry(
  url: URL,
  options: CreateOpenMeteoHistoricalClientOptions,
): Promise<OpenMeteoArchiveResponse> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = Math.max(0, options.retries ?? DEFAULT_RETRIES);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => {
      controller.abort("Open-Meteo archive request timed out");
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const error = new Error(
          `Open-Meteo archive request failed with ${response.status}${
            body.trim() ? `: ${body.trim().slice(0, 160)}` : "."
          }`,
        ) as Error & { retryable?: boolean };
        error.retryable = RETRYABLE_STATUSES.has(response.status);
        throw error;
      }

      return (await response.json()) as OpenMeteoArchiveResponse;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const retryable =
        (typeof error === "object" &&
          error !== null &&
          "retryable" in error &&
          (error as { retryable?: boolean }).retryable === true) ||
        lastError.name === "AbortError";

      if (!retryable || attempt === retries) {
        break;
      }

      await sleep(150 * (attempt + 1));
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  }

  throw lastError ?? new Error("Open-Meteo archive request failed.");
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

const LAYER_KEYS = [
  "soil_moisture_0_to_7cm",
  "soil_moisture_7_to_28cm",
  "soil_moisture_28_to_100cm",
] as const;

export function parseArchiveResponse(
  response: OpenMeteoArchiveResponse,
): HistoricalSoilMoistureResult {
  const daily = response.daily;

  if (!daily || !daily.time || daily.time.length === 0) {
    return {
      dailyValues: [],
      latitude: response.latitude,
      longitude: response.longitude,
    };
  }

  const dailyValues = daily.time.map((date, index) => {
    const layers: Record<string, number | null> = {};
    for (const key of LAYER_KEYS) {
      const arr = daily[key];
      layers[key] = arr?.[index] ?? null;
    }
    return { date, layers };
  });

  return {
    dailyValues,
    latitude: response.latitude,
    longitude: response.longitude,
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createOpenMeteoHistoricalClient(
  options: CreateOpenMeteoHistoricalClientOptions = {},
): OpenMeteoHistoricalClient {
  const baseUrl = options.baseUrl?.replace(/\/+$/, "") ?? DEFAULT_BASE_URL;

  return {
    async fetchHistoricalSoilMoisture(input) {
      const yearsBack = input.yearsBack ?? DEFAULT_YEARS_BACK;

      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 1); // yesterday

      const startDate = new Date(endDate);
      startDate.setFullYear(startDate.getFullYear() - yearsBack);

      const url = new URL("/v1/archive", baseUrl);
      url.searchParams.set("latitude", input.latitude.toString());
      url.searchParams.set("longitude", input.longitude.toString());
      url.searchParams.set("start_date", formatDate(startDate));
      url.searchParams.set("end_date", formatDate(endDate));
      url.searchParams.set("daily", DAILY_FIELDS);
      url.searchParams.set("timezone", "auto");

      const response = await fetchWithRetry(url, options);
      return parseArchiveResponse(response);
    },
  };
}
