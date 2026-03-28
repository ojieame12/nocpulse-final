import type {
  FetchFieldHailEventsResult,
  HailProviderClient,
} from "../contracts/HailProviderClient";
import type { JsonValue } from "@fieldpulse/platform-db";
import { deriveBoundingBox, intersectsPolygonalGeoJson } from "../domain/polygonalGeoJson";
import {
  deriveHailEventType,
  deriveHailSeverity,
  looksLikeHailAlert,
  parseHailSizeMillimetres,
} from "../domain/parseHailSignal";

type GeoMetAlertFeature = {
  type: "Feature";
  properties?: {
    identifier?: string;
    area?: string;
    zone?: string;
    headline?: string;
    titre?: string;
    descrip_en?: string;
    descrip_fr?: string;
    effective?: string;
    expires?: string;
    alert_type?: string;
    status?: string;
    url?: string;
  };
  geometry?: JsonValue;
};

type GeoMetAlertCollection = {
  type: "FeatureCollection";
  features?: GeoMetAlertFeature[];
};

type CreateEnvironmentCanadaGeoMetHailProviderClientOptions = {
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
  sourceKey?: string;
};

const DEFAULT_BASE_URL = "https://geo.weather.gc.ca/geomet";
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_SOURCE_KEY = "environment-canada-geomet:alerts-v1";
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function sleep(durationMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function toIso(value: string | undefined, fallback?: string) {
  if (!value) {
    if (fallback) {
      return fallback;
    }

    throw new Error("[hail] provider returned no alert timestamp");
  }

  return new Date(value).toISOString();
}

function buildFeatureRequestUrl(
  baseUrl: string,
  boundary: Parameters<typeof deriveBoundingBox>[0],
  limit: number,
) {
  const [west, south, east, north] = deriveBoundingBox(boundary);
  const url = new URL(baseUrl);
  url.searchParams.set("service", "WFS");
  url.searchParams.set("version", "2.0.0");
  url.searchParams.set("request", "GetFeature");
  url.searchParams.set("typeNames", "ALERTS");
  url.searchParams.set("outputFormat", "application/json");
  url.searchParams.set("count", String(limit));
  url.searchParams.set("bbox", `${west},${south},${east},${north}`);
  return url;
}

async function fetchAlertCollection(
  url: URL,
  options: CreateEnvironmentCanadaGeoMetHailProviderClientOptions,
): Promise<GeoMetAlertCollection> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= (options.retries ?? DEFAULT_RETRIES); attempt += 1) {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => {
      controller.abort("Environment Canada GeoMet request timed out");
    }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const error = new Error(
          `[hail] GeoMet request failed with ${response.status}${
            body.trim() ? `: ${body.trim().slice(0, 160)}` : "."
          }`,
        ) as Error & { retryable?: boolean };
        error.retryable = RETRYABLE_STATUSES.has(response.status);
        throw error;
      }

      return (await response.json()) as GeoMetAlertCollection;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const retryable =
        (typeof error === "object" &&
          error !== null &&
          "retryable" in error &&
          (error as { retryable?: boolean }).retryable === true) ||
        lastError.name === "AbortError";

      if (!retryable || attempt === (options.retries ?? DEFAULT_RETRIES)) {
        break;
      }

      await sleep(150 * (attempt + 1));
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  }

  throw lastError ?? new Error("[hail] GeoMet request failed.");
}

function normalizeAlertFeatures(
  collection: GeoMetAlertCollection,
  input: Parameters<HailProviderClient["fetchFieldHailEvents"]>[0],
  options: CreateEnvironmentCanadaGeoMetHailProviderClientOptions,
): FetchFieldHailEventsResult {
  const requestedAt = input.requestedAt ?? new Date().toISOString();
  const sourceKey = options.sourceKey ?? DEFAULT_SOURCE_KEY;
  const features = collection.features ?? [];

  const events = features
    .filter((feature) => {
      const properties = feature.properties ?? {};
      if ((properties.status ?? "active").toLowerCase() !== "active") {
        return false;
      }

      const headline = properties.headline ?? properties.titre ?? "";
      const description = properties.descrip_en ?? properties.descrip_fr ?? "";

      if (!looksLikeHailAlert(headline, description)) {
        return false;
      }

      if (feature.geometry && !intersectsPolygonalGeoJson(input.boundary, feature.geometry)) {
        return false;
      }

      return true;
    })
    .map((feature) => {
      const properties = feature.properties ?? {};
      const headline = properties.headline ?? properties.titre ?? "Hail-related alert";
      const description = properties.descrip_en ?? properties.descrip_fr ?? "";
      const hailSizeMm = parseHailSizeMillimetres(headline, description);
      const sourceEventKey =
        properties.identifier ??
        properties.url ??
        `${sourceKey}:${headline}:${properties.effective ?? requestedAt}`;

      return {
        sourceEventKey,
        dedupeKey: `environment-canada-geomet:${sourceEventKey}`,
        eventType: deriveHailEventType(),
        severity: deriveHailSeverity(properties.alert_type ?? "warning", hailSizeMm),
        reportedAt: toIso(properties.effective, requestedAt),
        windowStart: properties.effective ? toIso(properties.effective) : null,
        windowEnd: properties.expires ? toIso(properties.expires) : null,
        headline,
        summary: description || properties.area || properties.zone || null,
        hailSizeMm,
        coverageGeoJson: feature.geometry ?? null,
        provenance: {
          provider: "environment-canada-geomet",
          sourceAlertType: properties.alert_type ?? null,
          sourceStatus: properties.status ?? null,
          area: properties.area ?? null,
          zone: properties.zone ?? null,
          capUrl: properties.url ?? null,
          identifier: properties.identifier ?? null,
        },
      };
    });

  return {
    providerKey: "environment-canada-geomet",
    sourceKey,
    requestedAt,
    events,
  };
}

export function createEnvironmentCanadaGeoMetHailProviderClient(
  options: CreateEnvironmentCanadaGeoMetHailProviderClientOptions = {},
): HailProviderClient {
  return {
    providerKey: "environment-canada-geomet",
    async fetchFieldHailEvents(input) {
      const requestUrl = buildFeatureRequestUrl(
        options.baseUrl ?? DEFAULT_BASE_URL,
        input.boundary,
        Math.max(1, input.limit ?? 50),
      );
      const collection = await fetchAlertCollection(requestUrl, options);
      return normalizeAlertFeatures(collection, input, options);
    },
  };
}
