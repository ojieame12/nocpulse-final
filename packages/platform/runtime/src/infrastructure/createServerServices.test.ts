import test from "node:test";
import assert from "node:assert/strict";
import type { FieldAlert, UpsertFieldAlertInput } from "@fieldpulse/module-alerts";
import type {
  CropIntelligenceRun,
  FieldIntelligenceFinding,
  FieldIntelligenceZone,
  UpsertCropIntelligenceRunInput,
  UpsertFieldIntelligenceFindingInput,
} from "@fieldpulse/module-crop-intelligence";
import type { UpsertFieldIntelligenceZoneInput } from "@fieldpulse/module-crop-intelligence";
import type { FieldDetail, FieldOverview } from "@fieldpulse/module-fields";
import type { FieldHailEvent } from "@fieldpulse/module-hail";
import type { ImageryProviderProbeRecord } from "@fieldpulse/module-imagery";
import type {
  FieldMoistureCellSnapshot,
  FieldMoistureSnapshot,
} from "@fieldpulse/module-moisture";
import type { FieldWeatherObservation } from "@fieldpulse/module-weather";
import type { Workspace } from "@fieldpulse/module-workspaces";
import type { ServerRepositories } from "../contracts/ServerRuntime";
import { createServerServices } from "./createServerServices";

const WORKSPACE_ID = "workspace-1";
const FIELD_ID = "field-1";
const REQUESTED_AT = "2026-03-29T06:00:00.000Z";
const REPORTED_AT = "2026-03-29T05:00:00.000Z";

function createField(): FieldDetail {
  return {
    id: FIELD_ID,
    workspaceId: WORKSPACE_ID,
    name: "North Pivot",
    areaHa: 64,
    legalLandDescription: null,
    boundary: {
      type: "MultiPolygon",
      coordinates: [[[
        [-109.61, 51.31] as const,
        [-109.53, 51.31] as const,
        [-109.53, 51.23] as const,
        [-109.61, 51.23] as const,
        [-109.61, 51.31] as const,
      ]]],
    },
    labelPoint: [-109.57, 51.27] as const,
    createdBy: "user-1",
    createdAt: REQUESTED_AT,
    updatedAt: REQUESTED_AT,
  };
}

function createWorkspace(input: {
  id: string;
  name: string;
  slug: string;
}): Workspace {
  return {
    id: input.id,
    name: input.name,
    slug: input.slug,
    createdBy: "user-1",
    createdAt: REQUESTED_AT,
    updatedAt: REQUESTED_AT,
  };
}

function createFieldOverview(input: {
  workspaceId: string;
  fieldId: string;
  name: string;
}): FieldOverview {
  return {
    id: input.fieldId,
    workspaceId: input.workspaceId,
    name: input.name,
    areaHa: 64,
    legalLandDescription: null,
    latestMoisture: null,
  };
}

function createRun(input: UpsertCropIntelligenceRunInput): CropIntelligenceRun {
  return {
    id: "run-1",
    workspaceId: input.workspaceId,
    fieldId: input.fieldId,
    sourceKey: input.sourceKey,
    modelKey: input.modelKey,
    status: input.status,
    startedAt: input.startedAt,
    completedAt: input.completedAt ?? null,
    inputVersion: input.inputVersion ?? null,
    provenance: input.provenance ?? {},
    createdAt: input.startedAt,
    updatedAt: input.completedAt ?? input.startedAt,
  };
}

function createFindingRecord(
  input: UpsertFieldIntelligenceFindingInput,
): FieldIntelligenceFinding {
  return {
    id: `finding-${input.dedupeKey}`,
    workspaceId: input.workspaceId,
    fieldId: input.fieldId,
    runId: input.runId ?? null,
    family: input.family,
    severity: input.severity,
    status: input.status ?? "active",
    sourceKey: input.sourceKey,
    dedupeKey: input.dedupeKey,
    title: input.title,
    summary: input.summary ?? null,
    explanation: input.explanation ?? null,
    recommendedAction: input.recommendedAction ?? null,
    confidence: input.confidence ?? null,
    zoneGeoJson: input.zoneGeoJson ?? null,
    affectedCellKeys: input.affectedCellKeys ?? [],
    evidence: input.evidence ?? {},
    startedAt: input.startedAt,
    endedAt: input.endedAt ?? null,
    createdAt: input.startedAt,
    updatedAt: input.endedAt ?? input.startedAt,
  };
}

