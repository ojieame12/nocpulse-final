import type {
  PerDepthSoilProperties,
  SoilPropertiesProvider,
} from "../contracts/SoilPropertiesProvider";
import type { SoilGridsClientOptions } from "./SoilGridsClient";
import { createSoilGridsClient } from "./SoilGridsClient";
import {
  createWcsSoilGridsProvider,
  type WcsSoilGridsProviderOptions,
} from "./createWcsSoilGridsProvider";

/* ------------------------------------------------------------------ */
/* Options                                                             */
/* ------------------------------------------------------------------ */

export type SoilPropertiesProviderFactoryOptions = {
  /** WCS base URL override. */
  wcsBaseUrl?: string;
  /** REST base URL override (hostname only, no protocol). */
  restBaseUrl?: string;
  /** When true, fall back to the REST API if WCS fails. Default: false. */
  enableRestFallback?: boolean;
  /** Custom fetch for both providers (testing). */
  fetch?: typeof globalThis.fetch;
  /** WCS-specific options passthrough. */
  wcsOptions?: Omit<WcsSoilGridsProviderOptions, "wcsBaseUrl" | "fetch">;
  /** REST-specific options passthrough. */
  restOptions?: Omit<SoilGridsClientOptions, "baseUrl" | "fetch">;
};

/* ------------------------------------------------------------------ */
/* Factory                                                             */
/* ------------------------------------------------------------------ */

/**
 * Creates a `SoilPropertiesProvider` that uses WCS (GeoTIFF) as the
 * primary data source, with an optional REST fallback.
 *
 * The REST fallback adapts the existing `SoilGridsClient` (which returns
 * `SoilProperties` with a single 0-30cm aggregate) into the
 * `PerDepthSoilProperties` shape by placing values under "0-30cm".
 */
export function createSoilPropertiesProvider(
  options: SoilPropertiesProviderFactoryOptions = {},
): SoilPropertiesProvider {
  const wcsProvider = createWcsSoilGridsProvider({
    wcsBaseUrl: options.wcsBaseUrl,
    fetch: options.fetch,
    ...options.wcsOptions,
  });

  const restClient = options.enableRestFallback
    ? createSoilGridsClient({
        baseUrl: options.restBaseUrl,
        fetch: options.fetch,
        ...options.restOptions,
      })
    : null;

  async function query(
    lat: number,
    lng: number,
  ): Promise<PerDepthSoilProperties | null> {
    // Primary: WCS
    const wcsResult = await wcsProvider.query(lat, lng);
    if (wcsResult) return wcsResult;

    // Fallback: REST (if enabled)
    if (!restClient) return null;

    const restResult = await restClient.query(lat, lng);
    if (!restResult) return null;

    // Adapt the flat REST response into PerDepthSoilProperties
    return {
      fc: { "0-30cm": restResult.fieldCapacityPct },
      wp: { "0-30cm": restResult.wiltingPointPct },
      aggregateFcPct: restResult.fieldCapacityPct,
      aggregateWpPct: restResult.wiltingPointPct,
      providerPath: "rest",
      samplingMethod: "mean",
      pixelCount: 1, // REST returns a single pre-aggregated value
    };
  }

  return { query };
}
