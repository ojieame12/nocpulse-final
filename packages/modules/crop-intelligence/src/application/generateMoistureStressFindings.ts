import type { FieldWeatherDerivedSignalSet } from "@fieldpulse/module-weather";
import type {
  FieldMoistureCellSnapshot,
  FieldMoistureCellSnapshotRepository,
  FieldMoistureSnapshot,
  FieldMoistureSnapshotRepository,
} from "@fieldpulse/module-moisture";
import type { WorkspaceId } from "@fieldpulse/platform-db";
import type { CropContextInput } from "../contracts/CropContext";
import type { CropIntelligenceRun } from "../contracts/CropIntelligenceRun";
import type { FieldIntelligenceFinding } from "../contracts/FieldIntelligenceFinding";
import type { FieldIntelligenceZone } from "../contracts/FieldIntelligenceZone";
import type { RulePack } from "../contracts/RulePack";
import type { UpsertFieldIntelligenceZoneInput } from "../contracts/UpsertFieldIntelligenceZoneInput";
import type { UpsertCropIntelligenceRunInput } from "../contracts/UpsertCropIntelligenceRunInput";
import type { UpsertFieldIntelligenceFindingInput } from "../contracts/UpsertFieldIntelligenceFindingInput";
import { buildZoneFeatureCollectionFromCells } from "../domain/geojson/buildZoneFeatureCollectionFromCells";
import { buildTrackedZoneReferences } from "../domain/zones/buildTrackedZoneReferences";
import { clusterGridCells } from "../domain/zones/clusterGridCells";
import { resolveCropRuleContext } from "./resolveCropRuleContext";
import { syncFindingZones } from "./syncFindingZones";

const DEFAULT_SOURCE_KEY = "moisture-stress-generator";
const DEFAULT_MODEL_KEY = "moisture-stress-v1";

type LoadFieldMoistureSnapshotsRepository = Pick<
  FieldMoistureSnapshotRepository,
  "getLatestByField"
>;

type LoadFieldMoistureCellSnapshotsRepository = Pick<
  FieldMoistureCellSnapshotRepository,
  "getLatestByField"
>;

type LoadFieldWeatherSignalSetRepository = {
  getLatestByField(
    workspaceId: WorkspaceId,
    fieldId: string,
  ): Promise<FieldWeatherDerivedSignalSet | null>;
};

type UpsertCropIntelligenceRunRepository = {
  upsertRun(input: UpsertCropIntelligenceRunInput): Promise<CropIntelligenceRun>;
};

type MoistureStressFindingRepository = {
  getByDedupeKey(
    workspaceId: string,
    fieldId: string,
    dedupeKey: string,
  ): Promise<FieldIntelligenceFinding | null>;
  upsertFinding(
    input: UpsertFieldIntelligenceFindingInput,
  ): Promise<FieldIntelligenceFinding>;
};
type MoistureStressZoneRepository = {
  listByTrackingKey(input: {
    workspaceId: string;
    fieldId: string;
    family: FieldIntelligenceFinding["family"];
    trackingKey: string;
  }): Promise<readonly FieldIntelligenceZone[]>;
  upsertZone(
    input: UpsertFieldIntelligenceZoneInput,
  ): Promise<FieldIntelligenceZone>;
};

export type GenerateMoistureStressFindingsInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  requestedAt: string;
  cropContext?: CropContextInput | null;
};

export type GenerateMoistureStressFindingsResult = {
  requestedAt: string;
  run: CropIntelligenceRun;
  findings: readonly FieldIntelligenceFinding[];
  moistureSnapshotId: string | null;
  moistureCellCount: number;
  weatherSignalSet: FieldWeatherDerivedSignalSet | null;
};

export type GenerateMoistureStressFindingsUseCaseInput = {
  moistureSnapshots: LoadFieldMoistureSnapshotsRepository;
  moistureCells: LoadFieldMoistureCellSnapshotsRepository;
  weatherSignalSets: LoadFieldWeatherSignalSetRepository;
  runs: UpsertCropIntelligenceRunRepository;
  findings: MoistureStressFindingRepository;
  zones: MoistureStressZoneRepository;
  input: GenerateMoistureStressFindingsInput;
  rulePack: RulePack;
};

