import test from "node:test";
import assert from "node:assert/strict";
import { syncLatestImagery } from "./syncLatestImagery";
import type { ImageryProvider } from "../contracts/ImageryProvider";
import type { ImageryCaptureRepository } from "../contracts/ImageryCaptureRepository";
import type { FieldRasterObservationRepository } from "../contracts/FieldRasterObservationRepository";
import type {
  DiscoveredImagerySceneResult,
  ImageryProviderClient,
  MaterializedFieldObservationResult,
} from "../contracts/ImageryProviderClient";
import type { ImageryCapture, UpsertImageryCaptureInput } from "../contracts/ImageryCapture";
import type {
  FieldRasterObservation,
  ReplaceFieldRasterObservationInput,
} from "../contracts/FieldRasterObservation";
import type { RasterFieldGridCell, RasterMultiPolygon } from "@fieldpulse/raster";

const WORKSPACE_ID = "workspace-1";
const FIELD_ID = "field-1";
const REQUESTED_AT = "2026-03-28T12:00:00.000Z";

const BASE_BOUNDARY: RasterMultiPolygon = {
  type: "MultiPolygon",
  coordinates: [[[
    [-109.6, 51.3],
    [-109.4, 51.3],
    [-109.4, 51.1],
    [-109.6, 51.1],
    [-109.6, 51.3],
  ]]],
};

function createCell(cellKey: string): RasterFieldGridCell {
  return {
    cellKey,
    rowIndex: 0,
    columnIndex: 0,
    centroid: [-109.5, 51.2],
    boundary: {
      type: "Polygon",
      coordinates: [[
        [-109.55, 51.25],
        [-109.45, 51.25],
        [-109.45, 51.15],
        [-109.55, 51.15],
        [-109.55, 51.25],
      ]],
    },
    measurements: { ndvi: 0.62, ndmi: 0.31 },
  };
}

function createDiscoveredScene(
  provider: ImageryProvider,
  overrides: Partial<DiscoveredImagerySceneResult> & {
    capturedAt?: string;
    cloudCoverPct?: number | null;
    sceneKey?: string;
    coveragePct?: number;
  } = {},
): DiscoveredImagerySceneResult {
  return {
    scene: {
      provider,
      sceneKey: overrides.sceneKey ?? `${provider}-scene`,
      capturedAt: overrides.capturedAt ?? REQUESTED_AT,
      coveragePct: overrides.coveragePct ?? 100,
      cloudCoverPct: overrides.cloudCoverPct ?? null,
      note: undefined,
    },
    metadata: overrides.metadata,
    note: overrides.note ?? null,
  };
}

function createMaterializedObservation(
  provider: ImageryProvider,
  overrides: Partial<MaterializedFieldObservationResult> & {
    sourceKey?: string;
    cells?: readonly RasterFieldGridCell[];
  } = {},
): MaterializedFieldObservationResult {
  return {
    observation: {
      sourceKey: overrides.sourceKey ?? `provider-observation-v1:${provider}`,
      cells: overrides.cells ?? [createCell(`${provider}-cell`)],
    },
    artifactKey: overrides.artifactKey ?? null,
    metadata: overrides.metadata,
    note: overrides.note ?? null,
  };
}

class InMemoryCaptureRepository implements ImageryCaptureRepository {
  readonly captures: ImageryCapture[] = [];

  async getLatestByField(): Promise<ImageryCapture | null> {
    return this.captures.at(-1) ?? null;
  }

  async listRecent(): Promise<readonly ImageryCapture[]> {
    return this.captures;
  }

  async upsertCapture(input: UpsertImageryCaptureInput): Promise<ImageryCapture> {
    const capture: ImageryCapture = {
      id: `capture-${this.captures.length + 1}`,
      workspaceId: input.workspaceId,
      fieldId: input.fieldId,
      requestedAt: input.requestedAt,
      capturedAt: input.capturedAt,
      providerKey: input.providerKey,
      sceneKey: input.sceneKey,
      status: input.status,
      coveragePct: input.coveragePct,
      cloudCoverPct: input.cloudCoverPct ?? null,
      note: input.note ?? null,
      metadata: input.metadata ?? {},
      observationId: input.observationId ?? null,
      createdAt: input.requestedAt,
    };

    this.captures.push(capture);
    return capture;
  }
}

class InMemoryObservationRepository implements FieldRasterObservationRepository {
  readonly observations: FieldRasterObservation[] = [];

  constructor(
    private readonly latestByProvider: Partial<Record<ImageryProvider, FieldRasterObservation>> = {},
  ) {}

  async getLatestByField(): Promise<FieldRasterObservation | null> {
    return this.observations.at(-1) ?? null;
  }

