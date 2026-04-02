import type { FieldWeatherDerivedSignalSet } from "@fieldpulse/module-weather";
import type {
  FieldMoistureSnapshot,
  FieldMoistureSnapshotRepository,
} from "@fieldpulse/module-moisture";
import type { WorkspaceId } from "@fieldpulse/platform-db";
import type { CropIntelligenceRun } from "../contracts/CropIntelligenceRun";
import type { FieldIntelligenceFinding } from "../contracts/FieldIntelligenceFinding";
import type { UpsertCropIntelligenceRunInput } from "../contracts/UpsertCropIntelligenceRunInput";
import type { UpsertFieldIntelligenceFindingInput } from "../contracts/UpsertFieldIntelligenceFindingInput";

const DEFAULT_SOURCE_KEY = "action-brief-generator";
const DEFAULT_MODEL_KEY = "action-brief-v1";
const ACTION_BRIEF_DEDUPE_KEY = "action-brief:material-change:v1";
const MAX_COMPARISON_AGE_HOURS = 24 * 14;
const MIN_DELTA_PCT = 8;
const MEDIUM_DELTA_PCT = 12;
const HIGH_DELTA_PCT = 18;

type LoadFieldMoistureSnapshotsRepository = Pick<
  FieldMoistureSnapshotRepository,
  "listRecentByField"
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

type ActionBriefFindingRepository = {
  getByDedupeKey(
    workspaceId: string,
    fieldId: string,
    dedupeKey: string,
  ): Promise<FieldIntelligenceFinding | null>;
  upsertFinding(
    input: UpsertFieldIntelligenceFindingInput,
  ): Promise<FieldIntelligenceFinding>;
};

export type GenerateActionBriefFindingsInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  requestedAt: string;
};

export type GenerateActionBriefFindingsResult = {
  requestedAt: string;
  run: CropIntelligenceRun;
  findings: readonly FieldIntelligenceFinding[];
  moistureSnapshotId: string | null;
  previousMoistureSnapshotId: string | null;
  weatherSignalSet: FieldWeatherDerivedSignalSet | null;
};

export type GenerateActionBriefFindingsUseCaseInput = {
  moistureSnapshots: LoadFieldMoistureSnapshotsRepository;
  weatherSignalSets: LoadFieldWeatherSignalSetRepository;
  runs: UpsertCropIntelligenceRunRepository;
  findings: ActionBriefFindingRepository;
  input: GenerateActionBriefFindingsInput;
};

type ActionBriefAssessment = {
  severity: UpsertFieldIntelligenceFindingInput["severity"];
  status: UpsertFieldIntelligenceFindingInput["status"];
  title: string;
  summary: string;
  explanation: string;
  recommendedAction: string;
  confidence: number;
  latestSnapshot: FieldMoistureSnapshot;
  previousSnapshot: FieldMoistureSnapshot;
  deltaPct: number;
};

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function toConfidenceScore(
  confidence: FieldMoistureSnapshot["confidence"],
) {
  switch (confidence) {
    case "high":
      return 0.84;
    case "medium":
      return 0.72;
    case "low":
    default:
      return 0.56;
  }
}

function isComparableSnapshot(snapshot: FieldMoistureSnapshot) {
  return (
    snapshot.inputs.derivationMode === "source-backed" &&
    (snapshot.confidence === "high" || snapshot.confidence === "medium")
  );
}

function classifySeverity(deltaPct: number) {
  const magnitude = Math.abs(deltaPct);

  if (magnitude >= HIGH_DELTA_PCT) {
    return "high" as const;
  }
  if (magnitude >= MEDIUM_DELTA_PCT) {
    return "medium" as const;
  }
  if (magnitude >= MIN_DELTA_PCT) {
    return "low" as const;
  }

  return null;
}

function buildSummary(input: {
  latestSnapshot: FieldMoistureSnapshot;
  previousSnapshot: FieldMoistureSnapshot;
  deltaPct: number;
}) {
  const direction = input.deltaPct < 0 ? "down" : "up";
  return `Root-zone moisture moved ${direction} ${Math.abs(input.deltaPct).toFixed(1)} pts since ${formatShortDate(input.previousSnapshot.observedAt)}. Current estimate ${input.latestSnapshot.rootZonePct.toFixed(1)}%.`;
}