type MoistureStressAssessment = {
  severity: UpsertFieldIntelligenceFindingInput["severity"];
  status: UpsertFieldIntelligenceFindingInput["status"];
  title: string;
  summary: string;
  explanation: string;
  recommendedAction: string;
  confidence: number;
  affectedCells: readonly FieldMoistureCellSnapshot[];
};

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function baseConfidence(snapshot: FieldMoistureSnapshot) {
  switch (snapshot.confidence) {
    case "high":
      return 0.82;
    case "medium":
      return 0.68;
    case "low":
    default:
      return 0.48;
  }
}

function toSeverity(input: {
  rootZonePct: number;
  affectedRatio: number;
  severeAffectedRatio: number;
  peakForecastVpdKpa24h: number | null;
  netWaterBalance24hMm: number | null;
  rulePack: RulePack["moistureStress"];
}): UpsertFieldIntelligenceFindingInput["severity"] | null {
  const { rulePack } = input;
  const vpd = input.peakForecastVpdKpa24h ?? 0;
  const balance = input.netWaterBalance24hMm ?? 0;

  if (
    input.rootZonePct <= rulePack.rootZoneCriticalPct &&
    vpd >= rulePack.severeVpdKpa &&
    balance <= rulePack.waterBalance24hSevereMm
  ) {
    return "critical";
  }

  if (
    input.rootZonePct <= rulePack.rootZoneCriticalPct ||
    input.severeAffectedRatio >= rulePack.severeAffectedCellRatio
  ) {
    return "high";
  }

  if (
    (input.rootZonePct <= rulePack.rootZoneMonitorPct &&
      vpd >= rulePack.elevatedVpdKpa &&
      balance <= rulePack.waterBalance24hMonitorMm) ||
    input.affectedRatio >= rulePack.minAffectedCellRatio
  ) {
    return "medium";
  }

  if (
    input.rootZonePct <= rulePack.rootZoneMonitorPct ||
    input.affectedRatio > 0
  ) {
    return "low";
  }

  return null;
}

function buildConfidence(input: {
  snapshot: FieldMoistureSnapshot;
  affectedRatio: number;
  weatherSignalSet: FieldWeatherDerivedSignalSet;
}) {
  const completenessBoost =
    input.weatherSignalSet.peakForecastVpdKpa24h != null &&
    input.weatherSignalSet.netWaterBalance24hMm != null
      ? 0.08
      : 0.03;
  const coverageBoost = Math.min(0.08, input.affectedRatio * 0.18);

  return Math.min(
    0.97,
    roundTo(baseConfidence(input.snapshot) + completenessBoost + coverageBoost, 3),
  );
}

function buildSummary(input: {
  severity: UpsertFieldIntelligenceFindingInput["severity"];
  snapshot: FieldMoistureSnapshot;
  affectedCells: readonly FieldMoistureCellSnapshot[];
  signalSet: FieldWeatherDerivedSignalSet;
}) {
  const cellsClause =
    input.affectedCells.length > 0
      ? `${input.affectedCells.length} mapped cell${input.affectedCells.length === 1 ? "" : "s"} are below the monitor threshold`
      : "field-wide root-zone moisture is below the monitor threshold";
  const vpdClause =
    input.signalSet.peakForecastVpdKpa24h != null
      ? `peak VPD ${input.signalSet.peakForecastVpdKpa24h.toFixed(2)} kPa`
      : "peak VPD unavailable";
  const balanceClause =
    input.signalSet.netWaterBalance24hMm != null
      ? `24h water balance ${input.signalSet.netWaterBalance24hMm.toFixed(1)} mm`
      : "24h water balance unavailable";

  return `${input.severity.toUpperCase()} moisture stress: ${cellsClause}; root zone ${input.snapshot.rootZonePct.toFixed(1)}%, ${vpdClause}, ${balanceClause}.`;
}