  async getLatestByFieldAndProvider(
    _workspaceId: string,
    _fieldId: string,
    providerKey: string,
  ): Promise<FieldRasterObservation | null> {
    return this.latestByProvider[providerKey as ImageryProvider] ?? null;
  }

  async replaceObservation(
    input: ReplaceFieldRasterObservationInput,
  ): Promise<FieldRasterObservation> {
    const observation: FieldRasterObservation = {
      id: `observation-${this.observations.length + 1}`,
      workspaceId: input.workspaceId,
      fieldId: input.fieldId,
      observedAt: input.observedAt,
      sourceKey: input.sourceKey,
      providerKey: input.providerKey,
      artifactKey: input.artifactKey ?? null,
      metadata: input.metadata ?? {},
      cells: input.cells,
      createdAt: input.observedAt,
    };

    this.observations.push(observation);
    return observation;
  }
}

function createProviderClient(
  provider: ImageryProvider,
  {
    discovered,
    materialized,
    materializeCalls,
  }: {
    discovered: DiscoveredImagerySceneResult | null;
    materialized: MaterializedFieldObservationResult | null;
    materializeCalls: ImageryProvider[];
  },
): ImageryProviderClient {
  return {
    provider,
    async healthcheck() {
      return true;
    },
    async diagnose() {
      return {
        provider,
        status: "ready",
        discoveryMode: "provider",
        materializationMode: "provider",
        discoveryClient: "test-discovery",
        materializationClient: "test-materializer",
        fallbackClient: null,
        reason: null,
        details: {},
      };
    },
    async discoverLatestScene() {
      return discovered;
    },
    async materializeFieldObservation() {
      materializeCalls.push(provider);
      return materialized;
    },
  };
}

async function runSync({
  requestedAt = REQUESTED_AT,
  boundary = BASE_BOUNDARY,
  providerClients,
  observationRepository = new InMemoryObservationRepository(),
}: {
  requestedAt?: string;
  boundary?: RasterMultiPolygon;
  providerClients: readonly ImageryProviderClient[];
  observationRepository?: InMemoryObservationRepository;
}) {
  const captureRepository = new InMemoryCaptureRepository();
  const result = await syncLatestImagery(
    {
      captureRepository,
      observationRepository,
      providerClients,
    },
    {
      workspaceId: WORKSPACE_ID,
      fieldId: FIELD_ID,
      boundary,
      requestedAt,
      providers: ["sentinel-2", "planet", "sentinel-1"],
      dryRun: false,
    },
  );

  return { result, captureRepository, observationRepository };
}

test("syncLatestImagery prefers provider-backed scenes over synthetic fallback candidates", async () => {
  const materializeCalls: ImageryProvider[] = [];
  const { result, captureRepository } = await runSync({
    providerClients: [
      createProviderClient("sentinel-2", {
        discovered: createDiscoveredScene("sentinel-2", {
          capturedAt: "2026-03-27T12:00:00.000Z",
          cloudCoverPct: 0,
          metadata: {
            discoveryMode: "synthetic",
            discoveryClient: "synthetic-raster-grid",
          },
        }),
        materialized: createMaterializedObservation("sentinel-2"),
        materializeCalls,
      }),
      createProviderClient("planet", {
        discovered: createDiscoveredScene("planet", {
          capturedAt: "2026-03-23T12:00:00.000Z",
          cloudCoverPct: 20,
          metadata: {
            discoveryMode: "provider",
            discoveryClient: "planet-data-api",
          },
        }),
        materialized: createMaterializedObservation("planet"),
        materializeCalls,
      }),
      createProviderClient("sentinel-1", {
        discovered: null,
        materialized: null,
        materializeCalls,
      }),
    ],
  });

  assert.equal(result.status, "materialized");
  assert.equal(result.capture?.providerKey, "planet");
  assert.deepEqual(materializeCalls, ["planet"]);
  assert.equal(captureRepository.captures.length, 1);
  assert.equal(captureRepository.captures[0]?.metadata.selectionStrategy, "cross-provider-scoring-v1");
  assert.equal(captureRepository.captures[0]?.metadata.discoveryMode, "provider");
});