function buildExplanation(input: {
  latestSnapshot: FieldMoistureSnapshot;
  previousSnapshot: FieldMoistureSnapshot;
  weatherSignalSet: FieldWeatherDerivedSignalSet | null;
  deltaPct: number;
}) {
  const balanceClause =
    input.weatherSignalSet?.netWaterBalance24hMm != null
      ? `24h water balance ${input.weatherSignalSet.netWaterBalance24hMm.toFixed(1)} mm.`
      : "24h water balance unavailable.";
  const vpdClause =
    input.weatherSignalSet?.peakForecastVpdKpa24h != null
      ? `Peak forecast VPD ${input.weatherSignalSet.peakForecastVpdKpa24h.toFixed(2)} kPa.`
      : "Peak forecast VPD unavailable.";

  return [
    `Latest source-backed snapshot measured ${input.latestSnapshot.rootZonePct.toFixed(1)}% on ${formatShortDate(input.latestSnapshot.observedAt)} (${input.latestSnapshot.confidence} confidence).`,
    `Previous comparable snapshot measured ${input.previousSnapshot.rootZonePct.toFixed(1)}% on ${formatShortDate(input.previousSnapshot.observedAt)} for a ${Math.abs(input.deltaPct).toFixed(1)} point change.`,
    `${balanceClause} ${vpdClause}`,
  ].join(" ");
}

function buildRecommendedAction(deltaPct: number) {
  if (deltaPct < 0) {
    return "Open the field and inspect the driest zones first before changing irrigation, spray timing, or moisture-driven decisions.";
  }

  return "Open the field and confirm whether the recharge is field-wide, how access conditions changed, and whether the wetter signal matches the latest forecast.";
}

function buildConfidence(input: {
  latestSnapshot: FieldMoistureSnapshot;
  previousSnapshot: FieldMoistureSnapshot;
  weatherSignalSet: FieldWeatherDerivedSignalSet | null;
  deltaPct: number;
}) {
  const base = Math.min(
    toConfidenceScore(input.latestSnapshot.confidence),
    toConfidenceScore(input.previousSnapshot.confidence),
  );
  const weatherBoost = input.weatherSignalSet ? 0.06 : 0;
  const deltaBoost = Math.min(0.08, Math.abs(input.deltaPct) / 200);

  return Math.min(0.96, roundTo(base + weatherBoost + deltaBoost, 3));
}

function assessActionBrief(input: {
  snapshots: readonly FieldMoistureSnapshot[];
  weatherSignalSet: FieldWeatherDerivedSignalSet | null;
  existing: FieldIntelligenceFinding | null;
  requestedAt: string;
}): ActionBriefAssessment | null {
  const latestSnapshot = input.snapshots.find(isComparableSnapshot) ?? null;

  if (!latestSnapshot) {
    return null;
  }

  const previousSnapshot =
    input.snapshots.find(
      (snapshot) =>
        snapshot.id !== latestSnapshot.id &&
        snapshot.observedAt < latestSnapshot.observedAt &&
        isComparableSnapshot(snapshot),
    ) ?? null;

  if (!previousSnapshot) {
    return null;
  }

  const comparisonAgeHours =
    (new Date(latestSnapshot.observedAt).getTime() -
      new Date(previousSnapshot.observedAt).getTime()) /
    3_600_000;

  if (!Number.isFinite(comparisonAgeHours) || comparisonAgeHours > MAX_COMPARISON_AGE_HOURS) {
    return null;
  }

  const deltaPct = roundTo(
    latestSnapshot.rootZonePct - previousSnapshot.rootZonePct,
    1,
  );
  const severity = classifySeverity(deltaPct);

  if (!severity) {
    if (!input.existing || input.existing.status !== "active") {
      return null;
    }

    return {
      severity: "low",
      status: "resolved",
      title: "Field stabilized after recent change",
      summary:
        "The latest comparable source-backed snapshot no longer exceeds the material-change threshold.",
      explanation: `Current root-zone moisture is ${latestSnapshot.rootZonePct.toFixed(1)}% versus ${previousSnapshot.rootZonePct.toFixed(1)}% on the previous comparable pass.`,
      recommendedAction:
        "Keep monitoring the field, but the material-change alert no longer needs to stay active.",
      confidence: buildConfidence({
        latestSnapshot,
        previousSnapshot,
        weatherSignalSet: input.weatherSignalSet,
        deltaPct,
      }),
      latestSnapshot,
      previousSnapshot,
      deltaPct,
    };
  }

  return {
    severity,
    status: "active",
    title: "Field changed materially since last review",
    summary: buildSummary({
      latestSnapshot,
      previousSnapshot,
      deltaPct,
    }),
    explanation: buildExplanation({
      latestSnapshot,
      previousSnapshot,
      weatherSignalSet: input.weatherSignalSet,
      deltaPct,
    }),
    recommendedAction: buildRecommendedAction(deltaPct),
    confidence: buildConfidence({
      latestSnapshot,
      previousSnapshot,
      weatherSignalSet: input.weatherSignalSet,
      deltaPct,
    }),
    latestSnapshot,
    previousSnapshot,
    deltaPct,
  };
}