function buildExplanation(input: {
  snapshot: FieldMoistureSnapshot;
  signalSet: FieldWeatherDerivedSignalSet;
  affectedRatio: number;
  severeAffectedRatio: number;
  rulePack: RulePack["moistureStress"];
}) {
  return [
    `Rule pack ${input.rulePack.label} triggers moisture stress at root zone <= ${input.rulePack.rootZoneMonitorPct}% and critical stress at <= ${input.rulePack.rootZoneCriticalPct}%.`,
    `Current root-zone estimate is ${input.snapshot.rootZonePct.toFixed(1)}% with ${roundTo(input.affectedRatio * 100, 1)}% of mapped cells below ${input.rulePack.cellMonitorPct}%.`,
    `Peak 24h VPD is ${
      input.signalSet.peakForecastVpdKpa24h != null
        ? `${input.signalSet.peakForecastVpdKpa24h.toFixed(2)} kPa`
        : "unavailable"
    } and 24h net water balance is ${
      input.signalSet.netWaterBalance24hMm != null
        ? `${input.signalSet.netWaterBalance24hMm.toFixed(1)} mm`
        : "unavailable"
    }.`,
    `Severe cell coverage is ${roundTo(input.severeAffectedRatio * 100, 1)}%.`,
  ].join(" ");
}

function buildRecommendedAction(
  severity: UpsertFieldIntelligenceFindingInput["severity"],
  affectedCells: readonly FieldMoistureCellSnapshot[],
) {
  const scopedArea =
    affectedCells.length > 0
      ? `the ${affectedCells.length} driest mapped cell${affectedCells.length === 1 ? "" : "s"}`
      : "the field";

  switch (severity) {
    case "critical":
      return `Prioritize ${scopedArea} for immediate scouting. Check root-zone moisture, canopy roll, and recent evapotranspiration losses before committing further input or irrigation decisions.`;
    case "high":
      return `Scout ${scopedArea} within the next 24 hours and compare root-zone moisture with canopy stress before scheduling operations.`;
    case "medium":
      return `Monitor ${scopedArea} closely over the next pass and confirm whether drying continues under the current forecast.`;
    case "low":
    default:
      return `Track ${scopedArea} on the next refresh and watch for additional drying or rising atmospheric demand.`;
  }
}

function assessMoistureStress(input: {
  snapshot: FieldMoistureSnapshot;
  cells: readonly FieldMoistureCellSnapshot[];
  signalSet: FieldWeatherDerivedSignalSet;
  existing: FieldIntelligenceFinding | null;
  rulePack: RulePack;
}): MoistureStressAssessment | null {
  const thresholds = input.rulePack.moistureStress;
  const affectedCells = input.cells.filter(
    (cell) => cell.rootZonePct <= thresholds.cellMonitorPct,
  );
  const severeCells = input.cells.filter(
    (cell) => cell.rootZonePct <= thresholds.cellCriticalPct,
  );
  const affectedRatio =
    input.cells.length > 0 ? affectedCells.length / input.cells.length : 0;
  const severeAffectedRatio =
    input.cells.length > 0 ? severeCells.length / input.cells.length : 0;

  const severity = toSeverity({
    rootZonePct: input.snapshot.rootZonePct,
    affectedRatio,
    severeAffectedRatio,
    peakForecastVpdKpa24h: input.signalSet.peakForecastVpdKpa24h,
    netWaterBalance24hMm: input.signalSet.netWaterBalance24hMm,
    rulePack: thresholds,
  });

  if (!severity) {
    if (!input.existing || input.existing.status !== "active") {
      return null;
    }

    return {
      severity: "low",
      status: "resolved",
      title: "Moisture stress eased",
      summary:
        "The latest moisture snapshot no longer breaches the active moisture-stress thresholds.",
      explanation: `Root-zone moisture recovered to ${input.snapshot.rootZonePct.toFixed(1)}% and the current affected-cell ratio is ${roundTo(affectedRatio * 100, 1)}%.`,
      recommendedAction:
        "Keep monitoring the field, but the current moisture-stress alert no longer needs to stay active.",
      confidence: buildConfidence({
        snapshot: input.snapshot,
        affectedRatio,
        weatherSignalSet: input.signalSet,
      }),
      affectedCells,
    };
  }

  return {
    severity,
    status: "active",
    title:
      severity === "critical"
        ? "Critical moisture stress risk"
        : severity === "high"
          ? "Moisture stress intensifying"
          : severity === "medium"
            ? "Moisture stress building"
            : "Emerging moisture stress",
    summary: buildSummary({
      severity,
      snapshot: input.snapshot,
      affectedCells,
      signalSet: input.signalSet,
    }),
    explanation: buildExplanation({
      snapshot: input.snapshot,
      signalSet: input.signalSet,
      affectedRatio,
      severeAffectedRatio,
      rulePack: thresholds,
    }),
    recommendedAction: buildRecommendedAction(severity, affectedCells),
    confidence: buildConfidence({
      snapshot: input.snapshot,
      affectedRatio,
      weatherSignalSet: input.signalSet,
    }),
    affectedCells,
  };
}