function createAlertRecord(input: UpsertFieldAlertInput): FieldAlert {
  return {
    id: `alert-${input.dedupeKey}`,
    workspaceId: input.workspaceId,
    fieldId: input.fieldId,
    family: input.family,
    severity: input.severity,
    status: input.status ?? "active",
    sourceKey: input.sourceKey,
    dedupeKey: input.dedupeKey,
    title: input.title,
    summary: input.summary ?? null,
    explanation: input.explanation ?? null,
    recommendedAction: input.recommendedAction ?? null,
    facts: input.facts ?? {},
    evidence: input.evidence ?? {},
    startedAt: input.startedAt,
    endedAt: input.endedAt ?? null,
    acknowledgedAt: input.acknowledgedAt ?? null,
    acknowledgedByUserId: input.acknowledgedByUserId ?? null,
    resolvedAt: input.resolvedAt ?? null,
    resolutionNote: input.resolutionNote ?? null,
    createdAt: input.startedAt,
    updatedAt: input.resolvedAt ?? input.startedAt,
  };
}

function createMoistureCell(cellKey: string): FieldMoistureCellSnapshot {
  return {
    id: `cell-${cellKey}`,
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    snapshotId: "snapshot-1",
    observedAt: REPORTED_AT,
    sourceKey: "moisture-grid-v1",
    cellKey,
    rowIndex: 0,
    columnIndex: 0,
    centroid: [-109.57, 51.27],
    boundary: {
      type: "Polygon",
      coordinates: [[
        [-109.575, 51.275],
        [-109.565, 51.275],
        [-109.565, 51.265],
        [-109.575, 51.265],
        [-109.575, 51.275],
      ]],
    },
    rootZonePct: 42,
    surfacePct: 35,
    confidence: "high",
    createdAt: REPORTED_AT,
  };
}

function createHailEvent(sourceEventKey: string): FieldHailEvent {
  return {
    id: `hail-${sourceEventKey}`,
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    providerKey: "environment-canada-cap",
    sourceKey: "xweather-hail-v1",
    sourceEventKey,
    dedupeKey: sourceEventKey,
    eventType: "observed",
    severity: "warning",
    reportedAt: REPORTED_AT,
    windowStart: "2026-03-29T04:30:00.000Z",
    windowEnd: "2026-03-29T04:45:00.000Z",
    headline: `Storm cell ${sourceEventKey}`,
    summary: null,
    hailSizeMm: 18,
    coverageGeoJson: {
      type: "Polygon",
      coordinates: [[
        [-109.61, 51.31],
        [-109.53, 51.31],
        [-109.53, 51.23],
        [-109.61, 51.23],
        [-109.61, 51.31],
      ]],
    },
    provenance: {},
    createdAt: REPORTED_AT,
    updatedAt: REPORTED_AT,
  };
}

function createWeatherObservation(input: {
  id: string;
  workspaceId: string;
  fieldId: string;
  observedAt: string;
  updatedAt: string;
}): FieldWeatherObservation {
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    fieldId: input.fieldId,
    observedAt: input.observedAt,
    updatedAt: input.updatedAt,
    sourceKey: "weather-station-v1",
    providerKey: "open-meteo",
    airTemperatureC: 18,
    precipitationMm: 0,
    windSpeedKph: 11,
    relativeHumidityPct: 54,
    soilMoisturePct: 33,
    evapotranspirationMm: 2.1,
    provenance: {},
    createdAt: input.observedAt,
  };
}

function createMoistureSnapshot(input: {
  id: string;
  observedAt: string;
  sourceKey?: string;
}): FieldMoistureSnapshot {
  return {
    id: input.id,
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    observedAt: input.observedAt,
    sourceKey: input.sourceKey ?? "imagery-weather-derived-v1",
    rootZonePct: 42,
    surfacePct: 35,
    confidence: "medium",
    inputs: {
      soilDataset: "worker-rebuild",
    },
    createdAt: input.observedAt,
  };
}

