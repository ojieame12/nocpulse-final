import type { SoilProperties } from "../contracts/SoilProperties";

export type SoilGridsClientOptions = {
  /** Base hostname, e.g. "rest.isric.org". No protocol prefix. */
  baseUrl?: string;
  /** Request timeout in milliseconds. Default: 10_000. */
  timeoutMs?: number;
  /** Maximum retry attempts on 429/5xx. Default: 3. */
  maxRetries?: number;
  /** Custom fetch implementation (for testing). */
  fetch?: typeof globalThis.fetch;
};

type CacheKey = string;

/**
 * Round a coordinate to 3 decimal places (~111m precision).
 * This ensures nearby points produce cache hits.
 */
function roundCoord(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function cacheKey(lat: number, lng: number): CacheKey {
  return `${roundCoord(lat)},${roundCoord(lng)}`;
}

/**
 * Exponential backoff: 500ms, 1s, 2s, ...
 */
function backoffMs(attempt: number): number {
  return 500 * Math.pow(2, attempt);
}

function isRetryable(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

export function createSoilGridsClient(options: SoilGridsClientOptions = {}) {
  const baseUrl = options.baseUrl ?? "rest.isric.org";
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxRetries = options.maxRetries ?? 3;
  const fetchFn = options.fetch ?? globalThis.fetch;

  const cache = new Map<CacheKey, SoilProperties | null>();

  async function query(lat: number, lng: number): Promise<SoilProperties | null> {
    const key = cacheKey(lat, lng);
    if (cache.has(key)) {
      return cache.get(key) ?? null;
    }

    const roundedLat = roundCoord(lat);
    const roundedLng = roundCoord(lng);

    const url =
      `https://${baseUrl}/soilgrids/v2.0/properties/query` +
      `?lon=${roundedLng}&lat=${roundedLat}` +
      `&property=wv0033&property=wv1500&depth=0-30cm&value=mean`;

    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        await sleep(backoffMs(attempt - 1));
      }

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetchFn(url, { signal: controller.signal });
        clearTimeout(timer);

        if (isRetryable(response.status)) {
          lastError = new Error(`SoilGrids returned ${response.status}`);
          continue;
        }

        if (!response.ok) {
          // Non-retryable error (e.g. 400, 404) — cache null and bail.
          cache.set(key, null);
          return null;
        }

        const body = await response.json();
        const result = parseSoilGridsResponse(body);
        cache.set(key, result);
        return result;
      } catch (error) {
        lastError = error;
        // AbortError (timeout) and network errors are retryable.
        if (attempt === maxRetries) break;
      }
    }

    // All attempts exhausted — gracefully return null.
    cache.set(key, null);
    return null;
  }

  /** Expose for testing. */
  function getCacheSize(): number {
    return cache.size;
  }

  return { query, getCacheSize };
}

export type SoilGridsClient = ReturnType<typeof createSoilGridsClient>;

/**
 * Parse the SoilGrids v2 REST response into our domain type.
 *
 * Expected shape (abbreviated):
 * ```json
 * {
 *   "properties": {
 *     "layers": [
 *       {
 *         "name": "wv0033",
 *         "depths": [{ "label": "0-30cm", "values": { "mean": 234 } }]
 *       },
 *       {
 *         "name": "wv1500",
 *         "depths": [{ "label": "0-30cm", "values": { "mean": 123 } }]
 *       }
 *     ]
 *   }
 * }
 * ```
 *
 * Raw values are in 0.1 vol% (dg/kg). Divide by 10 to get vol%.
 */
function parseSoilGridsResponse(body: unknown): SoilProperties | null {
  try {
    const obj = body as Record<string, unknown>;
    const props = obj.properties as Record<string, unknown> | undefined;
    if (!props) return null;

    const layers = props.layers as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(layers)) return null;

    let fieldCapacityRaw: number | undefined;
    let wiltingPointRaw: number | undefined;

    for (const layer of layers) {
      const name = layer.name as string;
      const depths = layer.depths as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(depths)) continue;

      for (const depth of depths) {
        if (depth.label !== "0-30cm") continue;
        const values = depth.values as Record<string, unknown> | undefined;
        if (!values) continue;
        const mean = values.mean;
        if (typeof mean !== "number") continue;

        if (name === "wv0033") fieldCapacityRaw = mean;
        if (name === "wv1500") wiltingPointRaw = mean;
      }
    }

    if (fieldCapacityRaw === undefined || wiltingPointRaw === undefined) {
      return null;
    }

    return {
      fieldCapacityPct: fieldCapacityRaw / 10,
      wiltingPointPct: wiltingPointRaw / 10,
      depthCm: "0-30cm",
      source: "soilgrids-v2",
    };
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
