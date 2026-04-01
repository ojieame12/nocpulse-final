import type { SoilProperties } from "../contracts/SoilProperties";

/* ------------------------------------------------------------------ */
/* Public types                                                       */
/* ------------------------------------------------------------------ */

export type WebDavSoilGridsProviderOptions = {
  /** Default: https://files.isric.org/soilgrids/latest/data */
  baseUrl?: string;
  /** Custom fetch implementation (for testing). */
  fetch?: typeof globalThis.fetch;
  /**
   * Injectable GeoTIFF point sampler for testability.
   * Given a downloaded TIFF buffer and a coordinate, returns the raw
   * pixel value or null if the point falls outside the raster bounds.
   */
  pointSampler?: PointSampler;
  /** Delay between consecutive downloads in ms. Default: 5000 (ISRIC fair use). */
  downloadDelayMs?: number;
};

export type BulkSoilQuery = {
  fieldId: string;
  lat: number;
  lng: number;
};

export type BulkSoilResult = {
  fieldId: string;
  properties: PerDepthSoilProperties | null;
};

/**
 * Per-depth soil properties returned from bulk queries.
 * Uses the same shape as `SoilProperties` for downstream compatibility.
 */
export type PerDepthSoilProperties = SoilProperties;

/**
 * Injectable GeoTIFF point sampler for testability.
 * Given a TIFF buffer and a coordinate, returns the raw pixel value
 * at that location or null if the point falls outside the raster bounds.
 */
export type PointSampler = (
  tiffBuffer: ArrayBuffer,
  lat: number,
  lng: number,
) => number | null;

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_BASE_URL = "https://files.isric.org/soilgrids/latest/data";
const DEFAULT_DOWNLOAD_DELAY_MS = 5_000;

/**
 * SoilGrids WebDAV property/depth/quantile combinations we need
 * for field capacity (wv0033) and wilting point (wv1500).
 */
const PROPERTY_CONFIGS = [
  { property: "wv0033", depth: "0-30cm", quantile: "mean" },
  { property: "wv1500", depth: "0-30cm", quantile: "mean" },
] as const;

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build the COG tile URL for a given property+depth+quantile.
 * SoilGrids WebDAV structure:
 *   /{property}/{depth}/{quantile}.vrt   (virtual raster)
 *   /{property}/{depth}/{quantile}/tileSG-xxx_yyy.tif
 *
 * For simplicity we download the single-file COG at the VRT level.
 * Real implementation would compute which tile(s) cover the bbox.
 * For now we use the VRT URL which ISRIC serves as a Cloud-Optimized GeoTIFF.
 */
function tileUrl(
  baseUrl: string,
  property: string,
  depth: string,
  quantile: string,
): string {
  return `${baseUrl}/${property}/${depth}/${quantile}.vrt`;
}

function buildAuthHeader(): string {
  const credentials = btoa("anonymous:anonymous");
  return `Basic ${credentials}`;
}

/**
 * Compute the bounding box of a set of points.
 * Returns [minLat, minLng, maxLat, maxLng].
 */
function computeBbox(
  points: BulkSoilQuery[],
): [number, number, number, number] {
  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;

  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  return [minLat, minLng, maxLat, maxLng];
}

/** Default sampler that always returns null (no real GeoTIFF parsing). */
const NULL_SAMPLER: PointSampler = () => null;

/* ------------------------------------------------------------------ */
/* Provider factory                                                   */
/* ------------------------------------------------------------------ */

export function createWebDavSoilGridsProvider(
  options?: WebDavSoilGridsProviderOptions,
): {
  queryBulk(points: BulkSoilQuery[]): Promise<BulkSoilResult[]>;
} {
  const baseUrl = options?.baseUrl ?? DEFAULT_BASE_URL;
  const fetchFn = options?.fetch ?? globalThis.fetch;
  const sampler = options?.pointSampler ?? NULL_SAMPLER;
  const downloadDelayMs =
    options?.downloadDelayMs ?? DEFAULT_DOWNLOAD_DELAY_MS;

  async function downloadTile(
    property: string,
    depth: string,
    quantile: string,
  ): Promise<ArrayBuffer | null> {
    const url = tileUrl(baseUrl, property, depth, quantile);
    try {
      const response = await fetchFn(url, {
        headers: {
          Authorization: buildAuthHeader(),
        },
      });

      if (!response.ok) {
        return null;
      }

      return await response.arrayBuffer();
    } catch {
      return null;
    }
  }

  async function queryBulk(
    points: BulkSoilQuery[],
  ): Promise<BulkSoilResult[]> {
    if (points.length === 0) return [];

    // Compute bbox (used for future tile selection optimization).
    // Currently we download the VRT for each property+depth combo.
    const _bbox = computeBbox(points);

    // Download tiles for each property+depth combination with rate limiting.
    const tileBuffers = new Map<string, ArrayBuffer | null>();
    let isFirstDownload = true;

    for (const config of PROPERTY_CONFIGS) {
      if (!isFirstDownload) {
        await sleep(downloadDelayMs);
      }
      isFirstDownload = false;

      const key = `${config.property}/${config.depth}/${config.quantile}`;
      const buffer = await downloadTile(
        config.property,
        config.depth,
        config.quantile,
      );
      tileBuffers.set(key, buffer);
    }

    // Extract values for each point from the downloaded tiles.
    const results: BulkSoilResult[] = [];

    for (const point of points) {
      const wv0033Buffer = tileBuffers.get("wv0033/0-30cm/mean");
      const wv1500Buffer = tileBuffers.get("wv1500/0-30cm/mean");

      // If either tile failed to download, return null for this field.
      if (!wv0033Buffer || !wv1500Buffer) {
        results.push({ fieldId: point.fieldId, properties: null });
        continue;
      }

      const fieldCapacityRaw = sampler(wv0033Buffer, point.lat, point.lng);
      const wiltingPointRaw = sampler(wv1500Buffer, point.lat, point.lng);

      // If either value is null (point outside tile), return null.
      if (fieldCapacityRaw === null || wiltingPointRaw === null) {
        results.push({ fieldId: point.fieldId, properties: null });
        continue;
      }

      results.push({
        fieldId: point.fieldId,
        properties: {
          fieldCapacityPct: fieldCapacityRaw / 10,
          wiltingPointPct: wiltingPointRaw / 10,
          depthCm: "0-30cm",
          source: "soilgrids-v2",
        },
      });
    }

    return results;
  }

  return { queryBulk };
}
