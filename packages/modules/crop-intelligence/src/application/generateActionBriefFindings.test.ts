import test from "node:test";
import assert from "node:assert/strict";

import type { FieldMoistureSnapshot } from "@fieldpulse/module-moisture";
import type { FieldWeatherDerivedSignalSet } from "@fieldpulse/module-weather";
import type { JsonValue } from "@fieldpulse/platform-db";
import type { CropIntelligenceRun } from "../contracts/CropIntelligenceRun";
import type { FieldIntelligenceFinding } from "../contracts/FieldIntelligenceFinding";
import type { UpsertCropIntelligenceRunInput } from "../contracts/UpsertCropIntelligenceRunInput";
import type { UpsertFieldIntelligenceFindingInput } from "../contracts/UpsertFieldIntelligenceFindingInput";
import { generateActionBriefFindings } from "./generateActionBriefFindings";

function readMetadataRecord(value: JsonValue | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, JsonValue>;
}

function createSnapshot(input: {
  id: string;
  observedAt: string;
  rootZonePct: number;
  confidence?: "high" | "medium" | "low";
  derivationMode?: "source-backed" | "seeded-range";
  rasterMode?: "provider" | "synthetic" | "none";
  signalBlend?: "raster+weather" | "raster-only" | "weather-only" | "seeded";
  freshnessFactor?: number;
}): FieldMoistureSnapshot {
  return {
    id: input.id,
    workspaceId: "workspace-1",
    fieldId: "field-1",
    observedAt: input.observedAt,
    sourceKey: "moisture:model",
    rootZonePct: input.rootZonePct,
    surfacePct: input.rootZonePct - 8,
    confidence: input.confidence ?? "high",
    inputs: {
      derivationMode: input.derivationMode ?? "source-backed",
      rasterMode: input.rasterMode ?? "provider",
      signalBlend: input.signalBlend ?? "raster+weather",
      freshnessFactor: input.freshnessFactor,
    },
    createdAt: input.observedAt,
  };
}

function createWeatherSignals(): FieldWeatherDerivedSignalSet {
  return {
    id: "signals-1",
    workspaceId: "workspace-1",
    fieldId: "field-1",
    weatherObservationId: "weather-1",
    observedAt: "2026-04-02T12:00:00.000Z",
    forecastRunAt: "2026-04-02T12:00:00.000Z",
    sourceKey: "weather:derived",
    providerKey: "open-meteo",
    signalVersion: "v1",
    currentVpdKpa: 1.2,
    peakForecastVpdKpa24h: 2.1,
    netWaterBalance24hMm: -4.6,
    netWaterBalance72hMm: -9.3,
    leafWetHours24h: 1,
    sprayWindowCount24h: 2,
    frostRiskMinTempC: null,
    frostRiskMinTempC7d: null,
    frostRiskNights7d: 0,
    frostProbabilityPct7d: null,
    recentPrecipTotal72hMm: 3.2,
    freezeThawCycles7d: 0,
    soilTemp6cmCurrentC: 8.4,
    soilTemp6cmSustainedDays: 3,
    gdd24h: 6.2,
    gdd72h: 17.9,
    gddBaseC: 5,
    provenance: {},
    createdAt: "2026-04-02T12:00:00.000Z",
    updatedAt: "2026-04-02T12:00:00.000Z",
  };
}

class FakeRunRepository {
  async upsertRun(input: UpsertCropIntelligenceRunInput): Promise<CropIntelligenceRun> {
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
      provenance: input.provenance ?? null,
      createdAt: input.startedAt,
      updatedAt: input.completedAt ?? input.startedAt,
    };
  }
}

class FakeFindingRepository {
  readonly upsertInputs: UpsertFieldIntelligenceFindingInput[] = [];

  constructor(
    private readonly existing: FieldIntelligenceFinding | null = null,
  ) {}

  async getByDedupeKey() {
    return this.existing;
  }

