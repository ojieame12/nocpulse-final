import test from "node:test";
import assert from "node:assert/strict";
import { generateMoistureStressFindings } from "./generateMoistureStressFindings";
import { prairieDefaultRulePack } from "../domain/rulePacks/prairieDefaultRulePack";
import type { CropIntelligenceRun } from "../contracts/CropIntelligenceRun";
import type { FieldIntelligenceFinding } from "../contracts/FieldIntelligenceFinding";
import type { FieldIntelligenceZone } from "../contracts/FieldIntelligenceZone";
import type { UpsertCropIntelligenceRunInput } from "../contracts/UpsertCropIntelligenceRunInput";
import type { UpsertFieldIntelligenceFindingInput } from "../contracts/UpsertFieldIntelligenceFindingInput";
import type { UpsertFieldIntelligenceZoneInput } from "../contracts/UpsertFieldIntelligenceZoneInput";
import type { FieldWeatherDerivedSignalSet } from "@fieldpulse/module-weather";
import type {
  FieldMoistureCellSnapshot,
  FieldMoistureSnapshot,
} from "@fieldpulse/module-moisture";
import type { JsonValue } from "@fieldpulse/platform-db";

const WORKSPACE_ID = "workspace-1";
const FIELD_ID = "field-1";
const OBSERVED_AT = "2026-03-28T05:00:00.000Z";
const REQUESTED_AT = "2026-03-28T06:00:00.000Z";

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

function createWeatherSignalSet(
  overrides: Partial<FieldWeatherDerivedSignalSet> = {},
): FieldWeatherDerivedSignalSet {
  return {
    id: "signal-1",
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    weatherObservationId: "weather-1",
    observedAt: OBSERVED_AT,
    forecastRunAt: OBSERVED_AT,
    sourceKey: "signal-v1",
    providerKey: "open-meteo",
    signalVersion: "v1",
    currentVpdKpa: 1.8,
    peakForecastVpdKpa24h: 2.1,
    netWaterBalance24hMm: -5.2,
    netWaterBalance72hMm: -7.4,
    leafWetHours24h: 4,
    sprayWindowCount24h: 2,
    frostRiskMinTempC: 5,
    frostRiskMinTempC7d: 3.5,
    frostRiskNights7d: 0,
    recentPrecipTotal72hMm: 1.6,
    freezeThawCycles7d: 0,
    soilTemp6cmCurrentC: 9.2,
    soilTemp6cmSustainedDays: 3,
    gdd24h: 8,
    gdd72h: 24,
    gddBaseC: 5,
    provenance: {},
    createdAt: OBSERVED_AT,
    updatedAt: OBSERVED_AT,
    ...overrides,
  };
}

function createSnapshot(
  overrides: Partial<FieldMoistureSnapshot> = {},
): FieldMoistureSnapshot {
  return {
    id: "snapshot-1",
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    observedAt: OBSERVED_AT,
    sourceKey: "moisture-estimate-v1",
    rootZonePct: 22,
    surfacePct: 18,
    confidence: "high",
    inputs: {
      soilDataset: "sentinel-hub-stats-v1:sentinel-1",
    },
    createdAt: OBSERVED_AT,
    ...overrides,
  };
}

function createCell(input: {
  cellKey: string;
  rowIndex: number;
  columnIndex: number;
  rootZonePct: number;
  surfacePct: number;
}): FieldMoistureCellSnapshot {
  const west = -109.6 + input.columnIndex * 0.02;
  const east = west + 0.02;
  const north = 51.3 - input.rowIndex * 0.02;
  const south = north - 0.02;

  return {
    id: `cell-${input.cellKey}`,
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    snapshotId: "snapshot-1",
    observedAt: OBSERVED_AT,
    sourceKey: "moisture-grid-v1",
    cellKey: input.cellKey,
    rowIndex: input.rowIndex,
    columnIndex: input.columnIndex,
    centroid: [west + 0.01, south + 0.01],
    boundary: {
      type: "Polygon",
      coordinates: [[
        [west, north],
        [east, north],
        [east, south],
        [west, south],
        [west, north],
      ]],
    },
    rootZonePct: input.rootZonePct,
    surfacePct: input.surfacePct,
    confidence: "high",
    createdAt: OBSERVED_AT,
  };
}