export async function generateMoistureStressFindings(
  input: GenerateMoistureStressFindingsUseCaseInput,
): Promise<GenerateMoistureStressFindingsResult> {
  const [snapshot, cells, signalSet] = await Promise.all([
    input.moistureSnapshots.getLatestByField(
      input.input.workspaceId,
      input.input.fieldId,
    ),
    input.moistureCells.getLatestByField(
      input.input.workspaceId,
      input.input.fieldId,
    ),
    input.weatherSignalSets.getLatestByField(
      input.input.workspaceId,
      input.input.fieldId,
    ),
  ]);

  const dedupeKey = `moisture-stress:${input.rulePack.moistureStress.dedupeKey}`;
  const resolvedRules = resolveCropRuleContext({
    rulePack: input.rulePack,
    cropContext: input.input.cropContext,
  });
  const existing = await input.findings.getByDedupeKey(
    input.input.workspaceId,
    input.input.fieldId,
    dedupeKey,
  );

  const run = await input.runs.upsertRun({
    workspaceId: input.input.workspaceId,
    fieldId: input.input.fieldId,
    sourceKey: DEFAULT_SOURCE_KEY,
    modelKey: DEFAULT_MODEL_KEY,
    status: "completed",
    startedAt: input.input.requestedAt,
    completedAt: input.input.requestedAt,
    inputVersion: `${input.rulePack.id}:${input.rulePack.version}`,
    provenance: {
      moistureSnapshotId: snapshot?.id ?? null,
      moistureCellCount: cells.length,
      weatherSignalSetId: signalSet?.id ?? null,
      rulePackId: input.rulePack.id,
      rulePackVersion: input.rulePack.version,
      cropKey: resolvedRules.crop.cropKey,
      cropLabel: resolvedRules.crop.cropLabel,
      growthStage: resolvedRules.crop.growthStage,
      gddBaseC: resolvedRules.crop.gddBaseC,
      isGenericCrop: resolvedRules.crop.isGenericCrop,
    },
  });

  if (!snapshot || !signalSet) {
    return {
      requestedAt: input.input.requestedAt,
      run,
      findings: [],
      moistureSnapshotId: snapshot?.id ?? null,
      moistureCellCount: cells.length,
      weatherSignalSet: signalSet,
    };
  }

  const assessment = assessMoistureStress({
    snapshot,
    cells,
    signalSet,
    existing,
    rulePack: {
      ...input.rulePack,
      moistureStress: resolvedRules.moistureStress,
    },
  });

  if (!assessment) {
    return {
      requestedAt: input.input.requestedAt,
      run,
      findings: [],
      moistureSnapshotId: snapshot.id,
      moistureCellCount: cells.length,
      weatherSignalSet: signalSet,
    };
  }

  const zoneClusters = clusterGridCells(assessment.affectedCells);
  const zoneGeoJson =
    assessment.status === "active"
      ? buildZoneFeatureCollectionFromCells(zoneClusters)
      : null;
  const affectedCellKeys = assessment.affectedCells.map((cell) => cell.cellKey);
  const findingInput: UpsertFieldIntelligenceFindingInput = {
    workspaceId: input.input.workspaceId,
    fieldId: input.input.fieldId,
    runId: run.id,
    family: "moisture_stress",
    severity: assessment.severity,
    status: assessment.status,
    sourceKey: `${DEFAULT_SOURCE_KEY}:${signalSet.sourceKey}`,
    dedupeKey,
    title: assessment.title,
    summary: assessment.summary,
    explanation: assessment.explanation,
    recommendedAction: assessment.recommendedAction,
    confidence: assessment.confidence,
    zoneGeoJson,
    affectedCellKeys,
    evidence: {
      moistureSnapshotId: snapshot.id,
      weatherObservationId: signalSet.weatherObservationId ?? undefined,
      weatherSignalSetId: signalSet.id,
      affectedCellKeys,
      datasetVersion: `${input.rulePack.id}:${input.rulePack.version}`,
      providerKeys: [signalSet.providerKey],
      metadata: {
        rulePackId: input.rulePack.id,
        rulePackVersion: input.rulePack.version,
        cropKey: resolvedRules.crop.cropKey,
        cropLabel: resolvedRules.crop.cropLabel,
        growthStage: resolvedRules.crop.growthStage,
        gddBaseC: resolvedRules.crop.gddBaseC,
        isGenericCrop: resolvedRules.crop.isGenericCrop,
        rootZonePct: snapshot.rootZonePct,
        surfacePct: snapshot.surfacePct,
        signalVersion: signalSet.signalVersion,
        currentVpdKpa: signalSet.currentVpdKpa,
        peakForecastVpdKpa24h: signalSet.peakForecastVpdKpa24h,
        netWaterBalance24hMm: signalSet.netWaterBalance24hMm,
        netWaterBalance72hMm: signalSet.netWaterBalance72hMm,
        leafWetHours24h: signalSet.leafWetHours24h,
        sprayWindowCount24h: signalSet.sprayWindowCount24h,
        zoneClusterCount: zoneClusters.length,
        largestZoneCellCount:
          zoneClusters.length > 0 ? zoneClusters[0]!.cells.length : 0,
        zoneSelectionStrategy: "monitor-threshold-connected-cells",
      },
    },
    startedAt:
      existing && existing.status === "active"
        ? existing.startedAt
        : snapshot.observedAt,
    endedAt: assessment.status === "active" ? null : input.input.requestedAt,
  };
  const finding = await input.findings.upsertFinding(findingInput);

  const syncedZones = await syncFindingZones({
    repository: input.zones,
    finding,
    observedAt: snapshot.observedAt,
    zones: zoneClusters.map((cluster) => {
      const clusterGeoJson = buildZoneFeatureCollectionFromCells([cluster]);

      if (!clusterGeoJson) {
        throw new Error("[crop-intelligence] zone cluster could not be rendered");
      }

      return {
        zoneGeoJson: clusterGeoJson,
        affectedCellKeys: cluster.cells.map((cell) => cell.cellKey),
        metadata: {
          zoneKey: cluster.zoneKey,
          cellCount: cluster.cells.length,
          rowStart: cluster.rowStart,
          rowEnd: cluster.rowEnd,
          columnStart: cluster.columnStart,
          columnEnd: cluster.columnEnd,
          selectionStrategy: "monitor-threshold-connected-cells",
        },
      };
    }),
  });
  const trackedZones = buildTrackedZoneReferences(syncedZones);
  const enrichedFinding = await input.findings.upsertFinding({
    ...findingInput,
    evidence: {
      ...(findingInput.evidence ?? {}),
      trackedZones,
    },
  });

  return {
    requestedAt: input.input.requestedAt,
    run,
    findings: [enrichedFinding],
    moistureSnapshotId: snapshot.id,
    moistureCellCount: cells.length,
    weatherSignalSet: signalSet,
  };
}