function createImageryProviderProbeRecord(input: {
  id: string;
  workspaceId: string;
  fieldId: string;
  provider?: ImageryProviderProbeRecord["provider"];
  providerStatus?: ImageryProviderProbeRecord["providerStatus"];
  probeStatus?: ImageryProviderProbeRecord["probeStatus"];
  createdAt: string;
}): ImageryProviderProbeRecord {
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    fieldId: input.fieldId,
    provider: input.provider ?? "sentinel-2",
    requestedAt: input.createdAt,
    providerStatus: input.providerStatus ?? "fallback",
    discoveryMode: "field-probe",
    materializationMode: "fallback",
    discoveryClient: "test-client",
    materializationClient: null,
    fallbackClient: "test-fallback",
    reason: "Provider degraded",
    probeStatus: input.probeStatus ?? "fallback-scene",
    probeSceneKey: null,
    probeCapturedAt: null,
    probeDiscoveryMode: null,
    probeDiscoveryClient: null,
    probeReason: "Used fallback scene",
    details: {},
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
}

class InMemoryRunRepository {
  async listLatestByWorkspace(): Promise<readonly CropIntelligenceRun[]> {
    return [];
  }

  async listRecentRuns(): Promise<readonly CropIntelligenceRun[]> {
    return [];
  }

  async upsertRun(input: UpsertCropIntelligenceRunInput): Promise<CropIntelligenceRun> {
    return createRun(input);
  }
}

class InMemoryFindingRepository {
  async upsertFinding(
    input: UpsertFieldIntelligenceFindingInput,
  ): Promise<FieldIntelligenceFinding> {
    return createFindingRecord(input);
  }
}

class InMemoryZoneRepository {
  private readonly zones = new Map<string, FieldIntelligenceZone>();

  async listByTrackingKey(input: {
    workspaceId: string;
    fieldId: string;
    family: FieldIntelligenceFinding["family"];
    trackingKey: string;
  }): Promise<readonly FieldIntelligenceZone[]> {
    return Array.from(this.zones.values()).filter(
      (zone) =>
        zone.workspaceId === input.workspaceId &&
        zone.fieldId === input.fieldId &&
        zone.family === input.family &&
        zone.trackingKey === input.trackingKey,
    );
  }

  async upsertZone(
    input: UpsertFieldIntelligenceZoneInput,
  ): Promise<FieldIntelligenceZone> {
    const id = input.id ?? `zone-${input.trackingKey}`;
    const zone: FieldIntelligenceZone = {
      id,
      workspaceId: input.workspaceId,
      fieldId: input.fieldId,
      family: input.family,
      trackingKey: input.trackingKey,
      latestFindingId: input.latestFindingId ?? null,
      latestRunId: input.latestRunId ?? null,
      status: input.status,
      latestSeverity: input.latestSeverity ?? null,
      zoneGeoJson: input.zoneGeoJson,
      affectedCellKeys: input.affectedCellKeys,
      detectionCount: input.detectionCount,
      firstSeenAt: input.firstSeenAt,
      lastSeenAt: input.lastSeenAt,
      lastStatusChangedAt: input.lastStatusChangedAt,
      metadata: input.metadata ?? {},
      createdAt: input.firstSeenAt,
      updatedAt: input.lastSeenAt,
    };
    this.zones.set(id, zone);
    return zone;
  }
}

class InMemoryAlertRepository {
  readonly upsertInputs: UpsertFieldAlertInput[] = [];

  async upsertAlert(input: UpsertFieldAlertInput): Promise<FieldAlert> {
    this.upsertInputs.push(input);

    if (input.sourceKey.endsWith(":event-fail")) {
      throw new Error("alert write failed");
    }

    return createAlertRecord(input);
  }
}

function createRepositories(alerts: InMemoryAlertRepository): ServerRepositories {
  return {
    fields: {
      async getById() {
        return createField();
      },
    } as unknown as ServerRepositories["fields"],
    imageryRasterObservations: {} as ServerRepositories["imageryRasterObservations"],
    hailEvents: {
      async listByField() {
        return [
          createHailEvent("event-ok"),
          createHailEvent("event-fail"),
        ] as const;
      },
    } as unknown as ServerRepositories["hailEvents"],
    moistureCellSnapshots: {
      async getLatestByField() {
        return [createMoistureCell("cell-a")] as const;
      },
    } as unknown as ServerRepositories["moistureCellSnapshots"],
    cropIntelligenceRuns: new InMemoryRunRepository() as ServerRepositories["cropIntelligenceRuns"],
    cropIntelligenceFindings:
      new InMemoryFindingRepository() as ServerRepositories["cropIntelligenceFindings"],
    cropIntelligenceZones:
      new InMemoryZoneRepository() as unknown as ServerRepositories["cropIntelligenceZones"],
    alerts: alerts as unknown as ServerRepositories["alerts"],
  } as unknown as ServerRepositories;
}