  async upsertFinding(
    input: UpsertFieldIntelligenceFindingInput,
  ): Promise<FieldIntelligenceFinding> {
    this.upsertInputs.push(input);
    return {
      id: `finding-${this.upsertInputs.length}`,
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
}

test("generateActionBriefFindings creates an active action brief when root-zone moisture shifts materially", async () => {
  const findingRepository = new FakeFindingRepository();

  const result = await generateActionBriefFindings({
    moistureSnapshots: {
      async listRecentByField() {
        return [
          createSnapshot({
            id: "snapshot-latest",
            observedAt: "2026-04-02T12:00:00.000Z",
            rootZonePct: 33,
          }),
          createSnapshot({
            id: "snapshot-previous",
            observedAt: "2026-03-30T12:00:00.000Z",
            rootZonePct: 46,
          }),
        ];
      },
    },
    weatherSignalSets: {
      async getLatestByField() {
        return createWeatherSignals();
      },
    },
    runs: new FakeRunRepository(),
    findings: findingRepository,
    input: {
      workspaceId: "workspace-1",
      fieldId: "field-1",
      requestedAt: "2026-04-02T12:05:00.000Z",
    },
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.family, "action_brief");
  assert.equal(result.findings[0]?.status, "active");
  assert.equal(result.findings[0]?.severity, "medium");
  assert.match(result.findings[0]?.title ?? "", /Field changed materially since last review/);
  assert.match(result.findings[0]?.summary ?? "", /Root-zone moisture moved down 13\.0 pts/);
  assert.equal(
    readMetadataRecord(result.findings[0]?.evidence?.metadata).reasonCode,
    "material-drydown",
  );
  assert.equal(findingRepository.upsertInputs[0]?.dedupeKey, "action-brief:material-change:v1");
});

test("generateActionBriefFindings resolves an active action brief when the change falls below threshold", async () => {
  const existingFinding: FieldIntelligenceFinding = {
    id: "finding-existing",
    workspaceId: "workspace-1",
    fieldId: "field-1",
    runId: "run-prev",
    family: "action_brief",
    severity: "medium",
    status: "active",
    sourceKey: "action-brief-generator:moisture:model",
    dedupeKey: "action-brief:material-change:v1",
    title: "Field changed materially since last review",
    summary: "Previous alert",
    explanation: null,
    recommendedAction: null,
    confidence: 0.72,
    zoneGeoJson: null,
    affectedCellKeys: [],
    evidence: {},
    startedAt: "2026-03-30T12:00:00.000Z",
    endedAt: null,
    createdAt: "2026-03-30T12:00:00.000Z",
    updatedAt: "2026-03-30T12:00:00.000Z",
  };
  const findingRepository = new FakeFindingRepository(existingFinding);

  const result = await generateActionBriefFindings({
    moistureSnapshots: {
      async listRecentByField() {
        return [
          createSnapshot({
            id: "snapshot-latest",
            observedAt: "2026-04-02T12:00:00.000Z",
            rootZonePct: 41,
          }),
          createSnapshot({
            id: "snapshot-previous",
            observedAt: "2026-03-30T12:00:00.000Z",
            rootZonePct: 46,
          }),
        ];
      },
    },
    weatherSignalSets: {
      async getLatestByField() {
        return createWeatherSignals();
      },
    },
    runs: new FakeRunRepository(),
    findings: findingRepository,
    input: {
      workspaceId: "workspace-1",
      fieldId: "field-1",
      requestedAt: "2026-04-02T12:05:00.000Z",
    },
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.status, "resolved");
  assert.match(result.findings[0]?.title ?? "", /Field stabilized after recent change/);
  assert.equal(
    readMetadataRecord(result.findings[0]?.evidence?.metadata).reasonCode,
    "stabilized",
  );
  assert.equal(result.findings[0]?.endedAt, "2026-04-02T12:05:00.000Z");
});

test("generateActionBriefFindings suppresses the alert when the latest snapshot is stale", async () => {
  const findingRepository = new FakeFindingRepository();

  const result = await generateActionBriefFindings({
    moistureSnapshots: {
      async listRecentByField() {
        return [
          createSnapshot({
            id: "snapshot-latest",
            observedAt: "2026-03-28T12:00:00.000Z",
            rootZonePct: 33,
          }),
          createSnapshot({
            id: "snapshot-previous",
            observedAt: "2026-03-24T12:00:00.000Z",
            rootZonePct: 46,
          }),
        ];
      },
    },
    weatherSignalSets: {
      async getLatestByField() {
        return createWeatherSignals();
      },
    },
    runs: new FakeRunRepository(),
    findings: findingRepository,
    input: {
      workspaceId: "workspace-1",
      fieldId: "field-1",
      requestedAt: "2026-04-02T12:05:00.000Z",
    },
  });

  assert.equal(result.findings.length, 0);
  assert.equal(result.moistureSnapshotId, null);
  assert.equal(findingRepository.upsertInputs.length, 0);
});

test("generateActionBriefFindings suppresses the alert when the latest snapshot is low confidence", async () => {
  const findingRepository = new FakeFindingRepository();

  const result = await generateActionBriefFindings({
    moistureSnapshots: {
      async listRecentByField() {
        return [
          createSnapshot({
            id: "snapshot-latest",
            observedAt: "2026-04-02T12:00:00.000Z",
            rootZonePct: 33,
            confidence: "low",
          }),
          createSnapshot({
            id: "snapshot-previous",
            observedAt: "2026-03-30T12:00:00.000Z",
            rootZonePct: 46,
          }),
        ];
      },
    },
    weatherSignalSets: {
      async getLatestByField() {
        return createWeatherSignals();
      },
    },
    runs: new FakeRunRepository(),
    findings: findingRepository,
    input: {
      workspaceId: "workspace-1",
      fieldId: "field-1",
      requestedAt: "2026-04-02T12:05:00.000Z",
    },
  });

  assert.equal(result.findings.length, 0);
  assert.equal(result.moistureSnapshotId, null);
  assert.equal(findingRepository.upsertInputs.length, 0);
});
