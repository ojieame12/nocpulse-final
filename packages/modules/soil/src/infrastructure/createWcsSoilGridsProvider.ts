import { fromArrayBuffer } from "geotiff";
import type {
  PerDepthSoilProperties,
  SoilPropertiesProvider,
} from "../contracts/SoilPropertiesProvider";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type WcsSoilGridsProviderOptions = {
  /** WCS map server base URL. Default: "https://maps.isric.org/mapserv" */
  wcsBaseUrl?: string;
  /** Request timeout per individual WCS request, ms. Default: 15_000 */
  timeoutMs?: number;
  /** Maximum retry attempts on 429/5xx. Default: 3 */
  maxRetries?: number;
  /** Custom fetch (for testing). */
  fetch?: typeof globalThis.fetch;
  /**
   * GeoTIFF parser seam — accepts an ArrayBuffer, returns an array of
   * pixel values (number[]). Injected for testing so callers can skip
   * a real GeoTIFF dependency.
   */
  parseGeoTiff?: (buffer: ArrayBuffer) => Promise<number[]>;
  /** Cache TTL in ms. Default: 30 days. */
  cacheTtlMs?: number;
};

type CacheEntry = {
  value: PerDepthSoilProperties | null;
  expiresAt: number;
};

type CacheKey = string;

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const PROPERTIES = ["wv0033", "wv1500"] as const;
type SoilProperty = (typeof PROPERTIES)[number];

const DEPTHS = ["0-5cm", "5-15cm", "15-30cm"] as const;

/** Thickness of each depth layer in cm — used for depth-weighted averaging. */
const DEPTH_THICKNESS: Record<string, number> = {
  "0-5cm": 5,
  "5-15cm": 10,
  "15-30cm": 15,
};

const TOTAL_DEPTH_CM = 30; // sum of above