test("createServerServices keeps hail findings when one alert sync fails", async () => {
  const alerts = new InMemoryAlertRepository();
  const services = createServerServices(createRepositories(alerts));

  const result = await services.intelligence.generateHailRiskFindings({
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    requestedAt: REQUESTED_AT,
  });

  assert.equal(result.findings.length, 2);
  assert.equal(result.alerts.length, 1);
  assert.equal(result.alertSync.attemptedCount, 2);
  assert.equal(result.alertSync.syncedCount, 1);
  assert.equal(result.alertSync.failedCount, 1);
  assert.equal(alerts.upsertInputs.length, 2);
  assert.deepEqual(
    result.alerts.map((alert) => alert.sourceKey),
    ["crop-intelligence:hail-risk-generator:event-ok"],
  );
  assert.equal(
    result.alertSync.failures[0]?.sourceKey,
    "crop-intelligence:hail-risk-generator:event-fail",
  );
  assert.equal(
    result.alertSync.failures[0]?.findingId,
    "finding-hail-risk:event-fail",
  );
  assert.match(result.alertSync.failures[0]?.message ?? "", /alert write failed/i);
});

test("createServerServices weather refresh report keeps workspace field labels across workspaces", async () => {
  const now = Date.now();
  const freshObservedAt = new Date(now - 2 * 60 * 60 * 1000).toISOString();
  const staleObservedAt = new Date(now - 30 * 60 * 60 * 1000).toISOString();
  const freshUpdatedAt = new Date(now - 90 * 60 * 1000).toISOString();
  const staleUpdatedAt = new Date(now - 28 * 60 * 60 * 1000).toISOString();
  const workspaces = [
    createWorkspace({
      id: "workspace-1",
      name: "North Farm",
      slug: "north-farm",
    }),
    createWorkspace({
      id: "workspace-2",
      name: "South Farm",
      slug: "south-farm",
    }),
  ] as const;
  const fieldOverviewByWorkspace = {
    "workspace-1": [
      createFieldOverview({
        workspaceId: "workspace-1",
        fieldId: "field-1",
        name: "North Pivot",
      }),
    ],
    "workspace-2": [
      createFieldOverview({
        workspaceId: "workspace-2",
        fieldId: "field-2",
        name: "South Quarter",
      }),
    ],
  } as const;
  const latestObservationsByWorkspace = {
    "workspace-1": [
      createWeatherObservation({
        id: "obs-fresh",
        workspaceId: "workspace-1",
        fieldId: "field-1",
        observedAt: freshObservedAt,
        updatedAt: freshUpdatedAt,
      }),
    ],
    "workspace-2": [
      createWeatherObservation({
        id: "obs-stale",
        workspaceId: "workspace-2",
        fieldId: "field-2",
        observedAt: staleObservedAt,
        updatedAt: staleUpdatedAt,
      }),
    ],
  } as const;

  const services = createServerServices({
    workspaces: {
      async listAll() {
        return workspaces;
      },
    } as unknown as ServerRepositories["workspaces"],
    fields: {
      async listOverviewByWorkspace(workspaceId: string) {
        return fieldOverviewByWorkspace[
          workspaceId as keyof typeof fieldOverviewByWorkspace
        ] ?? [];
      },
    } as unknown as ServerRepositories["fields"],
    weatherObservations: {
      async listLatestByWorkspace(workspaceId: string) {
        return latestObservationsByWorkspace[
          workspaceId as keyof typeof latestObservationsByWorkspace
        ] ?? [];
      },
      async listRecentObservations() {
        return latestObservationsByWorkspace["workspace-1"];
      },
    } as unknown as ServerRepositories["weatherObservations"],
  } as unknown as ServerRepositories);

  const report = await services.weather.buildRecentRefreshReport({
    staleAfterHours: 12,
  });

  assert.equal(report.workspaceSummaries.length, 1);
  assert.equal(report.workspaceSummaries[0]?.workspaceName, "North Farm");
  assert.equal(report.workspaceSummaries[0]?.workspaceSlug, "north-farm");
  assert.equal(report.staleFields.length, 1);
  assert.equal(report.staleFields[0]?.workspaceName, "South Farm");
  assert.equal(report.staleFields[0]?.workspaceSlug, "south-farm");
  assert.equal(report.staleFields[0]?.fieldName, "South Quarter");
  assert.equal(report.staleFields[0]?.issueType, "stale-weather");
});