export async function generateActionBriefFindings(
  input: GenerateActionBriefFindingsUseCaseInput,
): Promise<GenerateActionBriefFindingsResult> {
  const [snapshots, weatherSignalSet] = await Promise.all([
    input.moistureSnapshots.listRecentByField(
      input.input.workspaceId,
      input.input.fieldId,
      8,
    ),
    input.weatherSignalSets.getLatestByField(
      input.input.workspaceId,
      input.input.fieldId,
    ),
  ]);

  const existing = await input.findings.getByDedupeKey(
    input.input.workspaceId,
    input.input.fieldId,
    ACTION_BRIEF_DEDUPE_KEY,
  );

  const assessment = assessActionBrief({
    snapshots,
    weatherSignalSet,
    existing,
    requestedAt: input.input.requestedAt,
  });

  const latestSnapshot = assessment?.latestSnapshot ?? snapshots.find(isComparableSnapshot) ?? null;
  const previousSnapshot = assessment?.previousSnapshot ?? null;

  const run = await input.runs.upsertRun({
    workspaceId: input.input.workspaceId,
    fieldId: input.input.fieldId,
    sourceKey: DEFAULT_SOURCE_KEY,
    modelKey: DEFAULT_MODEL_KEY,
    status: "completed",
    startedAt: input.input.requestedAt,
    completedAt: input.input.requestedAt,
    inputVersion: "action-brief@1",
    provenance: {
      moistureSnapshotId: latestSnapshot?.id ?? null,
      previousMoistureSnapshotId: previousSnapshot?.id ?? null,
      weatherSignalSetId: weatherSignalSet?.id ?? null,
      trigger: "material-change-since-last-review",
      deltaPct: assessment?.deltaPct ?? null,
    },
  });

  if (!assessment || !latestSnapshot || !previousSnapshot) {
    return {
      requestedAt: input.input.requestedAt,
      run,
      findings: [],
      moistureSnapshotId: latestSnapshot?.id ?? null,
      previousMoistureSnapshotId: previousSnapshot?.id ?? null,
      weatherSignalSet,
    };
  }

  const findingInput: UpsertFieldIntelligenceFindingInput = {
    workspaceId: input.input.workspaceId,
    fieldId: input.input.fieldId,
    runId: run.id,
    family: "action_brief",
    severity: assessment.severity,
    status: assessment.status,
    sourceKey: `${DEFAULT_SOURCE_KEY}:${latestSnapshot.sourceKey}`,
    dedupeKey: ACTION_BRIEF_DEDUPE_KEY,
    title: assessment.title,
    summary: assessment.summary,
    explanation: assessment.explanation,
    recommendedAction: assessment.recommendedAction,
    confidence: assessment.confidence,
    zoneGeoJson: null,
    affectedCellKeys: [],
    evidence: {
      moistureSnapshotId: latestSnapshot.id,
      weatherSignalSetId: weatherSignalSet?.id ?? undefined,
      metadata: {
        trigger: "material-change-since-last-review",
        latestSnapshotId: latestSnapshot.id,
        previousSnapshotId: previousSnapshot.id,
        latestObservedAt: latestSnapshot.observedAt,
        previousObservedAt: previousSnapshot.observedAt,
        latestRootZonePct: latestSnapshot.rootZonePct,
        previousRootZonePct: previousSnapshot.rootZonePct,
        deltaPct: assessment.deltaPct,
        latestConfidence: latestSnapshot.confidence,
        previousConfidence: previousSnapshot.confidence,
        latestDerivationMode: latestSnapshot.inputs.derivationMode ?? null,
        previousDerivationMode: previousSnapshot.inputs.derivationMode ?? null,
        netWaterBalance24hMm: weatherSignalSet?.netWaterBalance24hMm ?? null,
        peakForecastVpdKpa24h: weatherSignalSet?.peakForecastVpdKpa24h ?? null,
      },
    },
    startedAt:
      existing && existing.status === "active"
        ? existing.startedAt
        : latestSnapshot.observedAt,
    endedAt: assessment.status === "active" ? null : input.input.requestedAt,
  };

  const finding = await input.findings.upsertFinding(findingInput);

  return {
    requestedAt: input.input.requestedAt,
    run,
    findings: [finding],
    moistureSnapshotId: latestSnapshot.id,
    previousMoistureSnapshotId: previousSnapshot.id,
    weatherSignalSet,
  };
}
