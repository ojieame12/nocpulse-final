import {
  sampleGeoTiffFieldGridObservation,
  type RasterFieldGridObservation,
  type RasterMultiPolygon,
} from "@fieldpulse/raster";
import type { ImageryScene } from "../contracts/ImageryScene";
import { createSyntheticRasterFieldObservationProvider } from "./createSyntheticRasterFieldObservationProvider";
import type {
  DiscoverLatestImagerySceneInput,
  ImageryProviderClient,
  MaterializeImagerySceneInput,
} from "./ImageryProviderClient";

type CreatePlanetImageryProviderClientOptions = {
  apiKey: string;
  baseUrl?: string;
  ordersBaseUrl?: string;
};

type PlanetFeature = {
  id?: string;
  properties?: {
    acquired?: string;
    cloud_cover?: number;
    clear_percent?: number;
    clear_confidence_percent?: number;
    cloud_percent?: number;
    light_haze_percent?: number;
    shadow_percent?: number;
    snow_ice_percent?: number;
    visible_percent?: number;
    visible_confidence_percent?: number;
  };
};

type PlanetOrder = {
  id?: string;
  state?: string;
  results?: PlanetOrderResult[];
  last_message?: string;
  error_hints?: string[];
};

type PlanetOrderResult = {
  name?: string;
  location?: string;
};

const PLANET_ORDERS_PRODUCT_BUNDLE = "analytic_sr_udm2,analytic_udm2";
const PLANET_ORDER_POLL_ATTEMPTS = 36;
const PLANET_ORDER_POLL_INTERVAL_MS = 5000;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function toStartDate(requestedAt: string) {
  const value = new Date(requestedAt);
  value.setUTCDate(value.getUTCDate() - 30);
  return value.toISOString();
}

function toPlanetBoundary(boundary: RasterMultiPolygon) {
  if (boundary.coordinates.length === 1) {
    return {
      type: "Polygon" as const,
      coordinates: boundary.coordinates[0],
    };
  }

  return boundary;
}

function toCloudCoverPct(value: number | undefined) {
  if (typeof value !== "number") {
    return null;
  }

  return value <= 1 ? Number((value * 100).toFixed(2)) : value;
}

function toSceneQualityPct(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value <= 1 ? Number((value * 100).toFixed(2)) : Number(value.toFixed(2));
}