test("createServerServices moisture rebuild estimate overlaps field lookup with source reads", async () => {
  let fieldResolved = false;
  let rasterStartedWhileFieldPending = false;
  let weatherStartedWhileFieldPending = false;

  const services = createServerServices({
    fields: {
      async getById() {
        await new Promise((resolve) => {
          setTimeout(resolve, 20);
        });
        fieldResolved = true;
        return createField();
      },
    } as unknown as ServerRepositories["fields"],
    imageryRasterObservations: {
      async getLatestByField() {
        rasterStartedWhileFieldPending = rasterStartedWhileFieldPending || !fieldResolved;
        return null;
      },
    } as unknown as ServerRepositories["imageryRasterObservations"],
    weatherObservations: {
      async getLatestByField() {
        weatherStartedWhileFieldPending = weatherStartedWhileFieldPending || !fieldResolved;
        return null;
      },
    } as unknown as ServerRepositories["weatherObservations"],
    moistureSnapshots: {
      async getLatestByField() {
        return null;
      },
      async upsertSnapshot(input: {
        observedAt: string;
        sourceKey: string;
      }) {
        return createMoistureSnapshot({
          id: "snapshot-1",
          observedAt: input.observedAt,
          sourceKey: input.sourceKey,
        });
      },
    } as unknown as ServerRepositories["moistureSnapshots"],
    moistureCellSnapshots: {
      async replaceSnapshotCells() {
        return [];
      },
    } as unknown as ServerRepositories["moistureCellSnapshots"],
  } as unknown as ServerRepositories);

  const result = await services.moisture.rebuildFieldEstimate({
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
  });

  assert.equal(rasterStartedWhileFieldPending, true);
  assert.equal(weatherStartedWhileFieldPending, true);
  assert.equal(result.snapshot.id, "snapshot-1");
});

test("createServerServices moisture rebuild cells overlaps field lookup with snapshot lookup", async () => {
  let fieldResolved = false;
  let snapshotStartedWhileFieldPending = false;

  const services = createServerServices({
    fields: {
      async getById() {
        await new Promise((resolve) => {
          setTimeout(resolve, 20);
        });
        fieldResolved = true;
        return createField();
      },
    } as unknown as ServerRepositories["fields"],
    moistureSnapshots: {
      async getLatestByField() {
        snapshotStartedWhileFieldPending = !fieldResolved;
        return null;
      },
    } as unknown as ServerRepositories["moistureSnapshots"],
  } as unknown as ServerRepositories);

  const result = await services.moisture.rebuildFieldCells({
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
  });

  assert.equal(snapshotStartedWhileFieldPending, true);
  assert.equal(result.action, "skipped");
  assert.equal(result.reason, "missing-snapshot");
});

test("createServerServices scoped weather refresh report avoids workspace enumeration", async () => {
  let listAllCalled = false;
  let getByIdCalls = 0;
  const observedAt = new Date(Date.now() - 90 * 60 * 1000).toISOString();
  const workspace = createWorkspace({
    id: "workspace-1",
    name: "North Farm",
    slug: "north-farm",
  });

  const services = createServerServices({
    workspaces: {
      async getById(workspaceId: string) {
        getByIdCalls += 1;
        return workspaceId === workspace.id ? workspace : null;
      },
      async listAll() {
        listAllCalled = true;
        throw new Error("listAll should not be called for scoped weather reports");
      },
    } as unknown as ServerRepositories["workspaces"],
    fields: {
      async listOverviewByWorkspace(workspaceId: string) {
        return [
          createFieldOverview({
            workspaceId,
            fieldId: "field-1",
            name: "North Pivot",
          }),
        ];
      },
    } as unknown as ServerRepositories["fields"],
    weatherObservations: {
      async listLatestByWorkspace(workspaceId: string) {
        return [
          createWeatherObservation({
            id: "obs-1",
            workspaceId,
            fieldId: "field-1",
            observedAt,
            updatedAt: observedAt,
          }),
        ];
      },
      async listRecentObservations() {
        return [
          createWeatherObservation({
            id: "obs-1",
            workspaceId: "workspace-1",
            fieldId: "field-1",
            observedAt,
            updatedAt: observedAt,
          }),
        ];
      },
    } as unknown as ServerRepositories["weatherObservations"],
  } as unknown as ServerRepositories);

  const report = await services.weather.buildRecentRefreshReport({
    workspaceId: "workspace-1",
    staleAfterHours: 12,
  });

  assert.equal(listAllCalled, false);
  assert.equal(getByIdCalls, 1);
  assert.equal(report.workspaceSummaries.length, 1);
  assert.equal(report.workspaceSummaries[0]?.workspaceName, "North Farm");
});