function createFindingRecord(
  input: UpsertFieldIntelligenceFindingInput,
  existingId?: string,
): FieldIntelligenceFinding {
  return {
    id: existingId ?? `finding-${input.dedupeKey}`,
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

function createZoneRecord(
  input: UpsertFieldIntelligenceZoneInput,
  existing?: FieldIntelligenceZone,
): FieldIntelligenceZone {
  const timestamp = input.lastSeenAt;

  return {
    id: input.id ?? existing?.id ?? `zone-${input.trackingKey}-1`,
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
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function readMetadataRecord(value: JsonValue | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, JsonValue>;
}

class InMemoryRunRepository {
  lastInput: UpsertCropIntelligenceRunInput | null = null;

  async upsertRun(input: UpsertCropIntelligenceRunInput): Promise<CropIntelligenceRun> {
    this.lastInput = input;
    return createRun(input);
  }
}

class InMemoryFindingRepository {
  private readonly byDedupeKey = new Map<string, FieldIntelligenceFinding>();
  readonly upsertInputs: UpsertFieldIntelligenceFindingInput[] = [];

  constructor(existing: readonly FieldIntelligenceFinding[] = []) {
    for (const finding of existing) {
      this.byDedupeKey.set(`${finding.workspaceId}:${finding.fieldId}:${finding.dedupeKey}`, finding);
    }
  }

  async getByDedupeKey(
    workspaceId: string,
    fieldId: string,
    dedupeKey: string,
  ): Promise<FieldIntelligenceFinding | null> {
    return this.byDedupeKey.get(`${workspaceId}:${fieldId}:${dedupeKey}`) ?? null;
  }

  async upsertFinding(
    input: UpsertFieldIntelligenceFindingInput,
  ): Promise<FieldIntelligenceFinding> {
    this.upsertInputs.push(input);
    const key = `${input.workspaceId}:${input.fieldId}:${input.dedupeKey}`;
    const existing = this.byDedupeKey.get(key);
    const record = createFindingRecord(input, existing?.id);
    this.byDedupeKey.set(key, record);
    return record;
  }
}

class InMemoryZoneRepository {
  readonly upsertInputs: UpsertFieldIntelligenceZoneInput[] = [];
  private readonly byTrackingKey = new Map<string, FieldIntelligenceZone[]>();

  constructor(existing: readonly FieldIntelligenceZone[] = []) {
    for (const zone of existing) {
      const key = `${zone.workspaceId}:${zone.fieldId}:${zone.family}:${zone.trackingKey}`;
      const list = this.byTrackingKey.get(key) ?? [];
      list.push(zone);
      this.byTrackingKey.set(key, list);
    }
  }

  async listByTrackingKey(input: {
    workspaceId: string;
    fieldId: string;
    family: FieldIntelligenceFinding["family"];
    trackingKey: string;
  }): Promise<readonly FieldIntelligenceZone[]> {
    return this.byTrackingKey.get(
      `${input.workspaceId}:${input.fieldId}:${input.family}:${input.trackingKey}`,
    ) ?? [];
  }

  async upsertZone(
    input: UpsertFieldIntelligenceZoneInput,
  ): Promise<FieldIntelligenceZone> {
    this.upsertInputs.push(input);
    const key = `${input.workspaceId}:${input.fieldId}:${input.family}:${input.trackingKey}`;
    const existing = (this.byTrackingKey.get(key) ?? []).find((zone) => zone.id === input.id);
    const record = createZoneRecord(input, existing);
    const remaining = (this.byTrackingKey.get(key) ?? []).filter((zone) => zone.id !== record.id);
    this.byTrackingKey.set(key, [...remaining, record]);
    return record;
  }
}

test("generateMoistureStressFindings creates an active tracked moisture-stress finding under critical drying conditions", async () => {
  const runs = new InMemoryRunRepository();
  const findings = new InMemoryFindingRepository();
  const zones = new InMemoryZoneRepository();

  const result = await generateMoistureStressFindings({
    moistureSnapshots: {
      async getLatestByField() {
        return createSnapshot();
      },
    },
    moistureCells: {
      async getLatestByField() {
        return [
          createCell({ cellKey: "a", rowIndex: 0, columnIndex: 0, rootZonePct: 20, surfacePct: 17 }),
          createCell({ cellKey: "b", rowIndex: 0, columnIndex: 1, rootZonePct: 21, surfacePct: 18 }),
          createCell({ cellKey: "c", rowIndex: 1, columnIndex: 0, rootZonePct: 25, surfacePct: 20 }),
          createCell({ cellKey: "d", rowIndex: 2, columnIndex: 2, rootZonePct: 33, surfacePct: 28 }),
        ];
      },
    },
    weatherSignalSets: {
      async getLatestByField() {
        return createWeatherSignalSet();
      },
    },
    runs,
    findings,
    zones,
    input: {
      workspaceId: WORKSPACE_ID,
      fieldId: FIELD_ID,
      requestedAt: REQUESTED_AT,
      cropContext: {
        cropType: "canola",
        growthStage: "flowering",
      },
    },
    rulePack: prairieDefaultRulePack,
  });

  assert.equal(result.run.status, "completed");
  assert.equal(result.findings.length, 1);
  assert.equal(result.moistureSnapshotId, "snapshot-1");
  assert.equal(result.moistureCellCount, 4);

  const finding = result.findings[0]!;
  const metadata = readMetadataRecord(finding.evidence.metadata);
  assert.equal(finding.family, "moisture_stress");
  assert.equal(finding.status, "active");
  assert.equal(finding.severity, "critical");
  assert.equal(finding.dedupeKey, "moisture-stress:prairie-default");
  assert.equal(metadata.cropKey, "canola");
  assert.equal(metadata.growthStage, "flowering");
  assert.equal(metadata.rootZonePct, 22);
  assert.equal(metadata.zoneClusterCount, 1);
  assert.equal(metadata.largestZoneCellCount, 3);
  assert.deepEqual(finding.affectedCellKeys, ["a", "b", "c"]);
  assert.equal(finding.evidence.trackedZones?.length, 1);
  assert.equal(finding.evidence.trackedZones?.[0]?.status, "new");
  assert.equal(zones.upsertInputs.length, 1);
  assert.equal(zones.upsertInputs[0]?.status, "new");
  assert.equal(zones.upsertInputs[0]?.affectedCellKeys.length, 3);
  assert.equal(readMetadataRecord(runs.lastInput?.provenance).cropKey, "canola");
});

test("generateMoistureStressFindings resolves an existing active finding when moisture recovers", async () => {
  const existingFinding = createFindingRecord({
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    runId: "previous-run",
    family: "moisture_stress",
    severity: "high",
    status: "active",
    sourceKey: "moisture-stress-generator:signal-v1",
    dedupeKey: "moisture-stress:prairie-default",
    title: "Moisture stress intensifying",
    summary: "Existing moisture finding",
    explanation: "Existing explanation",
    recommendedAction: "Existing action",
    confidence: 0.79,
    affectedCellKeys: ["dry-a"],
    evidence: {
      trackedZones: [
        {
          zoneId: "zone-existing",
          trackingKey: "moisture-stress:prairie-default",
          status: "persistent",
          severity: "high",
          detectionCount: 2,
          affectedCellCount: 1,
          firstSeenAt: "2026-03-27T05:00:00.000Z",
          lastSeenAt: "2026-03-27T05:00:00.000Z",
          lastStatusChangedAt: "2026-03-27T05:00:00.000Z",
          metadata: { zoneKey: "zone-1" },
        },
      ],
    },
    startedAt: "2026-03-27T05:00:00.000Z",
    endedAt: null,
  }, "finding-existing");

  const existingZone = createZoneRecord({
    id: "zone-existing",
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    family: "moisture_stress",
    trackingKey: "moisture-stress:prairie-default",
    latestFindingId: "finding-existing",
    latestRunId: "previous-run",
    status: "persistent",
    latestSeverity: "high",
    zoneGeoJson: {
      type: "FeatureCollection",
      features: [],
    },
    affectedCellKeys: ["dry-a"],
    detectionCount: 2,
    firstSeenAt: "2026-03-27T05:00:00.000Z",
    lastSeenAt: "2026-03-27T05:00:00.000Z",
    lastStatusChangedAt: "2026-03-27T05:00:00.000Z",
    metadata: { zoneKey: "zone-1" },
  });

  const findings = new InMemoryFindingRepository([existingFinding]);
  const zones = new InMemoryZoneRepository([existingZone]);

  const result = await generateMoistureStressFindings({
    moistureSnapshots: {
      async getLatestByField() {
        return createSnapshot({
          rootZonePct: 35,
          surfacePct: 33,
        });
      },
    },
    moistureCells: {
      async getLatestByField() {
        return [
          createCell({ cellKey: "dry-a", rowIndex: 0, columnIndex: 0, rootZonePct: 35, surfacePct: 33 }),
          createCell({ cellKey: "dry-b", rowIndex: 0, columnIndex: 1, rootZonePct: 36, surfacePct: 34 }),
        ];
      },
    },
    weatherSignalSets: {
      async getLatestByField() {
        return createWeatherSignalSet({
          currentVpdKpa: 0.9,
          peakForecastVpdKpa24h: 1.0,
          netWaterBalance24hMm: 1.2,
          netWaterBalance72hMm: 2.4,
        });
      },
    },
    runs: new InMemoryRunRepository(),
    findings,
    zones,
    input: {
      workspaceId: WORKSPACE_ID,
      fieldId: FIELD_ID,
      requestedAt: REQUESTED_AT,
      cropContext: {
        cropType: "canola",
        growthStage: "flowering",
      },
    },
    rulePack: prairieDefaultRulePack,
  });

  assert.equal(result.findings.length, 1);
  const finding = result.findings[0]!;
  assert.equal(finding.status, "resolved");
  assert.equal(finding.severity, "low");
  assert.equal(finding.endedAt, REQUESTED_AT);
  assert.equal(finding.startedAt, "2026-03-27T05:00:00.000Z");
  assert.deepEqual(finding.affectedCellKeys, []);
  assert.equal(finding.evidence.trackedZones?.length, 1);
  assert.equal(finding.evidence.trackedZones?.[0]?.status, "recovering");
  assert.equal(zones.upsertInputs.length, 1);
  assert.equal(zones.upsertInputs[0]?.status, "recovering");
});