test("syncLatestImagery prefers sentinel-1 during winter when Sentinel-2 is snow-covered", async () => {
  const materializeCalls: ImageryProvider[] = [];
  const { result, captureRepository } = await runSync({
    requestedAt: "2026-01-20T12:00:00.000Z",
    providerClients: [
      createProviderClient("sentinel-2", {
        discovered: createDiscoveredScene("sentinel-2", {
          capturedAt: "2026-01-18T12:00:00.000Z",
          cloudCoverPct: 4,
          metadata: {
            discoveryMode: "provider",
            discoveryClient: "sentinel-hub-catalog",
            sceneSnowProbabilityPct: 80,
            sceneCloudProbabilityPct: 10,
            sceneNdsi: 0.56,
          },
        }),
        materialized: createMaterializedObservation("sentinel-2"),
        materializeCalls,
      }),
      createProviderClient("planet", {
        discovered: createDiscoveredScene("planet", {
          capturedAt: "2026-01-19T12:00:00.000Z",
          cloudCoverPct: 42,
          metadata: {
            discoveryMode: "provider",
            discoveryClient: "planet-data-api",
          },
        }),
        materialized: createMaterializedObservation("planet"),
        materializeCalls,
      }),
      createProviderClient("sentinel-1", {
        discovered: createDiscoveredScene("sentinel-1", {
          capturedAt: "2026-01-12T12:00:00.000Z",
          metadata: {
            discoveryMode: "provider",
            discoveryClient: "sentinel-hub-catalog",
          },
        }),
        materialized: createMaterializedObservation("sentinel-1", {
          sourceKey: "sentinel-hub-stats-v1:sentinel-1",
        }),
        materializeCalls,
      }),
    ],
  });

  assert.equal(result.status, "materialized");
  assert.equal(result.capture?.providerKey, "sentinel-1");
  assert.deepEqual(materializeCalls, ["sentinel-1"]);
  assert.equal(captureRepository.captures[0]?.metadata.selectionWinterWindow, true);
  assert.equal(captureRepository.captures[0]?.metadata.discoveryMode, "provider");
});

test("syncLatestImagery rejects poor Planet AOI quality when sentinel-1 is available", async () => {
  const materializeCalls: ImageryProvider[] = [];
  const { result, captureRepository, observationRepository } = await runSync({
    providerClients: [
      createProviderClient("sentinel-2", {
        discovered: null,
        materialized: null,
        materializeCalls,
      }),
      createProviderClient("planet", {
        discovered: createDiscoveredScene("planet", {
          capturedAt: "2026-03-27T12:00:00.000Z",
          cloudCoverPct: 2,
          metadata: {
            discoveryMode: "provider",
            discoveryClient: "planet-data-api",
            planetClearPct: 92,
            planetCloudPct: 2,
            planetVisiblePct: 95,
          },
        }),
        materialized: createMaterializedObservation("planet", {
          sourceKey: "planet-order-v1:planet",
          metadata: {
            materializationMode: "provider",
            planetFieldSampledCellCount: 36,
            planetFieldSampleCoveragePct: 100,
            planetFieldCloudPct: 61,
            planetFieldVisiblePct: 39,
          },
        }),
        materializeCalls,
      }),
      createProviderClient("sentinel-1", {
        discovered: createDiscoveredScene("sentinel-1", {
          capturedAt: "2026-03-22T12:00:00.000Z",
          metadata: {
            discoveryMode: "provider",
            discoveryClient: "sentinel-hub-catalog",
          },
        }),
        materialized: createMaterializedObservation("sentinel-1", {
          sourceKey: "sentinel-hub-stats-v1:sentinel-1",
        }),
        materializeCalls,
      }),
    ],
  });

  assert.equal(result.status, "materialized");
  assert.equal(result.capture?.providerKey, "sentinel-1");
  assert.deepEqual(materializeCalls, ["planet", "sentinel-1"]);
  assert.equal(captureRepository.captures.length, 1);
  assert.equal(observationRepository.observations.length, 1);
  assert.equal(observationRepository.observations[0]?.providerKey, "sentinel-1");
});

