import type { FieldHailEvent } from "@fieldpulse/module-hail";
import type {
  FieldMoistureCellSnapshot,
  FieldMoistureCellSnapshotRepository,
} from "@fieldpulse/module-moisture";
import type { TimestampIso, WorkspaceId } from "@fieldpulse/platform-db";
import { isPointInPolygonalGeoJson, isPolygonalGeoJson } from "../domain/geojson/isPointInPolygonalGeoJson";
import type { CropIntelligenceRun } from "../contracts/CropIntelligenceRun";
import type { FieldIntelligenceFinding } from "../contracts/FieldIntelligenceFinding";
import type { UpsertCropIntelligenceRunInput } from "../contracts/UpsertCropIntelligenceRunInput";
import type { UpsertFieldIntelligenceFindingInput } from "../contracts/UpsertFieldIntelligenceFindingInput";

type ListFieldHailEventsRepository = {
  listByField(
    workspaceId: WorkspaceId,
    fieldId: string,
    limit?: number,
    reportedAfter?: string,
  ): Promise<readonly FieldHailEvent[]>;
};

type LoadFieldMoistureCellSnapshotsRepository = Pick<
  FieldMoistureCellSnapshotRepository,
  "getLatestByField"
>;

type UpsertCropIntelligenceRunRepository = {
  upsertRun(input: UpsertCropIntelligenceRunInput): Promise<CropIntelligenceRun>;
};

type UpsertFieldIntelligenceFindingRepository = {
  upsertFinding(
    input: UpsertFieldIntelligenceFindingInput,
  ): Promise<FieldIntelligenceFinding>;
};

const DEFAULT_SOURCE_KEY = "hail-risk-generator";
const DEFAULT_MODEL_KEY = "hail-risk-v1";
const DEFAULT_INPUT_VERSION = "hail-risk-v1";

export type GenerateHailRiskFindingsInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  requestedAt: TimestampIso;
  reportedAfter?: TimestampIso;
  limit?: number;
};

export type GenerateHailRiskFindingsResult = {
  run: CropIntelligenceRun;
  findings: readonly FieldIntelligenceFinding[];
  hailEventCount: number;
  moistureCellCount: number;
};

export type GenerateHailRiskFindingsUseCaseInput = {
  hailEvents: ListFieldHailEventsRepository;
  moistureCells: LoadFieldMoistureCellSnapshotsRepository;
  runs: UpsertCropIntelligenceRunRepository;
  findings: UpsertFieldIntelligenceFindingRepository;
  input: GenerateHailRiskFindingsInput;
};

function toFindingSeverity(
  severity: FieldHailEvent["severity"],
): UpsertFieldIntelligenceFindingInput["severity"] {
  switch (severity) {
    case "severe":
      return "critical";
    case "warning":
      return "high";
    case "watch":
      return "medium";
    case "advisory":
    default:
      return "low";
  }
}

function toConfidence(
  event: FieldHailEvent,
  affectedCellCount: number,
  moistureCellCount: number,
): number {
  const severityBase = {
    advisory: 0.52,
    watch: 0.66,
    warning: 0.81,
    severe: 0.92,
  }[event.severity];
  const coverageBoost = isPolygonalGeoJson(event.coverageGeoJson) ? 0.04 : 0;
  const cellCoverageRatio =
    moistureCellCount > 0 ? affectedCellCount / moistureCellCount : 0;
  const cellCoverageBoost = Math.min(0.04, cellCoverageRatio * 0.08);
  const hailSizeBoost = event.hailSizeMm && event.hailSizeMm >= 20 ? 0.03 : 0;

  return Math.min(0.98, severityBase + coverageBoost + cellCoverageBoost + hailSizeBoost);
}

function getAffectedCellKeys(
  event: FieldHailEvent,
  moistureCells: readonly FieldMoistureCellSnapshot[],
): readonly string[] {
  if (moistureCells.length === 0) {
    return [];
  }

  if (!isPolygonalGeoJson(event.coverageGeoJson)) {
    return moistureCells.map((cell) => cell.cellKey);
  }

  return moistureCells
    .filter((cell) => isPointInPolygonalGeoJson(cell.centroid, event.coverageGeoJson))
    .map((cell) => cell.cellKey);
}

function buildRecommendedAction(
  event: FieldHailEvent,
  affectedCellCount: number,
): string {
  const cellScope =
    affectedCellCount > 0
      ? `the ${affectedCellCount} mapped cell${affectedCellCount === 1 ? "" : "s"} in the impacted zone`
      : "the impacted field area";
  const hailDetail =
    event.hailSizeMm != null ? ` after hail up to ${event.hailSizeMm.toFixed(0)} mm` : "";

  return `Scout ${cellScope}${hailDetail}. Check bruising, stand loss, stem breakage, and defoliation before deciding on recovery action.`;
}

