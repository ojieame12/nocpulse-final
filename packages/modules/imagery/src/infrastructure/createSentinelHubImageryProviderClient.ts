import type {
  RasterFieldGridCell,
  RasterFieldGridObservation,
  RasterMultiPolygon,
  RasterPolygon,
} from "@fieldpulse/raster";
import type { ImageryProvider } from "../contracts/ImageryProvider";
import type { ImageryScene } from "../contracts/ImageryScene";
import { createSyntheticRasterFieldObservationProvider } from "./createSyntheticRasterFieldObservationProvider";
import type {
  DiscoverLatestImagerySceneInput,
  ImageryProviderClient,
  MaterializeImagerySceneInput,
} from "./ImageryProviderClient";

type CreateSentinelHubImageryProviderClientOptions = {
  provider: Extract<ImageryProvider, "sentinel-1" | "sentinel-2">;
  clientId: string;
  clientSecret: string;
  baseUrl?: string;
  tokenUrl?: string;
};

type SentinelHubSearchFeature = {
  id?: string;
  properties?: {
    datetime?: string;
    ["eo:cloud_cover"]?: number;
  };
};

type SentinelHubStatisticsBandStats = {
  stats?: {
    mean?: number;
    sampleCount?: number;
    noDataCount?: number;
  };
};

type SentinelHubStatisticsResponse = {
  data?: Array<{
    outputs?: {
      data?: {
        bands?: Record<string, SentinelHubStatisticsBandStats>;
      };
    };
  }>;
};

const SENTINEL_HUB_STATS_ENDPOINT = "/api/v1/statistics";
const EPSG_4326_CRS = "http://www.opengis.net/def/crs/EPSG/0/4326";
const TEN_METERS_IN_DEGREES = 0.00009;
const MATERIALIZATION_CONCURRENCY = 6;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const SENTINEL_2_CELL_MEASUREMENT_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{
      bands: ["B02", "B03", "B04", "B08", "B11", "dataMask"]
    }],
    output: [
      {
        id: "data",
        bands: ["ndvi", "ndmi", "shadow"],
        sampleType: "FLOAT32"
      },
      {
        id: "dataMask",
        bands: 1,
        sampleType: "UINT8"
      }
    ]
  };
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function evaluatePixel(sample) {
  const ndviDenominator = sample.B08 + sample.B04;
  const ndmiDenominator = sample.B08 + sample.B11;
  const ndvi = ndviDenominator === 0 ? 0 : (sample.B08 - sample.B04) / ndviDenominator;
  const ndmi = ndmiDenominator === 0 ? 0 : (sample.B08 - sample.B11) / ndmiDenominator;
  const brightness = (sample.B02 + sample.B03 + sample.B04) / 3;
  const shadow = clamp((0.35 - brightness) / 0.35, 0, 1);

  return {
    data: [ndvi, ndmi, shadow],
    dataMask: [sample.dataMask]
  };
}`;
const SENTINEL_1_CELL_MEASUREMENT_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{
      bands: ["VV", "VH", "dataMask"]
    }],
    output: [
      {
        id: "data",
        bands: ["sarWetness", "sarRatio", "vv", "vh"],
        sampleType: "FLOAT32"
      },
      {
        id: "dataMask",
        bands: 1,
        sampleType: "UINT8"
      }
    ]
  };
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function toDb(power) {
  return 10 * Math.log(Math.max(power, 0.000001)) / Math.LN10;
}

function evaluatePixel(sample) {
  const vvDb = toDb(sample.VV);
  const vhDb = toDb(sample.VH);
  const ratioDb = vvDb - vhDb;
  const vvNorm = clamp((vvDb + 22) / 17, 0, 1);
  const vhNorm = clamp((vhDb + 28) / 20, 0, 1);
  const sarWetness = clamp(vvNorm * 0.6 + vhNorm * 0.4, 0, 1);
  const sarRatio = clamp((ratioDb - 1) / 11, 0, 1);

  return {
    data: [sarWetness, sarRatio, vvNorm, vhNorm],
    dataMask: [sample.dataMask]
  };
}`;
const SENTINEL_2_SCENE_CONDITION_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{
      bands: ["B03", "B11", "SNW", "CLD", "dataMask"]
    }],
    output: [
      {
        id: "data",
        bands: ["snowProb", "cloudProb", "ndsi"],
        sampleType: "FLOAT32"
      },
      {
        id: "dataMask",
        bands: 1,
        sampleType: "UINT8"
      }
    ]
  };
}

