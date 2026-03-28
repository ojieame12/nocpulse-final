import type { ImageryProvider } from "../contracts/ImageryProvider";
import type { RasterMultiPolygon } from "@fieldpulse/raster";
import { DEFAULT_IMAGERY_PROVIDER_ORDER } from "../domain/policies/providerOrder";
import type { ImageryCaptureRepository } from "../contracts/ImageryCaptureRepository";
import type { ImageryProviderClient } from "../contracts/ImageryProviderClient";
import type { FieldRasterObservationRepository } from "../contracts/FieldRasterObservationRepository";
import type { SyncLatestImageryInput } from "../contracts/SyncLatestImageryInput";
import type { SyncLatestImageryResult } from "../contracts/SyncLatestImageryResult";
import type { DiscoveredImagerySceneResult } from "../contracts/ImageryProviderClient";
import type { FieldRasterObservationMetadata } from "../contracts/FieldRasterObservation";

export type SyncLatestImageryDependencies = {
  captureRepository: ImageryCaptureRepository;
  observationRepository: FieldRasterObservationRepository;
  providerClients: readonly ImageryProviderClient[];
};

export type SyncLatestImageryExecutionInput = SyncLatestImageryInput & {
  boundary: RasterMultiPolygon;
};

function selectProviderClients(
  clients: readonly ImageryProviderClient[],
  providers: readonly ImageryProvider[],
) {
  return providers
    .map((provider) => clients.find((client) => client.provider === provider) ?? null)
    .filter((client): client is ImageryProviderClient => client !== null);
}

type DiscoveredCandidate = {
  client: ImageryProviderClient;
  discovered: DiscoveredImagerySceneResult;
  selectionScore: number;
};

const PLANET_FIELD_QUALITY_METADATA_KEYS = [
  "planetFieldQualitySource",
  "planetFieldTotalCellCount",
  "planetFieldSampledCellCount",
  "planetFieldSampleCoveragePct",
  "planetFieldClearPct",
  "planetFieldCloudPct",
  "planetFieldSnowIcePct",
  "planetFieldHazePct",
  "planetFieldShadowPct",
  "planetFieldVisiblePct",
  "planetFieldUnusablePct",
  "planetFieldConfidencePct",
  "materializationQualityArtifactName",
  "materializationQualityProfile",
] as const;

function readDiscoveryMode(candidate: DiscoveredCandidate) {
  return typeof candidate.discovered.metadata?.discoveryMode === "string"
    ? candidate.discovered.metadata.discoveryMode
    : null;
}