test("createServerServices imagery probe fallback report resolves relevant workspaces by id", async () => {
  let listAllCalled = false;
  const getByIdCalls: string[] = [];
  const workspaces = {
    "workspace-1": createWorkspace({
      id: "workspace-1",
      name: "North Farm",
      slug: "north-farm",
    }),
    "workspace-2": createWorkspace({
      id: "workspace-2",
      name: "South Farm",
      slug: "south-farm",
    }),
  } as const;

  const services = createServerServices({
    workspaces: {
      async getById(workspaceId: string) {
        getByIdCalls.push(workspaceId);
        return workspaces[workspaceId as keyof typeof workspaces] ?? null;
      },
      async listAll() {
        listAllCalled = true;
        throw new Error("listAll should not be called for probe fallback reports");
      },
    } as unknown as ServerRepositories["workspaces"],
    fields: {
      async listOverviewByWorkspace(workspaceId: string) {
        return [
          createFieldOverview({
            workspaceId,
            fieldId: workspaceId === "workspace-1" ? "field-1" : "field-2",
            name: workspaceId === "workspace-1" ? "North Pivot" : "South Quarter",
          }),
        ];
      },
    } as unknown as ServerRepositories["fields"],
    imageryProviderProbes: {
      async listRecent() {
        return [
          createImageryProviderProbeRecord({
            id: "probe-1",
            workspaceId: "workspace-1",
            fieldId: "field-1",
            createdAt: "2026-03-29T05:00:00.000Z",
          }),
          createImageryProviderProbeRecord({
            id: "probe-2",
            workspaceId: "workspace-2",
            fieldId: "field-2",
            createdAt: "2026-03-29T04:00:00.000Z",
          }),
        ];
      },
    } as unknown as ServerRepositories["imageryProviderProbes"],
  } as unknown as ServerRepositories);

  const report = await services.imagery.buildRecentProbeFallbackReport();

  assert.equal(listAllCalled, false);
  assert.deepEqual(getByIdCalls.sort(), ["workspace-1", "workspace-2"]);
  assert.equal(report.fieldIssues.length, 2);
  assert.equal(report.fieldIssues[0]?.workspaceName, "North Farm");
  assert.equal(report.fieldIssues[1]?.workspaceName, "South Farm");
});

test("createServerServices catalog overlaps preferred-workspace membership and workspace lookups", async () => {
  let membershipResolved = false;
  let workspaceLookupStartedWhileMembershipPending = false;

  const services = createServerServices({
    workspaceMemberships: {
      async getByWorkspaceAndUser() {
        await new Promise((resolve) => {
          setTimeout(resolve, 20);
        });
        membershipResolved = true;

        return {
          workspaceId: "workspace-1",
          userId: "user-1",
          role: "owner",
          createdAt: REQUESTED_AT,
          updatedAt: REQUESTED_AT,
        };
      },
    } as unknown as ServerRepositories["workspaceMemberships"],
    workspaces: {
      async getById(workspaceId: string) {
        workspaceLookupStartedWhileMembershipPending = !membershipResolved;
        return createWorkspace({
          id: workspaceId,
          name: "North Farm",
          slug: "north-farm",
        });
      },
    } as unknown as ServerRepositories["workspaces"],
    fields: {
      async listOverviewByWorkspace(workspaceId: string) {
        return [
          createFieldOverview({
            workspaceId,
            fieldId: "field-1",
            name: "North Pivot",
          }),
        ];
      },
    } as unknown as ServerRepositories["fields"],
  } as unknown as ServerRepositories);

  const selection = await services.catalog.loadWorkspaceFieldOverview({
    actorUserId: "user-1",
    preferredWorkspaceId: "workspace-1",
  });

  assert.equal(workspaceLookupStartedWhileMembershipPending, true);
  assert.equal(selection.selectedWorkspace?.id, "workspace-1");
  assert.equal(selection.workspaces.length, 1);
  assert.equal(selection.fields.length, 1);
  assert.equal(selection.primaryField?.id, "field-1");
});