function evaluatePixel(sample) {
  const ndsiDenominator = sample.B03 + sample.B11;
  const ndsi = ndsiDenominator === 0 ? 0 : (sample.B03 - sample.B11) / ndsiDenominator;

  return {
    data: [sample.SNW / 100, sample.CLD / 100, ndsi],
    dataMask: [sample.dataMask]
  };
}`;

function deriveBoundingBox(boundary: RasterMultiPolygon) {
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;

  for (const polygon of boundary.coordinates) {
    for (const ring of polygon) {
      for (const [longitude, latitude] of ring) {
        west = Math.min(west, longitude);
        south = Math.min(south, latitude);
        east = Math.max(east, longitude);
        north = Math.max(north, latitude);
      }
    }
  }

  return [west, south, east, north] as const;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function toStartDate(requestedAt: string) {
  const value = new Date(requestedAt);
  value.setUTCDate(value.getUTCDate() - 30);
  return value.toISOString();
}

function toSceneUtcDayTimeRange(capturedAt: string) {
  const captured = new Date(capturedAt);
  const start = new Date(
    Date.UTC(
      captured.getUTCFullYear(),
      captured.getUTCMonth(),
      captured.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return {
    from: start.toISOString(),
    to: end.toISOString(),
  };
}

function toCollection(provider: Extract<ImageryProvider, "sentinel-1" | "sentinel-2">) {
  return provider === "sentinel-1" ? "sentinel-1-grd" : "sentinel-2-l2a";
}

function readCloudCover(feature: SentinelHubSearchFeature) {
  const value = feature.properties?.["eo:cloud_cover"];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function byNewestCapture(
  left: SentinelHubSearchFeature,
  right: SentinelHubSearchFeature,
) {
  return (
    new Date(right.properties!.datetime!).getTime() -
    new Date(left.properties!.datetime!).getTime()
  );
}

function pickBestFeature(
  provider: Extract<ImageryProvider, "sentinel-1" | "sentinel-2">,
  features: SentinelHubSearchFeature[],
) {
  const candidates = features.filter(
    (feature) => typeof feature.properties?.datetime === "string",
  );

  if (provider !== "sentinel-2") {
    return [...candidates].sort(byNewestCapture)[0] ?? null;
  }

  const preferred = candidates.filter((feature) => {
    const cloudCover = readCloudCover(feature);
    return cloudCover === null || cloudCover <= 50;
  });

  if (preferred.length > 0) {
    return [...preferred].sort(byNewestCapture)[0] ?? null;
  }

  return [...candidates].sort((left, right) => {
    const leftCloudCover = readCloudCover(left);
    const rightCloudCover = readCloudCover(right);

    if (leftCloudCover !== null && rightCloudCover !== null) {
      if (leftCloudCover !== rightCloudCover) {
        return leftCloudCover - rightCloudCover;
      }
    } else if (leftCloudCover === null && rightCloudCover !== null) {
      return -1;
    } else if (leftCloudCover !== null && rightCloudCover === null) {
      return 1;
    }

    return byNewestCapture(left, right);
  })[0] ?? null;
}

function readBandMean(
  payload: SentinelHubStatisticsResponse,
  bandKey: string,
): number | null {
  const mean = payload.data?.[0]?.outputs?.data?.bands?.[bandKey]?.stats?.mean;
  return typeof mean === "number" && Number.isFinite(mean) ? mean : null;
}

function readSampleCount(
  payload: SentinelHubStatisticsResponse,
  bandKey: string,
): number {
  const sampleCount =
    payload.data?.[0]?.outputs?.data?.bands?.[bandKey]?.stats?.sampleCount;
  return typeof sampleCount === "number" && Number.isFinite(sampleCount)
    ? sampleCount
    : 0;
}

async function sleep(milliseconds: number) {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function postJsonWithRetry(
  url: string,
  init: RequestInit,
  retries = 1,
): Promise<Response> {
  let attempt = 0;

  while (true) {
    const response = await fetch(url, init);

    if (response.ok || attempt >= retries || !RETRYABLE_STATUS_CODES.has(response.status)) {
      return response;
    }

    attempt += 1;
    await sleep(250 * attempt);
  }
}

async function mapWithConcurrency<T, TResult>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<TResult>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;

        if (currentIndex >= items.length) {
          return;
        }

        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    }),
  );

  return results;
}

async function fetchSentinel2CellMeasurements({
  accessToken,
  baseUrl,
  boundary,
  capturedAt,
}: {
  accessToken: string;
  baseUrl: string;
  boundary: RasterPolygon;
  capturedAt: string;
}): Promise<Readonly<Record<string, number>> | null> {
  const response = await postJsonWithRetry(
    `${baseUrl}${SENTINEL_HUB_STATS_ENDPOINT}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        input: {
          bounds: {
            geometry: boundary,
            properties: {
              crs: EPSG_4326_CRS,
            },
          },
          data: [
            {
              type: "sentinel-2-l2a",
              dataFilter: {
                mosaickingOrder: "mostRecent",
              },
            },
          ],
        },
        aggregation: {
          timeRange: toSceneUtcDayTimeRange(capturedAt),
          aggregationInterval: {
            of: "P1D",
          },
          resx: TEN_METERS_IN_DEGREES,
          resy: TEN_METERS_IN_DEGREES,
          evalscript: SENTINEL_2_CELL_MEASUREMENT_EVALSCRIPT,
        },
        calculations: {
          default: {},
        },
      }),
    },
    1,
  );

  if (!response.ok) {
    throw new Error(
      `[imagery] sentinel hub statistics failed with ${response.status}`,
    );
  }

  const payload = (await response.json()) as SentinelHubStatisticsResponse;
  const sampleCount = readSampleCount(payload, "ndvi");

  if (sampleCount <= 0) {
    return null;
  }

  const ndvi = readBandMean(payload, "ndvi");
  const ndmi = readBandMean(payload, "ndmi");
  const shadow = readBandMean(payload, "shadow");

  if (ndvi === null && ndmi === null && shadow === null) {
    return null;
  }

  return {
    ...(ndvi === null ? {} : { ndvi: clamp(Number(ndvi.toFixed(4)), -1, 1) }),
    ...(ndmi === null ? {} : { ndmi: clamp(Number(ndmi.toFixed(4)), -1, 1) }),
    ...(shadow === null
      ? {}
      : { shadow: clamp(Number(shadow.toFixed(4)), 0, 1) }),
  };
}