function dataApiAuth(apiKey: string) {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

function ordersApiAuth(apiKey: string) {
  return `api-key ${apiKey}`;
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function toPlanetOrderName(fieldId: string, sceneKey: string) {
  const compactSceneKey = sceneKey.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 48);
  return `fieldpulse-${fieldId}-planet-${compactSceneKey}`;
}

function isProviderBackedPlanetSceneKey(sceneKey: string) {
  return /^\d{8}_\d{6}_[A-Za-z0-9]+_[A-Za-z0-9]+$/.test(sceneKey);
}

function normalizeReflectance(value: number) {
  if (!Number.isFinite(value)) {
    return null;
  }

  const normalized = value > 1 ? value / 10000 : value;
  return clamp(normalized, 0, 1);
}

function buildPlanetMeasurements(bands: readonly number[]) {
  if (bands.length < 4) {
    return null;
  }

  const blue = normalizeReflectance(bands[0]);
  const green = normalizeReflectance(bands[1]);
  const red = normalizeReflectance(bands[2]);
  const nir = normalizeReflectance(bands[3]);

  if (blue === null || green === null || red === null || nir === null) {
    return null;
  }

  const rawNdviDenominator = nir + red;
  const rawNdvi =
    rawNdviDenominator === 0 ? 0 : (nir - red) / rawNdviDenominator;
  const ndvi = clamp((rawNdvi + 1) / 2, 0, 1);
  const brightness = clamp((blue + green + red) / 3, 0, 1);
  const shadow = clamp((0.35 - brightness) / 0.35, 0, 1);
  const thermal = clamp((1 - ndvi) * 0.6 + brightness * 0.4, 0, 1);

  return {
    ndvi: Number(ndvi.toFixed(4)),
    thermal: Number(thermal.toFixed(4)),
    shadow: Number(shadow.toFixed(4)),
  };
}

async function createPlanetOrder({
  apiKey,
  ordersBaseUrl,
  fieldId,
  sceneKey,
}: {
  apiKey: string;
  ordersBaseUrl: string;
  fieldId: string;
  sceneKey: string;
}) {
  const response = await fetch(ordersBaseUrl, {
    method: "POST",
    headers: {
      authorization: ordersApiAuth(apiKey),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: toPlanetOrderName(fieldId, sceneKey),
      source_type: "scenes",
      order_type: "partial",
      products: [
        {
          item_ids: [sceneKey],
          item_type: "PSScene",
          product_bundle: PLANET_ORDERS_PRODUCT_BUNDLE,
        },
      ],
      tools: [
        {
          reproject: {
            projection: "EPSG:4326",
            kernel: "near",
          },
        },
        {
          file_format: {
            format: "COG",
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `[imagery] planet order creation failed with ${await readPlanetErrorMessage(
        response,
      )}`,
    );
  }

  const payload = (await response.json()) as PlanetOrder;

  if (!payload.id) {
    throw new Error("[imagery] planet order response missing order id");
  }

  return payload.id;
}

async function fetchPlanetOrder({
  apiKey,
  ordersBaseUrl,
  orderId,
}: {
  apiKey: string;
  ordersBaseUrl: string;
  orderId: string;
}) {
  const response = await fetch(`${ordersBaseUrl}/${orderId}`, {
    headers: {
      authorization: ordersApiAuth(apiKey),
      "content-type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`[imagery] planet order lookup failed with ${response.status}`);
  }

  return (await response.json()) as PlanetOrder;
}

async function waitForPlanetOrderSuccess({
  apiKey,
  ordersBaseUrl,
  orderId,
}: {
  apiKey: string;
  ordersBaseUrl: string;
  orderId: string;
}) {
  for (let attempt = 0; attempt < PLANET_ORDER_POLL_ATTEMPTS; attempt += 1) {
    const order = await fetchPlanetOrder({
      apiKey,
      ordersBaseUrl,
      orderId,
    });

    if (order.state === "success") {
      return order;
    }

    if (order.state === "failed" || order.state === "partial") {
      const reason =
        order.error_hints?.join("; ") ??
        order.last_message ??
        `Planet order ended in ${order.state}.`;
      throw new Error(`[imagery] ${reason}`);
    }

    await sleep(PLANET_ORDER_POLL_INTERVAL_MS);
  }

  throw new Error("[imagery] planet order polling timed out");
}

function pickPlanetRasterResult(results: readonly PlanetOrderResult[] | undefined) {
  const rasterResults = (results ?? []).filter((result) => {
    return (
      typeof result.location === "string" &&
      typeof result.name === "string" &&
      /\.tif$/i.test(result.name) &&
      !/udm/i.test(result.name)
    );
  });

  return rasterResults[0] ?? null;
}

function pickPlanetUdm2Result(results: readonly PlanetOrderResult[] | undefined) {
  const udmResults = (results ?? []).filter((result) => {
    return (
      typeof result.location === "string" &&
      typeof result.name === "string" &&
      /\.tif$/i.test(result.name) &&
      /udm/i.test(result.name)
    );
  });

  return udmResults[0] ?? null;
}

function buildPlanetUdm2Measurements(bands: readonly number[]) {
  if (bands.length < 7) {
    return null;
  }

  const clear = clamp(bands[0] ?? 0, 0, 1);
  const snowIce = clamp(bands[1] ?? 0, 0, 1);
  const shadow = clamp(bands[2] ?? 0, 0, 1);
  const haze = clamp(bands[3] ?? 0, 0, 1);
  const cloud = clamp(bands[5] ?? 0, 0, 1);
  const confidence = clamp((bands[6] ?? 0) / 100, 0, 1);
  const unusable = clamp((bands[7] ?? 0) > 0 ? 1 : 0, 0, 1);
  const visible = clamp(clear + snowIce + shadow + haze > 0 ? 1 : 0, 0, 1);

  return {
    udm2Clear: Number(clear.toFixed(4)),
    udm2SnowIce: Number(snowIce.toFixed(4)),
    udm2Shadow: Number(shadow.toFixed(4)),
    udm2Haze: Number(haze.toFixed(4)),
    udm2Cloud: Number(cloud.toFixed(4)),
    udm2Visible: Number(visible.toFixed(4)),
    udm2Confidence: Number(confidence.toFixed(4)),
    udm2Unusable: Number(unusable.toFixed(4)),
  };
}

function summarizePlanetFieldQuality(
  observation: RasterFieldGridObservation | null,
  totalCellCount: number,
) {
  if (!observation || observation.cells.length === 0) {
    return null;
  }

  const sampledCellCount = observation.cells.length;
  let clearCount = 0;
  let cloudCount = 0;
  let snowIceCount = 0;
  let hazeCount = 0;
  let shadowCount = 0;
  let visibleCount = 0;
  let unusableCount = 0;
  let confidenceSum = 0;
  let confidenceCount = 0;

  for (const cell of observation.cells) {
    if ((cell.measurements.udm2Clear ?? 0) >= 0.5) {
      clearCount += 1;
    }
    if ((cell.measurements.udm2Cloud ?? 0) >= 0.5) {
      cloudCount += 1;
    }
    if ((cell.measurements.udm2SnowIce ?? 0) >= 0.5) {
      snowIceCount += 1;
    }
    if ((cell.measurements.udm2Haze ?? 0) >= 0.5) {
      hazeCount += 1;
    }
    if ((cell.measurements.udm2Shadow ?? 0) >= 0.5) {
      shadowCount += 1;
    }
    if ((cell.measurements.udm2Visible ?? 0) >= 0.5) {
      visibleCount += 1;
    }
    if ((cell.measurements.udm2Unusable ?? 0) >= 0.5) {
      unusableCount += 1;
    }

    const confidence = cell.measurements.udm2Confidence;
    if (typeof confidence === "number" && Number.isFinite(confidence)) {
      confidenceSum += confidence;
      confidenceCount += 1;
    }
  }

  const denominator = Math.max(sampledCellCount, 1);
  const toPct = (count: number) => Number(((count / denominator) * 100).toFixed(2));

  return {
    planetFieldQualitySource: "planet-udm2-centroid-v1",
    planetFieldTotalCellCount: totalCellCount,
    planetFieldSampledCellCount: sampledCellCount,
    planetFieldSampleCoveragePct: Number(
      ((sampledCellCount / Math.max(totalCellCount, 1)) * 100).toFixed(2),
    ),
    planetFieldClearPct: toPct(clearCount),
    planetFieldCloudPct: toPct(cloudCount),
    planetFieldSnowIcePct: toPct(snowIceCount),
    planetFieldHazePct: toPct(hazeCount),
    planetFieldShadowPct: toPct(shadowCount),
    planetFieldVisiblePct: toPct(visibleCount),
    planetFieldUnusablePct: toPct(unusableCount),
    planetFieldConfidencePct:
      confidenceCount > 0
        ? Number(((confidenceSum / confidenceCount) * 100).toFixed(2))
        : null,
  } as const;
}

async function materializePlanetObservation({
  input,
  gridCells,
  apiKey,
  ordersBaseUrl,
}: {
  input: MaterializeImagerySceneInput;
  gridCells: RasterFieldGridObservation["cells"];
  apiKey: string;
  ordersBaseUrl: string;
}) {
  const orderId = await createPlanetOrder({
    apiKey,
    ordersBaseUrl,
    fieldId: input.fieldId,
    sceneKey: input.scene.sceneKey,
  });
  const order = await waitForPlanetOrderSuccess({
    apiKey,
    ordersBaseUrl,
    orderId,
  });
  const rasterResult = pickPlanetRasterResult(order.results);
  const udm2Result = pickPlanetUdm2Result(order.results);

  if (!rasterResult?.location || !rasterResult.name) {
    throw new Error("[imagery] planet order completed without a raster download");
  }

  const observation = await sampleGeoTiffFieldGridObservation({
    url: rasterResult.location,
    sourceKey: "planet-orders-cog-v1:planet",
    cells: gridCells,
    mapBandsToMeasurements: buildPlanetMeasurements,
  });

  if (!observation) {
    return null;
  }

  const udm2Observation =
    udm2Result?.location && udm2Result.name
      ? await sampleGeoTiffFieldGridObservation({
          url: udm2Result.location,
          sourceKey: "planet-orders-udm2-v1:planet",
          cells: gridCells,
          mapBandsToMeasurements: buildPlanetUdm2Measurements,
        })
      : null;
  const fieldQuality = summarizePlanetFieldQuality(udm2Observation, gridCells.length);

  return {
    observation,
    artifactKey: rasterResult.name,
    metadata: {
      materializationMode: "provider",
      materializationClient: "planet-orders-geotiff-sampler",
      materializationProvider: "planet",
      materializationFallbackReason: null,
      materializationOrderId: orderId,
      materializationOrderState: order.state ?? "success",
      materializationArtifactName: rasterResult.name,
      ...(udm2Result?.name
        ? {
            materializationQualityArtifactName: udm2Result.name,
            materializationQualityProfile: "planet-udm2-centroid-v1",
          }
        : {}),
      materializationClipMode: "none",
      materializationMeasurementProfile: "planet-4band-centroid-v1",
      ...(fieldQuality ?? {}),
    },
    note:
      fieldQuality === null
        ? "Planet Orders materialized field cell measurements from a COG order result."
        : "Planet Orders materialized field cell measurements and AOI-specific UDM2 quality from order results.",
  } as const;
}

export function createPlanetImageryProviderClient({
  apiKey,
  baseUrl = "https://api.planet.com/data/v1",
  ordersBaseUrl = "https://api.planet.com/compute/ops/orders/v2",
}: CreatePlanetImageryProviderClientOptions): ImageryProviderClient {
  const rasterGridProvider = createSyntheticRasterFieldObservationProvider({
    providers: ["planet"],
    sourceKey: "planet-raster-grid-v1",
  });

  return {
    provider: "planet",
    async healthcheck() {
      const response = await fetch(`${baseUrl}/item-types`, {
        headers: {
          authorization: dataApiAuth(apiKey),
        },
      });

      return response.ok;
    },
    async diagnose() {
      const response = await fetch(`${baseUrl}/item-types`, {
        headers: {
          authorization: dataApiAuth(apiKey),
        },
      });

      if (!response.ok) {
        return {
          provider: "planet",
          status: "unavailable",
          discoveryMode: "provider",
          materializationMode: "provider",
          discoveryClient: "planet-quick-search",
          materializationClient: "planet-orders-geotiff-sampler",
          fallbackClient: "synthetic-imagery-provider",
          reason: `[imagery] planet healthcheck failed with ${response.status}`,
          details: {
            httpStatus: response.status,
            providerConfigured: true,
            ordersProductBundle: null,
          },
        };
      }

      return {
        provider: "planet",
        status: "ready",
        discoveryMode: "provider",
        materializationMode: "provider",
        discoveryClient: "planet-quick-search",
        materializationClient: "planet-orders-geotiff-sampler",
        fallbackClient: "synthetic-imagery-provider",
        reason: null,
        details: {
          httpStatus: response.status,
          providerConfigured: true,
          ordersProductBundle: PLANET_ORDERS_PRODUCT_BUNDLE,
        },
      };
    },
    async discoverLatestScene(input: DiscoverLatestImagerySceneInput) {
      const response = await fetch(
        `${baseUrl}/quick-search?_sort=acquired%20desc&_page_size=5`,
        {
          method: "POST",
          headers: {
            authorization: dataApiAuth(apiKey),
            "content-type": "application/json",
          },
          body: JSON.stringify({
            item_types: ["PSScene"],
            filter: {
              type: "AndFilter",
              config: [
                {
                  type: "GeometryFilter",
                  field_name: "geometry",
                  config: toPlanetBoundary(input.boundary),
                },
                {
                  type: "DateRangeFilter",
                  field_name: "acquired",
                  config: {
                    gte: toStartDate(input.requestedAt),
                    lte: input.requestedAt,
                  },
                },
                {
                  type: "AssetFilter",
                  config: ["ortho_analytic_4b_sr", "ortho_analytic_4b"],
                },
              ],
            },
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`[imagery] planet quick-search failed with ${response.status}`);
      }

      const payload = (await response.json()) as {
        features?: PlanetFeature[];
      };
      const feature = payload.features?.[0];

      if (!feature?.id || !feature.properties?.acquired) {
        return null;
      }

      const scene = {
        provider: "planet",
        sceneKey: feature.id,
        capturedAt: feature.properties.acquired,
        coveragePct: 100,
        cloudCoverPct: toCloudCoverPct(
          feature.properties.cloud_percent ?? feature.properties.cloud_cover,
        ),
        note: "Planet scene discovered.",
      } satisfies ImageryScene;

      const clearPct = toSceneQualityPct(feature.properties.clear_percent);
      const clearConfidencePct = toSceneQualityPct(
        feature.properties.clear_confidence_percent,
      );
      const cloudPct = toSceneQualityPct(feature.properties.cloud_percent);
      const hazePct = toSceneQualityPct(feature.properties.light_haze_percent);
      const shadowPct = toSceneQualityPct(feature.properties.shadow_percent);
      const snowIcePct = toSceneQualityPct(feature.properties.snow_ice_percent);
      const visiblePct = toSceneQualityPct(feature.properties.visible_percent);
      const visibleConfidencePct = toSceneQualityPct(
        feature.properties.visible_confidence_percent,
      );

      return {
        scene,
        metadata: {
          discoveryMode: "provider",
          discoveryClient: "planet-quick-search",
          discoveryProvider: "planet",
          discoveryFallbackReason: null,
          ...(clearPct === null ? {} : { planetClearPct: clearPct }),
          ...(clearConfidencePct === null
            ? {}
            : { planetClearConfidencePct: clearConfidencePct }),
          ...(cloudPct === null ? {} : { planetCloudPct: cloudPct }),
          ...(hazePct === null ? {} : { planetHazePct: hazePct }),
          ...(shadowPct === null ? {} : { planetShadowPct: shadowPct }),
          ...(snowIcePct === null ? {} : { planetSnowIcePct: snowIcePct }),
          ...(visiblePct === null ? {} : { planetVisiblePct: visiblePct }),
          ...(visibleConfidencePct === null
            ? {}
            : { planetVisibleConfidencePct: visibleConfidencePct }),
          ...(cloudPct === null ? {} : { sceneCloudProbabilityPct: cloudPct }),
          ...(snowIcePct === null ? {} : { sceneSnowProbabilityPct: snowIcePct }),
        },
        note: scene.note,
      };
    },
    async materializeFieldObservation(input: MaterializeImagerySceneInput) {
      if (!isProviderBackedPlanetSceneKey(input.scene.sceneKey)) {
        throw new Error(
          "[imagery] planet materialization requires a provider-backed scene id; synthetic fallback discovery was used instead.",
        );
      }

      const baseGrid = await rasterGridProvider.observeFieldRaster({
        workspaceId: input.workspaceId,
        fieldId: input.fieldId,
        boundary: input.boundary,
        observedAt: input.scene.capturedAt,
      });

      if (!baseGrid || baseGrid.cells.length === 0) {
        return null;
      }

      return materializePlanetObservation({
        input,
        gridCells: baseGrid.cells,
        apiKey,
        ordersBaseUrl,
      });
    },
  };
}
async function readPlanetErrorMessage(response: Response) {
  const payload = await response.text();

  if (!payload) {
    return `${response.status}`;
  }

  return `${response.status}: ${payload}`;
}
