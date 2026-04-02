import test from "node:test";
import assert from "node:assert/strict";
import { generateDiseaseRiskFindings } from "./generateDiseaseRiskFindings";
import { prairieDefaultRulePack } from "../domain/rulePacks/prairieDefaultRulePack";
import type { CropIntelligenceRun } from "../contracts/CropIntelligenceRun";
import type { FieldIntelligenceFinding } from "../contracts/FieldIntelligenceFinding";
import type { FieldIntelligenceZone } from "../contracts/FieldIntelligenceZone";
import type { UpsertCropIntelligenceRunInput } from "../contracts/UpsertCropIntelligenceRunInput";
import type { UpsertFieldIntelligenceFindingInput } from "../contracts/UpsertFieldIntelligenceFindingInput";
import type { UpsertFieldIntelligenceZoneInput } from "../contracts/UpsertFieldIntelligenceZoneInput";
import type { FieldWeatherDerivedSignalSet } from "@fieldpulse/module-weather";
import type { FieldWeatherObservation } from "@fieldpulse/module-weather";
import type { FieldWeatherForecast } from "@fieldpulse/module-weather";
import type { FieldMoistureCellSnapshot } from "@fieldpulse/module-moisture";
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
    currentVpdKpa: 1.3,
    peakForecastVpdKpa24h: 1.6,
    netWaterBalance24hMm: -2.2,
    netWaterBalance72hMm: -4.1,
    leafWetHours24h: 13,
    sprayWindowCount24h: 4,
    frostRiskMinTempC: 6,
    frostRiskMinTempC7d: 4.8,
    frostRiskNights7d: 0,
    recentPrecipTotal72hMm: 6.8,
    freezeThawCycles7d: 0,
    soilTemp6cmCurrentC: 10.4,
    soilTemp6cmSustainedDays: 4,
    gdd24h: 9,
    gdd72h: 26,
    gddBaseC: 5,
    provenance: {
      forecastSampleCount24h: 24,
    },
    createdAt: OBSERVED_AT,
    updatedAt: OBSERVED_AT,
    ...overrides,
  };
}

function createWeatherObservation(
  overrides: Partial<FieldWeatherObservation> = {},
): FieldWeatherObservation {
  return {
    id: "weather-1",
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    observedAt: OBSERVED_AT,
    sourceKey: "weather-v1",
    providerKey: "open-meteo",
    airTemperatureC: 18,
    precipitationMm: 1.2,
    windSpeedKph: 12,
    relativeHumidityPct: 93,
    soilMoisturePct: 42,
    soilTemperature6cmC: 8.3,
    evapotranspirationMm: 2.4,
    provenance: {},
    createdAt: OBSERVED_AT,
    updatedAt: OBSERVED_AT,
    ...overrides,
  };
}

function createForecasts(
  conduciveHours: number,
): readonly FieldWeatherForecast[] {
  return Array.from({ length: 24 }, (_, index) => {
    const conducive = index < conduciveHours;
    const validAt = new Date(Date.parse(OBSERVED_AT) + (index + 1) * 60 * 60 * 1000).toISOString();

    return {
      id: `forecast-${index + 1}`,
      workspaceId: WORKSPACE_ID,
      fieldId: FIELD_ID,
      forecastRunAt: OBSERVED_AT,
      validAt,
      sourceKey: "forecast-v1",
      providerKey: "open-meteo",
      airTemperatureMinC: conducive ? 16 : 8,
      airTemperatureMaxC: conducive ? 20 : 12,
      precipitationMm: conducive ? 0.6 : 0,
      windSpeedKph: 10,
      relativeHumidityPct: conducive ? 94 : 70,
      evapotranspirationMm: 0.2,
      precipitationProbabilityPct: conducive ? 70 : 15,
      createdAt: OBSERVED_AT,
      updatedAt: OBSERVED_AT,
    };
  });
}