async function materializeSentinel2Observation({
  accessToken,
  baseUrl,
  input,
  gridCells,
}: {
  accessToken: string;
  baseUrl: string;
  input: MaterializeImagerySceneInput;
  gridCells: readonly RasterFieldGridCell[];
}): Promise<RasterFieldGridObservation | null> {
  const measuredCells = await mapWithConcurrency(
    gridCells,
    MATERIALIZATION_CONCURRENCY,
    async (cell) => {
      const measurements = await fetchSentinel2CellMeasurements({
        accessToken,
        baseUrl,
        boundary: cell.boundary,
        capturedAt: input.scene.capturedAt,
      });

      return measurements
        ? {
            ...cell,
            measurements,
          }
        : null;
    },
  );

  const cells = measuredCells.filter(
    (cell): cell is RasterFieldGridCell => cell !== null,
  );

  if (cells.length === 0) {
    return null;
  }

  return {
    sourceKey: "sentinel-hub-stats-v1:sentinel-2",
    cells,
  };
}

async function fetchSentinel2SceneConditionMetrics({
  accessToken,
  baseUrl,
  boundary,
  capturedAt,
}: {
  accessToken: string;
  baseUrl: string;
  boundary: RasterMultiPolygon;
  capturedAt: string;
}): Promise<
  | {
      snowProbPct: number | null;
      cloudProbPct: number | null;
      ndsi: number | null;
    }
  | null