const DEFAULT_QUANTILE = "mean";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function roundCoord(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function cacheKey(lat: number, lng: number): CacheKey {
  return `${roundCoord(lat)},${roundCoord(lng)}`;
}

function backoffMs(attempt: number): number {
  return 500 * Math.pow(2, attempt);
}

function isRetryable(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build the WCS GetCoverage URL for a single property + depth combo.
 * The bounding box is ±0.002 degrees around the point (~220m).
 */
function buildWcsUrl(
  baseUrl: string,
  property: SoilProperty,
  depth: string,
  quantile: string,
  lat: number,
  lng: number,
): string {
  const coverageId = `${property}_${depth}_${quantile}`;
  const latMin = (lat - 0.002).toFixed(6);
  const latMax = (lat + 0.002).toFixed(6);
  const lngMin = (lng - 0.002).toFixed(6);
  const lngMax = (lng + 0.002).toFixed(6);

  return (
    `${baseUrl}?map=/map/${property}.map` +
    `&SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage` +
    `&COVERAGEID=${coverageId}` +
    `&FORMAT=image/tiff` +
    `&SUBSET=long(${lngMin},${lngMax})` +
    `&SUBSET=lat(${latMin},${latMax})`
  );
}

/**
 * Default GeoTIFF parser using the `geotiff` package.
 * Returns all raster values from the first image band.
 */
async function defaultParseGeoTiff(buffer: ArrayBuffer): Promise<number[]> {
  const tiff = await fromArrayBuffer(buffer);
  const image = await tiff.getImage();
  const rasters = await image.readRasters();
  // rasters[0] is the first (and usually only) band
  const band = rasters[0];
  return Array.from(band as ArrayLike<number>);
}

/**
 * Compute the mean of valid (non-nodata) pixel values.
 * SoilGrids uses very large negative values or 0 as nodata markers.
 * We treat values <= -32768 as nodata.
 */
function pixelMean(pixels: number[]): { mean: number; count: number } | null {
  const NODATA_THRESHOLD = -32768;
  let sum = 0;
  let count = 0;
  for (const v of pixels) {
    if (v > NODATA_THRESHOLD && Number.isFinite(v)) {
      sum += v;
      count++;
    }
  }
  if (count === 0) return null;
  return { mean: sum / count, count };
}

/**
 * Depth-weighted average of per-depth values over the 0-30cm profile.
 * Returns null if no depths have valid data.
 */
function depthWeightedAverage(
  perDepth: Record<string, number | null>,
): number | null {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const [depth, value] of Object.entries(perDepth)) {
    if (value == null) continue;
    const thickness = DEPTH_THICKNESS[depth];
    if (thickness == null) continue;
    weightedSum += value * thickness;
    totalWeight += thickness;
  }
  if (totalWeight === 0) return null;
  // Depth-weighted mean: sum(value_i * thickness_i) / sum(thickness_i)
  return weightedSum / totalWeight;
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

export function createWcsSoilGridsProvider(
  options: WcsSoilGridsProviderOptions = {},
): SoilPropertiesProvider & { getCacheSize(): number } {
  const baseUrl = options.wcsBaseUrl ?? "https://maps.isric.org/mapserv";
  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxRetries = options.maxRetries ?? 3;
  const fetchFn = options.fetch ?? globalThis.fetch;
  const parseTiff = options.parseGeoTiff ?? defaultParseGeoTiff;
  const cacheTtlMs = options.cacheTtlMs ?? THIRTY_DAYS_MS;

  const cache = new Map<CacheKey, CacheEntry>();

  /**
   * Fetch a single coverage (one property + one depth) with retries.
   * Returns the mean pixel value (raw, before /10 scaling) or null.
   */
  async function fetchCoverage(
    property: SoilProperty,
    depth: string,
    lat: number,
    lng: number,
  ): Promise<{ mean: number; pixelCount: number } | null> {
    const url = buildWcsUrl(baseUrl, property, depth, DEFAULT_QUANTILE, lat, lng);
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
          lastError = new Error(`WCS returned ${response.status}`);
          continue;
        }

        if (!response.ok) {
          // Non-retryable HTTP error
          return null;
        }

        const buffer = await response.arrayBuffer();
        const pixels = await parseTiff(buffer);
        const result = pixelMean(pixels);
        if (!result) return null;

        return { mean: result.mean, pixelCount: result.count };
      } catch (error) {
        lastError = error;
        if (attempt === maxRetries) break;
      }
    }

    return null;
  }

  async function query(
    lat: number,
    lng: number,
  ): Promise<PerDepthSoilProperties | null> {
    const key = cacheKey(lat, lng);
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const roundedLat = roundCoord(lat);
    const roundedLng = roundCoord(lng);

    // Fetch all property×depth combos in parallel
    const requests: Array<{
      property: SoilProperty;
      depth: string;
      promise: Promise<{ mean: number; pixelCount: number } | null>;
    }> = [];

    for (const property of PROPERTIES) {
      for (const depth of DEPTHS) {
        requests.push({
          property,
          depth,
          promise: fetchCoverage(property, depth, roundedLat, roundedLng),
        });
      }
    }

    const results = await Promise.all(requests.map((r) => r.promise));

    const fc: Record<string, number | null> = {};
    const wp: Record<string, number | null> = {};
    let totalPixelCount = 0;
    let anySuccess = false;

    for (let i = 0; i < requests.length; i++) {
      const { property, depth } = requests[i];
      const result = results[i];

      const value = result ? result.mean / 10 : null; // raw → vol%
      if (result) {
        totalPixelCount += result.pixelCount;
        anySuccess = true;
      }

      if (property === "wv0033") {
        fc[depth] = value;
      } else {
        wp[depth] = value;
      }
    }

    if (!anySuccess) {
      cache.set(key, { value: null, expiresAt: Date.now() + cacheTtlMs });
      return null;
    }

    const aggregateFcPct = depthWeightedAverage(fc);
    const aggregateWpPct = depthWeightedAverage(wp);

    const result: PerDepthSoilProperties = {
      fc,
      wp,
      aggregateFcPct,
      aggregateWpPct,
      providerPath: "wcs",
      samplingMethod: DEFAULT_QUANTILE,
      pixelCount: totalPixelCount,
    };

    cache.set(key, { value: result, expiresAt: Date.now() + cacheTtlMs });
    return result;
  }

  function getCacheSize(): number {
    return cache.size;
  }

  return { query, getCacheSize };
}

// Re-export for convenience
export { depthWeightedAverage as _depthWeightedAverage } ;
export { pixelMean as _pixelMean };
export { buildWcsUrl as _buildWcsUrl };