function createMoistureCell(
  {
    cellKey,
    rowIndex,
    columnIndex,
    rootZonePct,
    surfacePct,
  }: {
    cellKey: string;
    rowIndex: number;
    columnIndex: number;
    rootZonePct: number;
    surfacePct: number;
  },
): FieldMoistureCellSnapshot {
  const west = -109.6 + columnIndex * 0.02;
  const east = west + 0.02;
  const north = 51.3 - rowIndex * 0.02;
  const south = north - 0.02;

  return {
    id: `moisture-${cellKey}`,
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    snapshotId: "snapshot-1",
    observedAt: OBSERVED_AT,
    sourceKey: "moisture-grid-v1",
    cellKey,
    rowIndex,
    columnIndex,
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
    rootZonePct,
    surfacePct,
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

test("generateDiseaseRiskFindings creates an active tracked disease-risk finding for conducive canola flowering conditions", async () => {
  const runs = new InMemoryRunRepository();
  const findings = new InMemoryFindingRepository();
  const zones = new InMemoryZoneRepository();

  const result = await generateDiseaseRiskFindings({
    weatherSignalSets: {
      async getLatestByField() {
        return createWeatherSignalSet();
      },
    },
    weatherObservations: {
      async getLatestByField() {
        return createWeatherObservation();
      },
    },
    weatherForecasts: {
      async listByField() {
        return createForecasts(12);
      },
    },
    moistureCells: {
      async getLatestByField() {
        return [
          createMoistureCell({ cellKey: "a", rowIndex: 0, columnIndex: 0, rootZonePct: 28, surfacePct: 82 }),
          createMoistureCell({ cellKey: "b", rowIndex: 0, columnIndex: 1, rootZonePct: 30, surfacePct: 44 }),
          createMoistureCell({ cellKey: "c", rowIndex: 1, columnIndex: 0, rootZonePct: 31, surfacePct: 41 }),
          createMoistureCell({ cellKey: "d", rowIndex: 1, columnIndex: 1, rootZonePct: 29, surfacePct: 38 }),
        ];
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
  assert.equal(result.forecastSampleCount, 24);
  assert.equal(result.findings.length, 1);

  const finding = result.findings[0]!;
  const metadata = readMetadataRecord(finding.evidence.metadata);
  assert.equal(finding.family, "disease_risk");
  assert.equal(finding.status, "active");
  assert.equal(finding.severity, "high");
  assert.equal(finding.dedupeKey, "disease-risk:canola-sclerotinia");
  assert.equal(metadata.cropKey, "canola");
  assert.equal(metadata.growthStage, "flowering");
  assert.equal(metadata.diseaseZoneCellCount, 1);
  assert.equal(finding.evidence.trackedZones?.length, 1);
  assert.equal(finding.evidence.trackedZones?.[0]?.status, "new");
  assert.deepEqual(finding.affectedCellKeys, ["a"]);
  assert.equal(zones.upsertInputs.length, 1);
  assert.equal(zones.upsertInputs[0]?.status, "new");
  assert.equal(zones.upsertInputs[0]?.affectedCellKeys.length, 1);
  assert.equal(readMetadataRecord(runs.lastInput?.provenance).cropKey, "canola");
});

test("generateDiseaseRiskFindings resolves an existing active finding when forecast conditions fall below the activation threshold", async () => {
  const existingFinding = createFindingRecord({
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    runId: "previous-run",
    family: "disease_risk",
    severity: "high",
    status: "active",
    sourceKey: "disease-risk-generator:canola-sclerotinia:signal-v1",
    dedupeKey: "disease-risk:canola-sclerotinia",
    title: "Canola sclerotinia risk elevated",
    summary: "Existing active finding",
    explanation: "Existing explanation",
    recommendedAction: "Existing action",
    confidence: 0.8,
    affectedCellKeys: ["wet-a"],
    evidence: {
      trackedZones: [
        {
          zoneId: "zone-existing",
          trackingKey: "disease-risk:canola-sclerotinia",
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
    family: "disease_risk",
    trackingKey: "disease-risk:canola-sclerotinia",
    latestFindingId: "finding-existing",
    latestRunId: "previous-run",
    status: "persistent",
    latestSeverity: "high",
    zoneGeoJson: {
      type: "FeatureCollection",
      features: [],
    },
    affectedCellKeys: ["wet-a"],
    detectionCount: 2,
    firstSeenAt: "2026-03-27T05:00:00.000Z",
    lastSeenAt: "2026-03-27T05:00:00.000Z",
    lastStatusChangedAt: "2026-03-27T05:00:00.000Z",
    metadata: { zoneKey: "zone-1" },
  });

  const findings = new InMemoryFindingRepository([existingFinding]);
  const zones = new InMemoryZoneRepository([existingZone]);

  const result = await generateDiseaseRiskFindings({
    weatherSignalSets: {
      async getLatestByField() {
        return createWeatherSignalSet({
          leafWetHours24h: 2,
        });
      },
    },
    weatherObservations: {
      async getLatestByField() {
        return createWeatherObservation();
      },
    },
    weatherForecasts: {
      async listByField() {
        return createForecasts(2);
      },
    },
    moistureCells: {
      async getLatestByField() {
        return [createMoistureCell({ cellKey: "wet-a", rowIndex: 0, columnIndex: 0, rootZonePct: 32, surfacePct: 76 })];
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
  assert.equal(finding.evidence.trackedZones?.length, 1);
  assert.equal(finding.evidence.trackedZones?.[0]?.status, "recovering");
  assert.equal(zones.upsertInputs.length, 1);
  assert.equal(zones.upsertInputs[0]?.status, "recovering");
  assert.deepEqual(finding.affectedCellKeys, []);
});