> {
  const response = await postJsonWithRetry(
    `${baseUrl}${SENTINEL_HUB_STATS_ENDPOINT}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        input: {
          bounds: {
            geometry: boundary,
            properties: {
              crs: EPSG_4326_CRS,
            },
          },
          data: [
            {
              type: "sentinel-2-l2a",
              dataFilter: {
                mosaickingOrder: "mostRecent",
              },
            },
          ],
        },
        aggregation: {
          timeRange: toSceneUtcDayTimeRange(capturedAt),
          aggregationInterval: {
            of: "P1D",
          },
          resx: TEN_METERS_IN_DEGREES * 2,
          resy: TEN_METERS_IN_DEGREES * 2,
          evalscript: SENTINEL_2_SCENE_CONDITION_EVALSCRIPT,
        },
        calculations: {
          default: {},
        },
      }),
    },
    1,
  );

  if (!response.ok) {
    throw new Error(
      `[imagery] sentinel hub scene condition statistics failed with ${response.status}`,
    );
  }

  const payload = (await response.json()) as SentinelHubStatisticsResponse;
  const sampleCount = readSampleCount(payload, "snowProb");

  if (sampleCount <= 0) {
    return null;
  }

  const snowProb = readBandMean(payload, "snowProb");
  const cloudProb = readBandMean(payload, "cloudProb");
  const ndsi = readBandMean(payload, "ndsi");

  return {
    snowProbPct:
      snowProb === null ? null : clamp(Number((snowProb * 100).toFixed(2)), 0, 100),
    cloudProbPct:
      cloudProb === null
        ? null
        : clamp(Number((cloudProb * 100).toFixed(2)), 0, 100),
    ndsi: ndsi === null ? null : clamp(Number(ndsi.toFixed(4)), -1, 1),
  };
}

async function fetchSentinel1CellMeasurements({
  accessToken,
  baseUrl,
  boundary,
  capturedAt,
}: {
  accessToken: string;
  baseUrl: string;
  boundary: RasterPolygon;
  capturedAt: string;
}): Promise<Readonly<Record<string, number>> | null> {
  const response = await postJsonWithRetry(
    `${baseUrl}${SENTINEL_HUB_STATS_ENDPOINT}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        input: {
          bounds: {
            geometry: boundary,
            properties: {
              crs: EPSG_4326_CRS,
            },
          },
          data: [
            {
              type: "sentinel-1-grd",
              dataFilter: {
                mosaickingOrder: "mostRecent",
              },
            },
          ],
        },
        aggregation: {
          timeRange: toSceneUtcDayTimeRange(capturedAt),
          aggregationInterval: {
            of: "P1D",
          },
          resx: TEN_METERS_IN_DEGREES,
          resy: TEN_METERS_IN_DEGREES,
          evalscript: SENTINEL_1_CELL_MEASUREMENT_EVALSCRIPT,
        },
        calculations: {
          default: {},
        },
      }),
    },
    1,
  );

  if (!response.ok) {
    throw new Error(
      `[imagery] sentinel hub statistics failed with ${response.status}`,
    );
  }

  const payload = (await response.json()) as SentinelHubStatisticsResponse;
  const sampleCount = readSampleCount(payload, "sarWetness");

  if (sampleCount <= 0) {
    return null;
  }

  const sarWetness = readBandMean(payload, "sarWetness");
  const sarRatio = readBandMean(payload, "sarRatio");
  const vv = readBandMean(payload, "vv");
  const vh = readBandMean(payload, "vh");

  if (sarWetness === null && sarRatio === null && vv === null && vh === null) {
    return null;
  }

  return {
    ...(sarWetness === null
      ? {}
      : { sarWetness: clamp(Number(sarWetness.toFixed(4)), 0, 1) }),
    ...(sarRatio === null
      ? {}
      : { sarRatio: clamp(Number(sarRatio.toFixed(4)), 0, 1) }),
    ...(vv === null ? {} : { vv: clamp(Number(vv.toFixed(4)), 0, 1) }),
    ...(vh === null ? {} : { vh: clamp(Number(vh.toFixed(4)), 0, 1) }),
  };
}

async function materializeSentinel1Observation({
  accessToken,
  baseUrl,
  input,
  gridCells,
}: {
  accessToken: string;
  baseUrl: string;
  input: MaterializeImagerySceneInput;
  gridCells: readonly RasterFieldGridCell[];
}): Promise<RasterFieldGridObservation | null> {
  const measuredCells = await mapWithConcurrency(
    gridCells,
    MATERIALIZATION_CONCURRENCY,
    async (cell) => {
      const measurements = await fetchSentinel1CellMeasurements({
        accessToken,
        baseUrl,
        boundary: cell.boundary,
        capturedAt: input.scene.capturedAt,
      });

      return measurements
        ? {
            ...cell,
            measurements,
          }
        : null;
    },
  );

  const cells = measuredCells.filter(
    (cell): cell is RasterFieldGridCell => cell !== null,
  );

  if (cells.length === 0) {
    return null;
  }

  return {
    sourceKey: "sentinel-hub-stats-v1:sentinel-1",
    cells,
  };
}

async function fetchAccessToken(
  tokenUrl: string,
  clientId: string,
  clientSecret: string,
) {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const detail = body.trim();
    throw new Error(
      detail
        ? `[imagery] sentinel hub token request failed with ${response.status}: ${detail}`
        : `[imagery] sentinel hub token request failed with ${response.status}`,
    );
  }

  const payload = (await response.json()) as {
    access_token?: string;
  };

  if (!payload.access_token) {
    throw new Error("[imagery] sentinel hub token response missing access_token");
  }

  return payload.access_token;
}

