import test from "node:test";
import assert from "node:assert/strict";
import type { JsonValue } from "@fieldpulse/platform-db";
import type { FieldHailEvent } from "@fieldpulse/module-hail";
import type { FieldMoistureCellSnapshot } from "@fieldpulse/module-moisture";
import { generateHailRiskFindings } from "./generateHailRiskFindings";
import type { CropIntelligenceRun } from "../contracts/CropIntelligenceRun";
import type { FieldIntelligenceFinding } from "../contracts/FieldIntelligenceFinding";
import type { UpsertCropIntelligenceRunInput } from "../contracts/UpsertCropIntelligenceRunInput";
import type { UpsertFieldIntelligenceFindingInput } from "../contracts/UpsertFieldIntelligenceFindingInput";

const WORKSPACE_ID = "workspace-1";
const FIELD_ID = "field-1";
const REPORTED_AT = "2026-03-28T05:00:00.000Z";
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

function createMoistureCell(input: {
  cellKey: string;
  rowIndex: number;
  columnIndex: number;
  centroid: readonly [number, number];
}): FieldMoistureCellSnapshot {
  const [longitude, latitude] = input.centroid;
  const west = longitude - 0.005;
  const east = longitude + 0.005;
  const south = latitude - 0.005;
  const north = latitude + 0.005;

  return {
    id: `moisture-${input.cellKey}`,
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    snapshotId: "snapshot-1",
    observedAt: REPORTED_AT,
    sourceKey: "moisture-grid-v1",
    cellKey: input.cellKey,
    rowIndex: input.rowIndex,
    columnIndex: input.columnIndex,
    centroid: [longitude, latitude],
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
    rootZonePct: 41,
    surfacePct: 35,
    confidence: "high",
    createdAt: REPORTED_AT,
  };
}

function createHailEvent(
  overrides: Partial<FieldHailEvent> = {},
): FieldHailEvent {
  return {
    id: "hail-1",
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    providerKey: "environment-canada-cap",
    sourceKey: "xweather-hail-v1",
    sourceEventKey: "event-1",
    dedupeKey: "event-1",
    eventType: "observed",
    severity: "warning",
    reportedAt: REPORTED_AT,
    windowStart: "2026-03-28T04:30:00.000Z",
    windowEnd: "2026-03-28T04:45:00.000Z",
    headline: "Storm cell reported damaging hail",
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
    ...overrides,
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
  readonly upsertInputs: UpsertFieldIntelligenceFindingInput[] = [];

  async upsertFinding(
    input: UpsertFieldIntelligenceFindingInput,
  ): Promise<FieldIntelligenceFinding> {
    this.upsertInputs.push(input);
    return createFindingRecord(input);
  }
}

test("generateHailRiskFindings creates an active hail-risk finding for polygonal severe hail coverage", async () => {
  const runs = new InMemoryRunRepository();
  const findings = new InMemoryFindingRepository();
  const moistureCells = [
    createMoistureCell({
      cellKey: "cell-a",
      rowIndex: 0,
      columnIndex: 0,
      centroid: [-109.59, 51.29],
    }),
    createMoistureCell({
      cellKey: "cell-b",
      rowIndex: 0,
      columnIndex: 1,
      centroid: [-109.56, 51.27],
    }),
    createMoistureCell({
      cellKey: "cell-c",
      rowIndex: 1,
      columnIndex: 0,
      centroid: [-109.47, 51.18],
    }),
  ] as const;

  const result = await generateHailRiskFindings({
    hailEvents: {
      async listByField() {
        return [
          createHailEvent({
            severity: "severe",
            hailSizeMm: 24,
            sourceEventKey: "event-severe",
            dedupeKey: "event-severe",
            headline: "Severe hail cell crossed the field",
          }),
        ];
      },
    },
    moistureCells: {
      async getLatestByField() {
        return moistureCells;
      },
    },
    runs,
    findings,
    input: {
      workspaceId: WORKSPACE_ID,
      fieldId: FIELD_ID,
      requestedAt: REQUESTED_AT,
      reportedAfter: "2026-03-28T00:00:00.000Z",
      limit: 5,
    },
  });

  assert.equal(result.run.status, "completed");
  assert.equal(result.hailEventCount, 1);
  assert.equal(result.moistureCellCount, 3);
  assert.equal(result.findings.length, 1);

  const finding = result.findings[0]!;
  const metadata = readMetadataRecord(finding.evidence.metadata);
  const provenance = readMetadataRecord(runs.lastInput?.provenance);

  assert.equal(finding.family, "hail_risk");
  assert.equal(finding.status, "active");
  assert.equal(finding.severity, "critical");
  assert.equal(finding.dedupeKey, "hail-risk:event-severe");
  assert.equal(finding.sourceKey, "hail-risk-generator:event-severe");
  assert.equal(finding.startedAt, "2026-03-28T04:30:00.000Z");
  assert.equal(finding.endedAt, null);
  assert.deepEqual(finding.affectedCellKeys, ["cell-a", "cell-b"]);
  assert.equal(finding.confidence, 0.98);
  assert.match(
    finding.summary ?? "",
    /2 mapped crop cells/i,
  );
  assert.match(
    finding.recommendedAction ?? "",
    /2 mapped cells/i,
  );
  assert.equal(metadata.hailSeverity, "severe");
  assert.equal(metadata.hailSizeMm, 24);
  assert.equal(metadata.coverageMode, "polygonal");
  assert.equal(metadata.sourceEventKey, "event-severe");
  assert.equal(provenance.hailEventCount, 1);
  assert.equal(provenance.moistureCellCount, 3);
  assert.equal(provenance.moistureSnapshotId, "snapshot-1");
  assert.deepEqual(provenance.hailEventIds, ["hail-1"]);
  assert.equal(findings.upsertInputs[0]?.zoneGeoJson != null, true);
});

test("generateHailRiskFindings falls back to field-wide hail scope when no coverage geometry is available", async () => {
  const result = await generateHailRiskFindings({
    hailEvents: {
      async listByField() {
        return [
          createHailEvent({
            severity: "advisory",
            sourceEventKey: "event-field-wide",
            dedupeKey: "event-field-wide",
            coverageGeoJson: null,
            summary: null,
            hailSizeMm: null,
            windowStart: null,
            headline: "Field-wide hail advisory remains active",
          }),
        ];
      },
    },
    moistureCells: {
      async getLatestByField() {
        return [] as const;
      },
    },
    runs: new InMemoryRunRepository(),
    findings: new InMemoryFindingRepository(),
    input: {
      workspaceId: WORKSPACE_ID,
      fieldId: FIELD_ID,
      requestedAt: REQUESTED_AT,
    },
  });

  assert.equal(result.findings.length, 1);

  const finding = result.findings[0]!;
  const metadata = readMetadataRecord(finding.evidence.metadata);

  assert.equal(finding.family, "hail_risk");
  assert.equal(finding.status, "active");
  assert.equal(finding.severity, "low");
  assert.equal(finding.startedAt, REPORTED_AT);
  assert.equal(finding.endedAt, null);
  assert.deepEqual(finding.affectedCellKeys, []);
  assert.equal(finding.zoneGeoJson, null);
  assert.equal(finding.confidence, 0.52);
  assert.match(
    finding.summary ?? "",
    /reported for this field/i,
  );
  assert.match(
    finding.explanation ?? "",
    /field-wide risk/i,
  );
  assert.equal(metadata.coverageMode, "field-wide");
  assert.equal(metadata.hailSizeMm, null);
  assert.equal(metadata.hailSeverity, "advisory");
});