function buildExplanation(
  event: FieldHailEvent,
  affectedCellCount: number,
  moistureCellCount: number,
): string {
  const affectedScope =
    affectedCellCount > 0 && moistureCellCount > 0
      ? `${affectedCellCount} of ${moistureCellCount} current moisture cells fall inside the hail coverage zone`
      : "The hail event is field-scoped and should be treated as a field-wide risk until narrower zone evidence is available";
  const hailSize =
    event.hailSizeMm != null ? ` Hail size reported: ${event.hailSizeMm.toFixed(0)} mm.` : "";

  return `${affectedScope}.${hailSize}`.trim();
}

function buildSummary(
  event: FieldHailEvent,
  affectedCellCount: number,
): string {
  if (event.summary) {
    return event.summary;
  }

  if (affectedCellCount > 0) {
    return `Recent ${event.severity.replace("-", " ")} hail activity intersects ${affectedCellCount} mapped crop cells.`;
  }

  return `Recent ${event.severity.replace("-", " ")} hail activity was reported for this field.`;
}

function toFindingInput(
  event: FieldHailEvent,
  runId: string,
  moistureCells: readonly FieldMoistureCellSnapshot[],
): UpsertFieldIntelligenceFindingInput {
  const affectedCellKeys = getAffectedCellKeys(event, moistureCells);
  const moistureSnapshotId = moistureCells[0]?.snapshotId ?? null;
  const moistureCellCount = moistureCells.length;

  return {
    workspaceId: event.workspaceId,
    fieldId: event.fieldId,
    runId,
    family: "hail_risk",
    severity: toFindingSeverity(event.severity),
    status: "active",
    sourceKey: `${DEFAULT_SOURCE_KEY}:${event.sourceEventKey}`,
    dedupeKey: `hail-risk:${event.dedupeKey}`,
    title: event.headline,
    summary: buildSummary(event, affectedCellKeys.length),
    explanation: buildExplanation(event, affectedCellKeys.length, moistureCellCount),
    recommendedAction: buildRecommendedAction(event, affectedCellKeys.length),
    confidence: toConfidence(event, affectedCellKeys.length, moistureCellCount),
    zoneGeoJson: isPolygonalGeoJson(event.coverageGeoJson) ? event.coverageGeoJson : null,
    affectedCellKeys,
    evidence: {
      hailEventId: event.id,
      moistureSnapshotId,
      affectedCellKeys,
      datasetVersion: DEFAULT_INPUT_VERSION,
      providerKeys: [event.providerKey],
      metadata: {
        eventType: event.eventType,
        sourceKey: event.sourceKey,
        sourceEventKey: event.sourceEventKey,
        hailSeverity: event.severity,
        hailSizeMm: event.hailSizeMm,
        reportedAt: event.reportedAt,
        windowStart: event.windowStart,
        windowEnd: event.windowEnd,
        coverageMode: isPolygonalGeoJson(event.coverageGeoJson) ? "polygonal" : "field-wide",
      },
    },
    startedAt: event.windowStart ?? event.reportedAt,
    endedAt: null,
  };
}

export async function generateHailRiskFindings(
  input: GenerateHailRiskFindingsUseCaseInput,
): Promise<GenerateHailRiskFindingsResult> {
  const [hailEvents, moistureCells] = await Promise.all([
    input.hailEvents.listByField(
      input.input.workspaceId,
      input.input.fieldId,
      input.input.limit,
      input.input.reportedAfter,
    ),
    input.moistureCells.getLatestByField(
      input.input.workspaceId,
      input.input.fieldId,
    ),
  ]);

  const runInput: UpsertCropIntelligenceRunInput = {
    workspaceId: input.input.workspaceId,
    fieldId: input.input.fieldId,
    sourceKey: DEFAULT_SOURCE_KEY,
    modelKey: DEFAULT_MODEL_KEY,
    status: "completed",
    startedAt: input.input.requestedAt,
    completedAt: input.input.requestedAt,
    inputVersion: DEFAULT_INPUT_VERSION,
    provenance: {
      hailEventCount: hailEvents.length,
      moistureCellCount: moistureCells.length,
      reportedAfter: input.input.reportedAfter ?? null,
      hailEventIds: hailEvents.map((event) => event.id),
      moistureSnapshotId: moistureCells[0]?.snapshotId ?? null,
    },
  };

  const run = await input.runs.upsertRun(runInput);

  const findings = await Promise.all(
    hailEvents.map((event) =>
      input.findings.upsertFinding(toFindingInput(event, run.id, moistureCells)),
    ),
  );

  return {
    run,
    findings,
    hailEventCount: hailEvents.length,
    moistureCellCount: moistureCells.length,
  };
}