export function createSentinelHubImageryProviderClient({
  provider,
  clientId,
  clientSecret,
  baseUrl = "https://services.sentinel-hub.com",
  tokenUrl = "https://services.sentinel-hub.com/auth/realms/main/protocol/openid-connect/token",
}: CreateSentinelHubImageryProviderClientOptions): ImageryProviderClient {
  const rasterGridProvider = createSyntheticRasterFieldObservationProvider({
    providers: [provider],
    sourceKey: `sentinel-hub-raster-${provider}-fallback-v1`,
  });

  return {
    provider,
    async healthcheck() {
      try {
        await fetchAccessToken(tokenUrl, clientId, clientSecret);
        return true;
      } catch {
        return false;
      }
    },
    async diagnose() {
      try {
        await fetchAccessToken(tokenUrl, clientId, clientSecret);

        return {
          provider,
          status: "ready",
          discoveryMode: "provider",
          materializationMode: "provider",
          discoveryClient: "sentinel-hub-catalog",
          materializationClient: "sentinel-hub-statistics",
          fallbackClient: null,
          reason: null,
          details: {
            providerConfigured: true,
            tokenCheck: true,
          },
        };
      } catch (error) {
        return {
          provider,
          status: "unavailable",
          discoveryMode: "provider",
          materializationMode: "provider",
          discoveryClient: "sentinel-hub-catalog",
          materializationClient: "sentinel-hub-statistics",
          fallbackClient: "synthetic-imagery-provider",
          reason:
            error instanceof Error
              ? error.message
              : "Sentinel Hub diagnostics failed.",
          details: {
            providerConfigured: true,
            tokenCheck: false,
          },
        };
      }
    },
    async discoverLatestScene(input: DiscoverLatestImagerySceneInput) {
      const accessToken = await fetchAccessToken(tokenUrl, clientId, clientSecret);
      const response = await fetch(`${baseUrl}/api/v1/catalog/1.0.0/search`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          bbox: deriveBoundingBox(input.boundary),
          datetime: `${toStartDate(input.requestedAt)}/${input.requestedAt}`,
          collections: [toCollection(provider)],
          limit: 12,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `[imagery] sentinel hub search failed with ${response.status}`,
        );
      }

      const payload = (await response.json()) as {
        features?: SentinelHubSearchFeature[];
      };
      const feature = pickBestFeature(provider, payload.features ?? []);

      if (!feature || !feature.properties?.datetime) {
        return null;
      }

      const sceneConditionMetrics =
        provider === "sentinel-2"
          ? await fetchSentinel2SceneConditionMetrics({
              accessToken,
              baseUrl,
              boundary: input.boundary,
              capturedAt: feature.properties.datetime,
            }).catch(() => null)
          : null;

      const scene = {
        provider,
        sceneKey: feature.id ?? `${provider}:${input.fieldId}:${feature.properties.datetime}`,
        capturedAt: feature.properties.datetime,
        coveragePct: 100,
        cloudCoverPct:
          typeof feature.properties["eo:cloud_cover"] === "number"
            ? feature.properties["eo:cloud_cover"]
            : null,
        note: `Sentinel Hub scene discovered for ${provider}.`,
      } satisfies ImageryScene;

      return {
        scene,
        metadata: {
          discoveryMode: "provider",
          discoveryClient: "sentinel-hub-catalog",
          discoveryProvider: provider,
          discoveryFallbackReason: null,
          ...(sceneConditionMetrics?.snowProbPct == null
            ? {}
            : { sceneSnowProbabilityPct: sceneConditionMetrics.snowProbPct }),
          ...(sceneConditionMetrics?.cloudProbPct == null
            ? {}
            : { sceneCloudProbabilityPct: sceneConditionMetrics.cloudProbPct }),
          ...(sceneConditionMetrics?.ndsi == null
            ? {}
            : { sceneNdsi: sceneConditionMetrics.ndsi }),
        },
        note: scene.note,
      };
    },
    async materializeFieldObservation(input: MaterializeImagerySceneInput) {
      const baseGrid = await rasterGridProvider.observeFieldRaster({
        workspaceId: input.workspaceId,
        fieldId: input.fieldId,
        boundary: input.boundary,
        observedAt: input.scene.capturedAt,
      });

      if (!baseGrid || baseGrid.cells.length === 0) {
        return null;
      }

      const accessToken = await fetchAccessToken(tokenUrl, clientId, clientSecret);
      const observation =
        provider === "sentinel-2"
          ? await materializeSentinel2Observation({
              accessToken,
              baseUrl,
              input,
              gridCells: baseGrid.cells,
            })
          : await materializeSentinel1Observation({
              accessToken,
              baseUrl,
              input,
              gridCells: baseGrid.cells,
            });

      if (!observation) {
        return null;
      }

      return {
        observation,
        metadata: {
          materializationMode: "provider",
          materializationClient: "sentinel-hub-statistics",
          materializationProvider: provider,
          materializationFallbackReason: null,
        },
        note: "Sentinel Hub statistics materialized field cell measurements.",
      };
    },
  };
}