test("syncLatestImagery reuses cached Planet AOI quality for scoring when the scene matches", async () => {
  const materializeCalls: ImageryProvider[] = [];
  const cachedPlanetObservation: FieldRasterObservation = {
    id: "cached-planet-observation",
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    observedAt: "2026-01-17T12:00:00.000Z",
    sourceKey: "planet-order-v1:planet",
    providerKey: "planet",
    artifactKey: "planet-quality-artifact",
    metadata: {
      sceneKey: "planet-cached-scene",
      planetFieldQualitySource: "udm2",
      planetFieldSampledCellCount: 36,
      planetFieldSampleCoveragePct: 100,
      planetFieldClearPct: 94,
      planetFieldCloudPct: 4,
      planetFieldSnowIcePct: 0,
      planetFieldVisiblePct: 96,
      planetFieldConfidencePct: 91,
      materializationQualityArtifactName: "udm2.tif",
      materializationQualityProfile: "aoi-v1",
    },
    cells: [createCell("cached-planet-cell")],
    createdAt: "2026-01-17T12:00:00.000Z",
  };

  const observationRepository = new InMemoryObservationRepository({
    planet: cachedPlanetObservation,
  });

  const { result, captureRepository } = await runSync({
    requestedAt: "2026-01-20T12:00:00.000Z",
    observationRepository,
    providerClients: [
      createProviderClient("sentinel-2", {
        discovered: null,
        materialized: null,
        materializeCalls,
      }),
      createProviderClient("planet", {
        discovered: createDiscoveredScene("planet", {
          sceneKey: "planet-cached-scene",
          capturedAt: "2026-01-19T12:00:00.000Z",
          cloudCoverPct: null,
          metadata: {
            discoveryMode: "provider",
            discoveryClient: "planet-data-api",
          },
        }),
        materialized: createMaterializedObservation("planet", {
          sourceKey: "planet-order-v1:planet",
        }),
        materializeCalls,
      }),
      createProviderClient("sentinel-1", {
        discovered: createDiscoveredScene("sentinel-1", {
          capturedAt: "2026-01-18T12:00:00.000Z",
          metadata: {
            discoveryMode: "provider",
            discoveryClient: "sentinel-hub-catalog",
          },
        }),
        materialized: createMaterializedObservation("sentinel-1", {
          sourceKey: "sentinel-hub-stats-v1:sentinel-1",
        }),
        materializeCalls,
      }),
    ],
  });

  assert.equal(result.status, "materialized");
  assert.equal(result.capture?.providerKey, "planet");
  assert.deepEqual(materializeCalls, ["planet"]);
  assert.equal(
    captureRepository.captures[0]?.metadata.selectionPlanetFieldQualityCacheHit,
    true,
  );
  assert.equal(
    captureRepository.captures[0]?.metadata.selectionPlanetFieldClearPct,
    94,
  );
  assert.equal(
    captureRepository.captures[0]?.metadata.selectionPlanetFieldQualityCachedObservedAt,
    "2026-01-17T12:00:00.000Z",
  );
  assert.equal(
    captureRepository.captures[0]?.metadata.selectionPlanetFieldQualityCachedSourceKey,
    "planet-order-v1:planet",
  );
});

test("syncLatestImagery ignores cached Planet AOI quality when the scene key does not match", async () => {
  const materializeCalls: ImageryProvider[] = [];
  const cachedPlanetObservation: FieldRasterObservation = {
    id: "cached-planet-observation-mismatch",
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    observedAt: "2026-01-17T12:00:00.000Z",
    sourceKey: "planet-order-v1:planet",
    providerKey: "planet",
    artifactKey: "planet-quality-artifact",
    metadata: {
      sceneKey: "planet-old-scene",
      planetFieldQualitySource: "udm2",
      planetFieldSampledCellCount: 36,
      planetFieldSampleCoveragePct: 100,
      planetFieldClearPct: 96,
      planetFieldCloudPct: 2,
      planetFieldSnowIcePct: 0,
      planetFieldVisiblePct: 97,
      planetFieldConfidencePct: 90,
    },
    cells: [createCell("cached-planet-mismatch-cell")],
    createdAt: "2026-01-17T12:00:00.000Z",
  };

  const observationRepository = new InMemoryObservationRepository({
    planet: cachedPlanetObservation,
  });

  const { result, captureRepository } = await runSync({
    requestedAt: "2026-01-20T12:00:00.000Z",
    observationRepository,
    providerClients: [
      createProviderClient("sentinel-2", {
        discovered: null,
        materialized: null,
        materializeCalls,
      }),
      createProviderClient("planet", {
        discovered: createDiscoveredScene("planet", {
          sceneKey: "planet-new-scene",
          capturedAt: "2026-01-19T12:00:00.000Z",
          cloudCoverPct: null,
          metadata: {
            discoveryMode: "provider",
            discoveryClient: "planet-data-api",
          },
        }),
        materialized: createMaterializedObservation("planet", {
          sourceKey: "planet-order-v1:planet",
        }),
        materializeCalls,
      }),
      createProviderClient("sentinel-1", {
        discovered: createDiscoveredScene("sentinel-1", {
          capturedAt: "2026-01-18T12:00:00.000Z",
          metadata: {
            discoveryMode: "provider",
            discoveryClient: "sentinel-hub-catalog",
          },
        }),
        materialized: createMaterializedObservation("sentinel-1", {
          sourceKey: "sentinel-hub-stats-v1:sentinel-1",
        }),
        materializeCalls,
      }),
    ],
  });

  assert.equal(result.status, "materialized");
  assert.equal(result.capture?.providerKey, "sentinel-1");
  assert.deepEqual(materializeCalls, ["sentinel-1"]);
  assert.equal(
    captureRepository.captures[0]?.metadata.selectionPlanetFieldQualityCacheHit,
    undefined,
  );
  assert.equal(
    captureRepository.captures[0]?.metadata.selectionPlanetFieldQualityCachedObservedAt,
    undefined,
  );
});