function readNumberMetadata(
  candidate: DiscoveredCandidate,
  key: string,
): number | null {
  const value = candidate.discovered.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readSelectionScore(candidate: DiscoveredCandidate) {
  return Number(candidate.selectionScore.toFixed(2));
}

function readStringMetadata(
  metadata: Readonly<Record<string, string | number | boolean | null>> | undefined,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function mergeCachedPlanetFieldQuality(
  discovered: DiscoveredImagerySceneResult,
  observationMetadata: FieldRasterObservationMetadata | undefined,
  observationSourceKey: string | null,
  observationObservedAt: string | null,
): DiscoveredImagerySceneResult {
  if (!observationMetadata) {
    return discovered;
  }

  const observationSceneKey = readStringMetadata(observationMetadata, "sceneKey");
  if (!observationSceneKey || observationSceneKey !== discovered.scene.sceneKey) {
    return discovered;
  }

  const cachedEntries = PLANET_FIELD_QUALITY_METADATA_KEYS.flatMap((key) => {
    const value = observationMetadata[key];
    return value === undefined ? [] : [[key, value] as const];
  });

  if (cachedEntries.length === 0) {
    return discovered;
  }

  return {
    ...discovered,
    metadata: {
      ...(discovered.metadata ?? {}),
      ...Object.fromEntries(cachedEntries),
      planetFieldQualityCacheHit: true,
      ...(observationObservedAt === null
        ? {}
        : { planetFieldQualityCachedObservedAt: observationObservedAt }),
      ...(observationSourceKey === null
        ? {}
        : { planetFieldQualityCachedSourceKey: observationSourceKey }),
    },
  };
}

function deriveBoundaryLatitude(boundary: RasterMultiPolygon) {
  let latitudeSum = 0;
  let coordinateCount = 0;

  for (const polygon of boundary.coordinates) {
    for (const ring of polygon) {
      for (const coordinate of ring) {
        latitudeSum += coordinate[1];
        coordinateCount += 1;
      }
    }
  }

  return coordinateCount > 0 ? latitudeSum / coordinateCount : 0;
}

function isLikelyWinterWindow(latitude: number, requestedAt: string) {
  if (Math.abs(latitude) < 20) {
    return false;
  }

  const month = new Date(requestedAt).getUTCMonth();
  const northernWinterMonths = new Set([10, 11, 0, 1, 2]);
  const southernWinterMonths = new Set([4, 5, 6, 7, 8]);

  return latitude >= 0
    ? northernWinterMonths.has(month)
    : southernWinterMonths.has(month);
}

type SelectionContext = {
  boundaryLatitude: number;
  winterWindow: boolean;
  hasProviderBackedSentinel1Candidate: boolean;
};

function shouldRejectPlanetFieldQuality(
  metadata: Readonly<Record<string, string | number | boolean | null>> | undefined,
  hasProviderBackedSentinel1Candidate: boolean,
) {
  if (!hasProviderBackedSentinel1Candidate || !metadata) {
    return false;
  }

  const readNumber = (key: string) => {
    const value = metadata[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };

  const sampledCellCount = readNumber("planetFieldSampledCellCount");
  const cloudPct = readNumber("planetFieldCloudPct");
  const snowIcePct = readNumber("planetFieldSnowIcePct");
  const visiblePct = readNumber("planetFieldVisiblePct");
  const clearPct = readNumber("planetFieldClearPct");
  const sampleCoveragePct = readNumber("planetFieldSampleCoveragePct");

  if (sampledCellCount === null || sampledCellCount < 6) {
    return false;
  }

  if (sampleCoveragePct !== null && sampleCoveragePct < 50) {
    return false;
  }

  return (
    (cloudPct !== null && cloudPct >= 35) ||
    (snowIcePct !== null && snowIcePct >= 25) ||
    (visiblePct !== null && visiblePct < 55) ||
    (clearPct !== null && clearPct < 35)
  );
}

function scoreCandidate(
  client: ImageryProviderClient,
  discovered: DiscoveredImagerySceneResult,
  requestedAt: string,
  context: SelectionContext,
) {
  const discoveryMode =
    typeof discovered.metadata?.discoveryMode === "string"
      ? discovered.metadata.discoveryMode
      : null;
  const capturedAtMillis = Date.parse(discovered.scene.capturedAt);
  const requestedAtMillis = Date.parse(requestedAt);
  const ageDays = Number.isFinite(capturedAtMillis) && Number.isFinite(requestedAtMillis)
    ? Math.max(0, (requestedAtMillis - capturedAtMillis) / 86_400_000)
    : 30;
  let score = discoveryMode === "provider" ? 110 : 35;

  switch (client.provider) {
    case "sentinel-2":
      score += 18;
      break;
    case "planet":
      score += 14;
      break;
    case "sentinel-1":
      score += 6;
      break;
  }

  if (client.provider === "sentinel-1") {
    score += 8;
  } else if (typeof discovered.scene.cloudCoverPct === "number") {
    score -= discovered.scene.cloudCoverPct * 1.1;
    if (discovered.scene.cloudCoverPct <= 15) {
      score += 15;
    } else if (discovered.scene.cloudCoverPct <= 30) {
      score += 6;
    }
  }

  const sceneSnowProbabilityPct =
    typeof discovered.metadata?.sceneSnowProbabilityPct === "number"
      ? discovered.metadata.sceneSnowProbabilityPct
      : null;
  const sceneCloudProbabilityPct =
    typeof discovered.metadata?.sceneCloudProbabilityPct === "number"
      ? discovered.metadata.sceneCloudProbabilityPct
      : null;
  const sceneNdsi =
    typeof discovered.metadata?.sceneNdsi === "number"
      ? discovered.metadata.sceneNdsi
      : null;

  if (client.provider === "sentinel-2") {
    if (sceneCloudProbabilityPct !== null) {
      score -= sceneCloudProbabilityPct * 0.25;
    }
    if (sceneSnowProbabilityPct !== null) {
      score -= sceneSnowProbabilityPct * 0.7;
      if (sceneSnowProbabilityPct >= 35) {
        score -= 20;
      }
    }
    if (sceneNdsi !== null) {
      if (sceneNdsi >= 0.4) {
        score -= 18;
      } else if (sceneNdsi >= 0.2) {
        score -= 8;
      }
    }
  }

  const planetClearPct =
    typeof discovered.metadata?.planetClearPct === "number"
      ? discovered.metadata.planetClearPct
      : null;
  const planetFieldClearPct =
    typeof discovered.metadata?.planetFieldClearPct === "number"
      ? discovered.metadata.planetFieldClearPct
      : null;
  const planetClearConfidencePct =
    typeof discovered.metadata?.planetClearConfidencePct === "number"
      ? discovered.metadata.planetClearConfidencePct
      : null;
  const planetCloudPct =
    typeof discovered.metadata?.planetCloudPct === "number"
      ? discovered.metadata.planetCloudPct
      : null;
  const planetFieldCloudPct =
    typeof discovered.metadata?.planetFieldCloudPct === "number"
      ? discovered.metadata.planetFieldCloudPct
      : null;
  const planetHazePct =
    typeof discovered.metadata?.planetHazePct === "number"
      ? discovered.metadata.planetHazePct
      : null;
  const planetShadowPct =
    typeof discovered.metadata?.planetShadowPct === "number"
      ? discovered.metadata.planetShadowPct
      : null;
  const planetSnowIcePct =
    typeof discovered.metadata?.planetSnowIcePct === "number"
      ? discovered.metadata.planetSnowIcePct
      : null;
  const planetFieldSnowIcePct =
    typeof discovered.metadata?.planetFieldSnowIcePct === "number"
      ? discovered.metadata.planetFieldSnowIcePct
      : null;
  const planetVisiblePct =
    typeof discovered.metadata?.planetVisiblePct === "number"
      ? discovered.metadata.planetVisiblePct
      : null;
  const planetFieldVisiblePct =
    typeof discovered.metadata?.planetFieldVisiblePct === "number"
      ? discovered.metadata.planetFieldVisiblePct
      : null;
  const planetVisibleConfidencePct =
    typeof discovered.metadata?.planetVisibleConfidencePct === "number"
      ? discovered.metadata.planetVisibleConfidencePct
      : null;
  const planetFieldConfidencePct =
    typeof discovered.metadata?.planetFieldConfidencePct === "number"
      ? discovered.metadata.planetFieldConfidencePct
      : null;
  const effectivePlanetClearPct = planetClearPct ?? planetFieldClearPct;
  const effectivePlanetCloudPct = planetCloudPct ?? planetFieldCloudPct;
  const effectivePlanetSnowIcePct = planetSnowIcePct ?? planetFieldSnowIcePct;
  const effectivePlanetVisiblePct = planetVisiblePct ?? planetFieldVisiblePct;
  const effectivePlanetQualityConfidencePct =
    planetVisibleConfidencePct ??
    planetClearConfidencePct ??
    planetFieldConfidencePct;
  const hasPlanetQualitySignal =
    effectivePlanetClearPct !== null ||
    effectivePlanetCloudPct !== null ||
    effectivePlanetSnowIcePct !== null ||
    effectivePlanetVisiblePct !== null;

  if (client.provider === "planet") {
    if (effectivePlanetCloudPct !== null) {
      score -= effectivePlanetCloudPct * 0.8;
      if (effectivePlanetCloudPct <= 10) {
        score += 10;
      } else if (effectivePlanetCloudPct <= 20) {
        score += 4;
      }
    }

    if (effectivePlanetSnowIcePct !== null) {
      score -= effectivePlanetSnowIcePct * 0.85;
      if (effectivePlanetSnowIcePct >= 30) {
        score -= 16;
      } else if (effectivePlanetSnowIcePct >= 15) {
        score -= 8;
      }
    }

    if (planetHazePct !== null) {
      score -= planetHazePct * 0.25;
    }

    if (planetShadowPct !== null) {
      score -= planetShadowPct * 0.15;
    }

    if (effectivePlanetClearPct !== null) {
      if (effectivePlanetClearPct >= 80) {
        score += 12;
      } else if (effectivePlanetClearPct >= 65) {
        score += 6;
      } else if (effectivePlanetClearPct < 40) {
        score -= 8;
      }
    }

    if (effectivePlanetVisiblePct !== null) {
      if (effectivePlanetVisiblePct >= 85) {
        score += 8;
      } else if (effectivePlanetVisiblePct >= 70) {
        score += 4;
      } else if (effectivePlanetVisiblePct < 50) {
        score -= 6;
      }
    }

    if (effectivePlanetQualityConfidencePct !== null) {
      if (effectivePlanetQualityConfidencePct >= 80) {
        score += 4;
      } else if (effectivePlanetQualityConfidencePct < 55) {
        score -= 5;
      }
    }

    if (context.winterWindow && !hasPlanetQualitySignal) {
      score -= context.hasProviderBackedSentinel1Candidate ? 18 : 7;
    }
  }

  score -= ageDays * 2;

  return Number(score.toFixed(2));
}

export async function syncLatestImagery(
  dependencies: SyncLatestImageryDependencies,
  input: SyncLatestImageryExecutionInput,
): Promise<SyncLatestImageryResult> {
  const providers = input.providers ?? DEFAULT_IMAGERY_PROVIDER_ORDER;
  const clients = selectProviderClients(dependencies.providerClients, providers);
  const cachedPlanetObservation = providers.includes("planet")
    ? await dependencies.observationRepository.getLatestByFieldAndProvider(
        input.workspaceId,
        input.fieldId,
        "planet",
        input.requestedAt,
      )
    : null;
  const discoveredEntries: Array<{
    client: ImageryProviderClient;
    discovered: DiscoveredImagerySceneResult;
  }> = [];

  for (const client of clients) {
    const discovered = await client.discoverLatestScene({
      workspaceId: input.workspaceId,
      fieldId: input.fieldId,
      boundary: input.boundary,
      requestedAt: input.requestedAt,
    });

    if (!discovered) {
      continue;
    }

    const normalizedDiscovered =
      client.provider === "planet"
        ? mergeCachedPlanetFieldQuality(
            discovered,
            cachedPlanetObservation?.metadata,
            cachedPlanetObservation?.sourceKey ?? null,
            cachedPlanetObservation?.observedAt ?? null,
          )
        : discovered;

    discoveredEntries.push({ client, discovered: normalizedDiscovered });
  }

  const boundaryLatitude = deriveBoundaryLatitude(input.boundary);
  const winterWindow = isLikelyWinterWindow(boundaryLatitude, input.requestedAt);
  const hasProviderBackedSentinel1Candidate = discoveredEntries.some(
    ({ client, discovered }) =>
      client.provider === "sentinel-1" &&
      typeof discovered.metadata?.discoveryMode === "string" &&
      discovered.metadata.discoveryMode === "provider",
  );

  const discoveredCandidates: DiscoveredCandidate[] = discoveredEntries.map(
    ({ client, discovered }) => ({
      client,
      discovered,
      selectionScore: scoreCandidate(client, discovered, input.requestedAt, {
        boundaryLatitude,
        winterWindow,
        hasProviderBackedSentinel1Candidate,
      }),
    }),
  );

  const sortedCandidates = [...discoveredCandidates].sort((left, right) => {
    if (left.selectionScore !== right.selectionScore) {
      return right.selectionScore - left.selectionScore;
    }

    return (
      Date.parse(right.discovered.scene.capturedAt) -
      Date.parse(left.discovered.scene.capturedAt)
    );
  });

  for (const candidate of sortedCandidates) {
    const { client, discovered } = candidate;

    const scene = discovered.scene;
    const captureMetadata = discovered.metadata ?? {};
    const captureNote = discovered.note ?? scene.note ?? null;
    const selectionMetadata = {
      selectionStrategy: "cross-provider-scoring-v1",
      selectionScore: readSelectionScore(candidate),
      selectionBoundaryLatitude: Number(boundaryLatitude.toFixed(4)),
      selectionWinterWindow: winterWindow,
      ...(readNumberMetadata(candidate, "sceneSnowProbabilityPct") == null
        ? {}
        : {
            selectionSnowProbabilityPct: readNumberMetadata(
              candidate,
              "sceneSnowProbabilityPct",
            ),
          }),
      ...(readNumberMetadata(candidate, "sceneCloudProbabilityPct") == null
        ? {}
        : {
            selectionCloudProbabilityPct: readNumberMetadata(
              candidate,
              "sceneCloudProbabilityPct",
            ),
          }),
      ...(readNumberMetadata(candidate, "sceneNdsi") == null
        ? {}
        : {
            selectionNdsi: readNumberMetadata(candidate, "sceneNdsi"),
          }),
      ...(readNumberMetadata(candidate, "planetClearPct") == null
        ? {}
        : {
            selectionPlanetClearPct: readNumberMetadata(candidate, "planetClearPct"),
          }),
      ...(readNumberMetadata(candidate, "planetCloudPct") == null
        ? {}
        : {
            selectionPlanetCloudPct: readNumberMetadata(candidate, "planetCloudPct"),
          }),
      ...(readNumberMetadata(candidate, "planetSnowIcePct") == null
        ? {}
        : {
            selectionPlanetSnowIcePct: readNumberMetadata(
              candidate,
              "planetSnowIcePct",
            ),
          }),
      ...(readNumberMetadata(candidate, "planetVisiblePct") == null
        ? {}
        : {
            selectionPlanetVisiblePct: readNumberMetadata(
              candidate,
              "planetVisiblePct",
            ),
          }),
      ...(readNumberMetadata(candidate, "planetVisibleConfidencePct") == null
        ? {}
        : {
            selectionPlanetVisibleConfidencePct: readNumberMetadata(
              candidate,
              "planetVisibleConfidencePct",
            ),
          }),
      ...(readNumberMetadata(candidate, "planetFieldClearPct") == null
        ? {}
        : {
            selectionPlanetFieldClearPct: readNumberMetadata(
              candidate,
              "planetFieldClearPct",
            ),
          }),
      ...(readNumberMetadata(candidate, "planetFieldCloudPct") == null
        ? {}
        : {
            selectionPlanetFieldCloudPct: readNumberMetadata(
              candidate,
              "planetFieldCloudPct",
            ),
          }),
      ...(readNumberMetadata(candidate, "planetFieldSnowIcePct") == null
        ? {}
        : {
            selectionPlanetFieldSnowIcePct: readNumberMetadata(
              candidate,
              "planetFieldSnowIcePct",
            ),
          }),
      ...(readNumberMetadata(candidate, "planetFieldVisiblePct") == null
        ? {}
        : {
            selectionPlanetFieldVisiblePct: readNumberMetadata(
              candidate,
              "planetFieldVisiblePct",
            ),
          }),
      ...(readNumberMetadata(candidate, "planetFieldConfidencePct") == null
        ? {}
        : {
            selectionPlanetFieldConfidencePct: readNumberMetadata(
              candidate,
              "planetFieldConfidencePct",
            ),
          }),
      ...(readNumberMetadata(candidate, "planetFieldSampleCoveragePct") == null
        ? {}
        : {
            selectionPlanetFieldSampleCoveragePct: readNumberMetadata(
              candidate,
              "planetFieldSampleCoveragePct",
            ),
          }),
      ...(candidate.discovered.metadata?.planetFieldQualityCacheHit === true
        ? { selectionPlanetFieldQualityCacheHit: true }
        : {}),
      ...(readStringMetadata(candidate.discovered.metadata, "planetFieldQualityCachedObservedAt")
        ? {
            selectionPlanetFieldQualityCachedObservedAt: readStringMetadata(
              candidate.discovered.metadata,
              "planetFieldQualityCachedObservedAt",
            ),
          }
        : {}),
      ...(readStringMetadata(candidate.discovered.metadata, "planetFieldQualityCachedSourceKey")
        ? {
            selectionPlanetFieldQualityCachedSourceKey: readStringMetadata(
              candidate.discovered.metadata,
              "planetFieldQualityCachedSourceKey",
            ),
          }
        : {}),
    } as const;

    if (input.dryRun) {
      const capture = await dependencies.captureRepository.upsertCapture({
        workspaceId: input.workspaceId,
        fieldId: input.fieldId,
        requestedAt: input.requestedAt,
        capturedAt: scene.capturedAt,
        providerKey: scene.provider,
        sceneKey: scene.sceneKey,
        status: "dry-run",
        coveragePct: scene.coveragePct,
        cloudCoverPct: scene.cloudCoverPct,
        note: captureNote ?? "Imagery sync dry-run prepared.",
        metadata: {
          ...captureMetadata,
          ...selectionMetadata,
        },
        observationId: null,
      });

      return {
        workspaceId: input.workspaceId,
        fieldId: input.fieldId,
        requestedAt: input.requestedAt,
        providers,
        status: "dry-run",
        note: `Imagery sync dry-run prepared for ${scene.provider}.`,
        capture: {
          captureId: capture.id,
          providerKey: capture.providerKey,
          sceneKey: capture.sceneKey,
          capturedAt: capture.capturedAt,
          coveragePct: capture.coveragePct,
          cloudCoverPct: capture.cloudCoverPct,
          discoveryMode:
            typeof capture.metadata.discoveryMode === "string"
              ? capture.metadata.discoveryMode
              : null,
          discoveryClient:
            typeof capture.metadata.discoveryClient === "string"
              ? capture.metadata.discoveryClient
              : null,
          discoveryFallbackReason:
            typeof capture.metadata.discoveryFallbackReason === "string"
              ? capture.metadata.discoveryFallbackReason
              : null,
        },
      };
    }

    const materialized = await client.materializeFieldObservation({
      workspaceId: input.workspaceId,
      fieldId: input.fieldId,
      boundary: input.boundary,
      requestedAt: input.requestedAt,
      scene,
    });

    if (!materialized || materialized.observation.cells.length === 0) {
      continue;
    }

    if (
      client.provider === "planet" &&
      shouldRejectPlanetFieldQuality(
        materialized.metadata,
        hasProviderBackedSentinel1Candidate,
      )
    ) {
      continue;
    }

    const observation = materialized.observation;
    const providerKey =
      observation.sourceKey.split(":").slice(1).join(":") || scene.provider;
    const storedObservation =
      await dependencies.observationRepository.replaceObservation({
        workspaceId: input.workspaceId,
        fieldId: input.fieldId,
        observedAt: scene.capturedAt,
        sourceKey: observation.sourceKey,
        providerKey,
        artifactKey: materialized.artifactKey ?? null,
      metadata: {
        sceneKey: scene.sceneKey,
        ...selectionMetadata,
        ...(materialized.metadata ?? {}),
      },
      cells: observation.cells,
      });

    const capture = await dependencies.captureRepository.upsertCapture({
      workspaceId: input.workspaceId,
      fieldId: input.fieldId,
      requestedAt: input.requestedAt,
      capturedAt: scene.capturedAt,
      providerKey: scene.provider,
      sceneKey: scene.sceneKey,
      status: "materialized",
      coveragePct: scene.coveragePct,
      cloudCoverPct: scene.cloudCoverPct,
      note:
        materialized.note ??
        captureNote ??
        "Imagery capture materialized.",
      metadata: {
        ...captureMetadata,
        ...selectionMetadata,
        ...(materialized.metadata ?? {}),
      },
      observationId: storedObservation.id,
    });

    return {
      workspaceId: input.workspaceId,
      fieldId: input.fieldId,
      requestedAt: input.requestedAt,
      providers,
      status: "materialized",
      note: capture.note ?? `Imagery capture materialized for ${scene.provider}.`,
      capture: {
        captureId: capture.id,
        providerKey: capture.providerKey,
        sceneKey: capture.sceneKey,
        capturedAt: capture.capturedAt,
        coveragePct: capture.coveragePct,
        cloudCoverPct: capture.cloudCoverPct,
        discoveryMode:
          typeof capture.metadata.discoveryMode === "string"
            ? capture.metadata.discoveryMode
            : null,
        discoveryClient:
          typeof capture.metadata.discoveryClient === "string"
            ? capture.metadata.discoveryClient
            : null,
        discoveryFallbackReason:
          typeof capture.metadata.discoveryFallbackReason === "string"
            ? capture.metadata.discoveryFallbackReason
            : null,
      },
      materializedObservation: {
        sourceKey: storedObservation.sourceKey,
        providerKey: storedObservation.providerKey,
        cellCount: storedObservation.cells.length,
        observedAt: storedObservation.observedAt,
        artifactKey: storedObservation.artifactKey,
        materializationMode:
          typeof storedObservation.metadata.materializationMode === "string"
            ? storedObservation.metadata.materializationMode
            : null,
        materializationClient:
          typeof storedObservation.metadata.materializationClient === "string"
            ? storedObservation.metadata.materializationClient
            : null,
        materializationFallbackReason:
          typeof storedObservation.metadata.materializationFallbackReason ===
          "string"
            ? storedObservation.metadata.materializationFallbackReason
            : null,
      },
    };
  }

  return {
    workspaceId: input.workspaceId,
    fieldId: input.fieldId,
    requestedAt: input.requestedAt,
    providers,
    status: "unavailable",
    note: `No imagery capture could be discovered for ${providers.join(", ")}.`,
  };
}
