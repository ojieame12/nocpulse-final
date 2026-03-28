import type { RasterMultiPolygon } from "@fieldpulse/raster";
import type { ImageryProvider } from "../contracts/ImageryProvider";
import type { ImageryScene } from "../contracts/ImageryScene";
import { createSyntheticRasterFieldObservationProvider } from "./createSyntheticRasterFieldObservationProvider";
import type {
  DiscoverLatestImagerySceneInput,
  ImageryProviderClient,
  MaterializeImagerySceneInput,
} from "./ImageryProviderClient";

type CreateSyntheticImageryProviderClientOptions = {
  provider: ImageryProvider;
  activationReason?: string;
};

function providerCaptureOffsetDays(provider: ImageryProvider): number {
  switch (provider) {
    case "planet":
      return 1;
    case "sentinel-1":
      return 2;
    case "sentinel-2":
    default:
      return 3;
  }
}

function toIsoWithOffset(timestamp: string, days: number): string {
  const value = new Date(timestamp);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString();
}

function deriveCoverage(boundary: RasterMultiPolygon, provider: ImageryProvider) {
  const polygonCount = boundary.coordinates.length;
  const base = provider === "planet" ? 99 : provider === "sentinel-2" ? 96 : 93;
  return Math.max(70, Math.min(100, base - polygonCount));
}

function deriveCloudCoverPct(provider: ImageryProvider) {
  switch (provider) {
    case "planet":
      return 8;
    case "sentinel-2":
      return 14;
    case "sentinel-1":
      return null;
  }
}

async function discoverSyntheticScene(
  provider: ImageryProvider,
  input: DiscoverLatestImagerySceneInput,
): Promise<ImageryScene> {
  return {
    provider,
    sceneKey: `${provider}:${input.fieldId}:${input.requestedAt.slice(0, 10)}`,
    capturedAt: toIsoWithOffset(
      input.requestedAt,
      providerCaptureOffsetDays(provider),
    ),
    coveragePct: deriveCoverage(input.boundary, provider),
    cloudCoverPct: deriveCloudCoverPct(provider),
    note: `Synthetic ${provider} scene selected for ${input.fieldId}.`,
  };
}

export function createSyntheticImageryProviderClient({
  provider,
  activationReason,
}: CreateSyntheticImageryProviderClientOptions): ImageryProviderClient {
  const rasterProvider = createSyntheticRasterFieldObservationProvider({
    providers: [provider],
    sourceKey: `synthetic-raster-grid-${provider}-v1`,
  });

  return {
    provider,
    async healthcheck() {
      return true;
    },
    async diagnose() {
      return {
        provider,
        status: "fallback",
        discoveryMode: "synthetic",
        materializationMode: "synthetic",
        discoveryClient: "synthetic-imagery-provider",
        materializationClient: "synthetic-imagery-provider",
        fallbackClient: null,
        reason:
          activationReason ?? `Synthetic ${provider} imagery provider is active.`,
        details: {
          provider,
          synthetic: true,
        },
      };
    },
    async discoverLatestScene(input) {
      const scene = await discoverSyntheticScene(provider, input);
      return {
        scene,
        metadata: {
          discoveryMode: "synthetic",
          discoveryClient: "synthetic-imagery-provider",
          discoveryProvider: provider,
          discoveryFallbackReason: null,
        },
        note: scene.note ?? `Synthetic ${provider} scene selected.`,
      };
    },
    async materializeFieldObservation(input: MaterializeImagerySceneInput) {
      const observation = await rasterProvider.observeFieldRaster({
        workspaceId: input.workspaceId,
        fieldId: input.fieldId,
        boundary: input.boundary,
        observedAt: input.scene.capturedAt,
      });

      if (!observation) {
        return null;
      }

      return {
        observation,
        metadata: {
          materializationMode: "synthetic",
          materializationClient: "synthetic-imagery-provider",
          materializationProvider: provider,
          materializationFallbackReason: null,
        },
        note: `Synthetic raster materialization used for ${provider}.`,
      };
    },
  };
}
