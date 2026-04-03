import { resolveMetricModeContract } from "@fieldpulse/map/server";
import {
  buildFieldActionCurationVersion,
  prairieDefaultRulePack,
  resolveCropRuleContext,
  type FieldActionCuration,
} from "@fieldpulse/module-crop-intelligence";
import type {
  ActionQAItem,
  ActionTag,
  FieldActionProps,
  FieldIntelligenceSource,
  FieldIntelligenceState,
} from "../../components/panels/ActionTab";
import {
  extractTrackedZoneIds,
  formatHistoryLabel,
} from "./buildFieldOverviewViewModel.shared";
import { averageMeasurement } from "./buildFieldOverviewViewModel.raster";
import {
  resolveCanopySignalPresentation,
  resolveCropStagePresentation,
  resolveOpticalSeasonality,
} from "./buildFieldOverviewViewModel.cropSignals";
import {
  resolveFieldAccessPresentation,
  resolveSeedingRecommendation,
} from "./buildFieldOverviewViewModel.spring";
import { resolveSprayWindowRecommendation } from "./buildFieldOverviewViewModel.spray";

type ActionSignal = FieldActionProps["signals"][number];
type RankedActionSignal = ActionSignal & {
  key: string;
  score: number;
  group: string;
};

type ActiveIntelligenceEntry = {
  kind: "finding" | "alert";
  record: any;
  family: string;
  severityRank: number;
  trackedZoneCount: number;
  updatedAt: string | null;
  familyPriority: number;
};

function severityRank(value: string | null | undefined) {
  switch (value) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function severityLabel(value: string | null | undefined) {
  switch (value) {
    case "critical":
      return "Urgent";
    case "high":
      return "High";
    case "medium":
      return "Watch";
    case "low":
      return "Routine";
    default:
      return "Routine";
  }
}

function dueDateLabel(value: string | null | undefined) {
  switch (value) {
    case "critical":
    case "high":
      return "Within 24h";
    case "medium":
      return "Within 48h";
    case "low":
      return "This week";
    default:
      return "As available";
  }
}

function signalTagColor(
  severity: string | null | undefined,
): "red" | "yellow" | "green" {
  if (severity === "critical" || severity === "high") {
    return "red";
  }
  if (severity === "medium") {
    return "yellow";
  }
  return "green";
}

function signalColorFromAverage(
  value: number | null | undefined,
  thresholds: {
    warningFloor: number;
    healthyFloor: number;
  },
): "red" | "yellow" | "green" {
  if (value == null || !Number.isFinite(value)) {
    return "yellow";
  }

  if (value < thresholds.warningFloor) {
    return "red";
  }

  if (value < thresholds.healthyFloor) {
    return "yellow";
  }

  return "green";
}

function shortSourceLabel(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const parts = value.split(":");
  return parts.length > 1 ? parts.slice(-2).join(" · ") : value;
}

function dedupeSignals(signals: readonly ActionSignal[]) {
  return signals.filter(
    (signal, index, entries) =>
      entries.findIndex(
        (candidate) => candidate.label.trim().toLowerCase() === signal.label.trim().toLowerCase(),
      ) === index,
  );
}

function familyPriority(value: string | null | undefined) {
  switch (value) {
    case "hail_risk":
      return 5;
    case "moisture_stress":
      return 4;
    case "disease_risk":
      return 3;
    case "weather_risk":
      return 2;
    case "action_brief":
      return 1;
    case "crop_health":
      return 0;
    default:
      return 0;
  }
}

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function countTrackedZones(value: any) {
  const trackedZones = value?.evidence?.trackedZones;
  if (Array.isArray(trackedZones)) {
    return trackedZones.length;
  }

  return extractTrackedZoneIds(value?.evidence).length;
}

function rankActiveIntelligenceEntries(entries: readonly ActiveIntelligenceEntry[]) {
  return [...entries].sort((left, right) => {
    if (right.severityRank !== left.severityRank) {
      return right.severityRank - left.severityRank;
    }

    if (right.trackedZoneCount !== left.trackedZoneCount) {
      return right.trackedZoneCount - left.trackedZoneCount;
    }

    if (right.familyPriority !== left.familyPriority) {
      return right.familyPriority - left.familyPriority;
    }

    const updatedDelta = toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt);
    if (updatedDelta !== 0) {
      return updatedDelta;
    }

    if (left.kind !== right.kind) {
      return left.kind === "finding" ? -1 : 1;
    }

    return 0;
  });
}

function finalizeRankedSignals(signals: readonly RankedActionSignal[]) {
  const deduped = new Map<string, RankedActionSignal>();

  for (const signal of [...signals].sort((left, right) => right.score - left.score)) {
    const existing = deduped.get(signal.key);
    if (!existing || signal.score > existing.score) {
      deduped.set(signal.key, signal);
    }
  }

  return [...deduped.values()]
    .sort((left, right) => right.score - left.score)
    .map(({ key: _key, score: _score, group: _group, ...signal }) => signal);
}

function resolveIntelligenceSourceLabel(input: {
  state: FieldIntelligenceState;
  source: FieldIntelligenceSource;
}) {
  if (input.state === "none") {
    return "No active intelligence";
  }

  switch (input.source) {
    case "findings":
      return "Finding-backed";
    case "alerts":
      return "Alert-backed";
    case "heuristics":
      return "Heuristic watchlist";
    case "none":
    default:
      return input.state === "watchlist" ? "Heuristic watchlist" : "No active intelligence";
  }
}

function resolveIntelligenceFreshnessLabel(input: {
  state: FieldIntelligenceState;
  source: FieldIntelligenceSource;
  findingUpdatedAt?: string | null;
  alertUpdatedAt?: string | null;
  weatherUpdatedAt?: string | null;
  moistureObservedAt?: string | null;
}) {
  const freshestAt =
    input.findingUpdatedAt ??
    input.alertUpdatedAt ??
    input.weatherUpdatedAt ??
    input.moistureObservedAt ??
    null;

  if (!freshestAt) {
    return null;
  }

  const prefix =
    input.state === "active"
      ? input.source === "alerts"
        ? "Alert"
        : "Updated"
      : input.state === "watchlist"
        ? "Signals"
        : "Checked";

  return `${prefix} ${formatHistoryLabel(freshestAt)}`;
}

type WatchlistSummary = {
  title: string;
  severity: "medium" | "high";
  urgency: string;
  dueDate: string;
  recommendation: string;
  explanation: string;
  whyNow: string;
  inspectFirst: string;
  confidence: string;
  signals: readonly ActionSignal[];
  tags: readonly ActionTag[];
};

type BuildActionPropsOptions = {
  curation?: FieldActionCuration | null;
};

function isWatchlistEligibleForDataQuality(label: string | null | undefined) {
  return label == null || label === "Ready";
}

function buildWatchlistSummary(input: {
  moisture: any;
  weatherSignals: any;
  moistureSourceLabel: string;
  weatherSourceLabel: string;
  seedingRecommendation?: WatchlistSummary | null;
  sprayRecommendation?: WatchlistSummary | null;
}): WatchlistSummary | null {
  const candidates: Array<WatchlistSummary & { score: number }> = [];

  if (input.seedingRecommendation) {
    candidates.push({
      score:
        input.seedingRecommendation.urgency === "Ready"
          ? 5
          : input.seedingRecommendation.severity === "high"
            ? 6
            : 5,
      ...input.seedingRecommendation,
    });
  }

  if (input.sprayRecommendation) {
    candidates.push({
      score: 4,
      ...input.sprayRecommendation,
    });
  }

  if (
    typeof input.moisture?.rootZonePct === "number" &&
    Number.isFinite(input.moisture.rootZonePct) &&
    input.moisture.rootZonePct < 35
  ) {
    const rootZonePct = input.moisture.rootZonePct;
    const severity = rootZonePct < 25 ? "high" : "medium";
    candidates.push({
      score: severity === "high" ? 3 : 2,
      title: severity === "high" ? "Soil moisture watch" : "Dryness watch",
      severity,
      urgency: "Watch",
      dueDate: severity === "high" ? "Within 24h" : "Within 48h",
      recommendation:
        "Scout the driest part of the field and verify root-zone moisture decline before the next weather window.",
      explanation: `No confirmed finding is active yet. Root-zone moisture is ${rootZonePct.toFixed(1)}%, so this recommendation is advisory and based on current moisture heuristics rather than a tracked intelligence event.`,
      whyNow: `Root-zone moisture is ${rootZonePct.toFixed(1)}%, which has crossed the watch threshold for this field.`,
      inspectFirst:
        "Start with lighter or more exposed areas showing the driest root-zone moisture, then confirm whether the dry pocket is spreading.",
      confidence: input.moisture?.confidence
        ? `Heuristic watchlist · ${input.moisture.confidence} moisture`
        : "Heuristic watchlist",
      signals: [
        {
          label: `Soil moisture ${rootZonePct.toFixed(1)}%`,
          color: severity === "high" ? "red" : "yellow",
          detail: [
            typeof input.moisture?.surfacePct === "number"
              ? `Surface ${input.moisture.surfacePct.toFixed(1)}%`
              : null,
            input.moistureSourceLabel,
            input.moisture?.confidence ? `${input.moisture.confidence} confidence` : null,
          ]
            .filter((value): value is string => Boolean(value))
            .join(" · "),
        },
      ],
      tags: [
        { label: "Watchlist", color: "yellow" },
        { label: "Moisture", color: severity === "high" ? "red" : "yellow" },
      ],
    });
  }

  const frostMin =
    input.weatherSignals?.frostRiskMinTempC7d ??
    input.weatherSignals?.frostRiskMinTempC ??
    null;
  const frostRiskNights7d = input.weatherSignals?.frostRiskNights7d ?? null;
  const frostProbabilityPct7d = input.weatherSignals?.frostProbabilityPct7d ?? null;
  const frostHorizonLabel =
    input.weatherSignals?.frostRiskMinTempC7d != null ? "next 7d" : "next 24h";
  const frostDetailLabel =
    input.weatherSignals?.frostRiskMinTempC7d != null
      ? "Lowest forecast low"
      : "Next overnight minimum";
  const frostProbabilityLabel =
    frostProbabilityPct7d != null && Number.isFinite(frostProbabilityPct7d)
      ? `${Math.round(frostProbabilityPct7d)}% probability`
      : null;

  if (
    typeof frostMin === "number" &&
    Number.isFinite(frostMin) &&
    (frostMin <= 2 || (frostRiskNights7d ?? 0) > 0)
  ) {
    const severity = frostMin <= 0 ? "high" : "medium";
    candidates.push({
      score: severity === "high" ? 4 : 3,
      title:
        severity === "high"
          ? `Frost watch ${frostHorizonLabel}`
          : `Cold-risk watch ${frostHorizonLabel}`,
      severity,
      urgency: "Watch",
      dueDate: frostHorizonLabel === "next 7d" ? "Within 7d" : "Within 24h",
      recommendation:
        "Check low-lying and exposed parts of the field before the overnight low, and confirm crop-stage sensitivity before taking protective action.",
      explanation:
        frostRiskNights7d != null && frostRiskNights7d > 0
          ? `No confirmed finding is active yet. Forecast minimum temperature is ${frostMin.toFixed(1)}°C with ${frostRiskNights7d} frost-risk night${frostRiskNights7d === 1 ? "" : "s"} ${frostHorizonLabel}${frostProbabilityLabel ? ` and ${frostProbabilityLabel.toLowerCase()} of dropping below the crop damage threshold` : ""}, so this recommendation is advisory and based on weather watch thresholds rather than an active tracked finding.`
          : `No confirmed finding is active yet. Forecast minimum temperature is ${frostMin.toFixed(1)}°C ${frostHorizonLabel}${frostProbabilityLabel ? ` with ${frostProbabilityLabel.toLowerCase()} of dropping below the crop damage threshold` : ""}, so this recommendation is advisory and based on weather watch thresholds rather than an active tracked finding.`,
      whyNow:
        frostRiskNights7d != null && frostRiskNights7d > 0
          ? `${frostRiskNights7d} frost-risk night${frostRiskNights7d === 1 ? "" : "s"} are forecast ${frostHorizonLabel}, with the lowest low at ${frostMin.toFixed(1)}°C${frostProbabilityLabel ? ` and ${frostProbabilityLabel.toLowerCase()} below the crop damage threshold` : ""}.`
          : `Forecast minimum temperature is ${frostMin.toFixed(1)}°C ${frostHorizonLabel}${frostProbabilityLabel ? ` with ${frostProbabilityLabel.toLowerCase()} below the crop damage threshold` : ""}.`,
      inspectFirst:
        "Inspect frost-prone low spots and exposed edges first, then verify whether crop stage or residue cover changes the actual risk on the ground.",
      confidence: "Heuristic watchlist · weather-backed",
      signals: [
        {
          label: `Frost min ${frostMin.toFixed(1)}°C`,
          color: severity === "high" ? "red" : "yellow",
          detail: [
            frostRiskNights7d != null && frostRiskNights7d > 0
              ? `${frostRiskNights7d} frost-risk night${frostRiskNights7d === 1 ? "" : "s"} ${frostHorizonLabel}`
              : frostDetailLabel,
            frostProbabilityLabel,
            input.weatherSourceLabel,
          ]
            .filter((value): value is string => Boolean(value))
            .join(" · "),
        },
      ],
      tags: [
        { label: "Watchlist", color: "yellow" },
        { label: "Weather", color: severity === "high" ? "red" : "yellow" },
      ],
    });
  }

  if (
    typeof input.weatherSignals?.peakForecastVpdKpa24h === "number" &&
    Number.isFinite(input.weatherSignals.peakForecastVpdKpa24h) &&
    input.weatherSignals.peakForecastVpdKpa24h >= 1.2 &&
    (typeof input.weatherSignals?.netWaterBalance72hMm !== "number" ||
      input.weatherSignals.netWaterBalance72hMm <= 0)
  ) {
    const peakVpd = input.weatherSignals.peakForecastVpdKpa24h;
    const waterBalance72h = input.weatherSignals?.netWaterBalance72hMm ?? null;
    const severity = peakVpd >= 2 ? "high" : "medium";
    candidates.push({
      score: severity === "high" ? 2 : 1,
      title:
        severity === "high"
          ? "Atmospheric drying watch"
          : "Evaporative demand watch",
      severity,
      urgency: "Watch",
      dueDate: "Within 48h",
      recommendation:
        "Inspect lighter-ground and exposed areas for fast drying before changing field operations uniformly.",
      explanation: `No confirmed finding is active yet. Peak forecast crop water demand (VPD) is ${peakVpd.toFixed(1)} kPa${typeof waterBalance72h === "number" ? ` with a 72-hour water balance of ${waterBalance72h.toFixed(1)} mm` : ""}, so this recommendation is advisory and based on atmospheric-demand heuristics.`,
      whyNow: `Peak forecast crop water demand (VPD) reaches ${peakVpd.toFixed(1)} kPa${typeof waterBalance72h === "number" ? ` and the 72-hour water balance is ${waterBalance72h.toFixed(1)} mm` : ""}.`,
      inspectFirst:
        "Start with lighter-ground pockets and exposed edges where atmospheric demand usually hits first, then compare against the latest moisture refresh.",
      confidence: "Heuristic watchlist · weather-backed",
      signals: [
        {
          label: `Water demand ${peakVpd.toFixed(1)} kPa`,
          color: severity === "high" ? "red" : "yellow",
          detail: [
            typeof waterBalance72h === "number"
              ? `72h balance ${waterBalance72h.toFixed(1)} mm`
              : null,
            input.weatherSourceLabel,
          ]
            .filter((value): value is string => Boolean(value))
            .join(" · "),
        },
      ],
      tags: [
        { label: "Watchlist", color: "yellow" },
        { label: "Weather", color: severity === "high" ? "red" : "yellow" },
      ],
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => right.score - left.score);
  return candidates[0];
}

export function buildActionProps(
  rm: any,
  fieldName: string,
  options: BuildActionPropsOptions = {},
): FieldActionProps {
  const findings = (rm.findings ?? []).filter((finding: any) => finding.status === "active");
  const alerts = (rm.alerts ?? []).filter((alert: any) => alert.status === "active");
  const cropContext = rm.cropContext ?? null;
  const defaultCropRules = resolveCropRuleContext({
    rulePack: prairieDefaultRulePack,
    cropContext: {
      cropType: cropContext?.cropType ?? rm.summary?.cropType ?? null,
      growthStage: null,
    },
  });
  const cropStagePresentation = resolveCropStagePresentation({
    cropContext,
    fallbackGrowthStage: rm.summary?.growthStage ?? null,
    defaultGrowthStage: defaultCropRules.crop.growthStage,
    gddBaseC: defaultCropRules.crop.gddBaseC,
  });
  const resolvedRules = resolveCropRuleContext({
    rulePack: prairieDefaultRulePack,
    cropContext: {
      cropType: cropContext?.cropType ?? rm.summary?.cropType ?? null,
      growthStage: cropStagePresentation.ruleStage,
    },
  });
  const latestOpticalRaster = rm.imagery?.latestOpticalRasterObservation ?? null;
  const latestObservation = rm.weather?.profile?.latestObservation ?? null;
  const forecasts = rm.weather?.profile?.forecasts ?? [];
  const opticalNdviAvg = averageMeasurement(latestOpticalRaster?.cells ?? [], "ndvi");
  const opticalNdreAvg = averageMeasurement(latestOpticalRaster?.cells ?? [], "ndre");
  const opticalSeasonality = resolveOpticalSeasonality({
    cropStagePresentation,
    latestOpticalCaptureAt:
      rm.imagery?.latestOpticalCapture?.capturedAt ??
      latestOpticalRaster?.observedAt ??
      null,
    ndviAvg: opticalNdviAvg,
    ndreAvg: opticalNdreAvg,
  });
  const canopySignalPresentation = resolveCanopySignalPresentation({
    cropStagePresentation,
    opticalSeasonality,
    ndviAvg: opticalNdviAvg,
    ndreAvg: opticalNdreAvg,
    hasOpticalRaster: latestOpticalRaster != null,
  });
  const actionableFindings =
    opticalSeasonality.status === "context-only"
      ? findings.filter(
          (finding: any) => !["crop_health", "disease_risk"].includes(finding.family),
        )
      : findings;
  const actionableAlerts =
    opticalSeasonality.status === "context-only"
      ? alerts.filter(
          (alert: any) => !["crop_health", "disease_risk"].includes(alert.family),
        )
      : alerts;
  const candidateFindings =
    actionableFindings.length > 0 ? actionableFindings : findings;
  const candidateAlerts =
    actionableAlerts.length > 0 ? actionableAlerts : alerts;
  const rankedFindings = rankActiveIntelligenceEntries(
    candidateFindings.map(
      (finding: any): ActiveIntelligenceEntry => ({
        kind: "finding",
        record: finding,
        family: finding.family,
        severityRank: severityRank(finding.severity),
        trackedZoneCount: countTrackedZones(finding),
        updatedAt: finding.updatedAt ?? finding.startedAt ?? null,
        familyPriority: familyPriority(finding.family),
      }),
    ),
  );
  const rankedAlerts = rankActiveIntelligenceEntries(
    candidateAlerts.map(
      (alert: any): ActiveIntelligenceEntry => ({
        kind: "alert",
        record: alert,
        family: alert.family,
        severityRank: severityRank(alert.severity),
        trackedZoneCount: countTrackedZones(alert),
        updatedAt: alert.updatedAt ?? alert.startedAt ?? null,
        familyPriority: familyPriority(alert.family),
      }),
    ),
  );
  const rankedEntries = rankActiveIntelligenceEntries([
    ...rankedFindings,
    ...rankedAlerts,
  ]);
  const primaryEntry = rankedEntries[0] ?? null;
  const primaryFinding = rankedFindings[0]?.record ?? null;
  const primaryAlert = rankedAlerts[0]?.record ?? null;
  const primaryActiveFinding =
    primaryEntry?.kind === "finding" ? primaryEntry.record : null;
  const primaryActiveAlert =
    primaryEntry?.kind === "alert" ? primaryEntry.record : null;
  const primarySeverity = primaryEntry?.record?.severity ?? null;
  const moisture = rm.moisture?.latestSnapshot ?? null;
  const moistureSourceLabel = shortSourceLabel(moisture?.sourceKey);
  const radarWetnessSignalLabel = resolveMetricModeContract(
    "radar-wetness",
    rm.imagery?.latestSarRasterObservation?.sourceKey,
  ).label;
  const weatherSignals = rm.weather?.signals ?? null;
  const weatherSourceLabel = shortSourceLabel(weatherSignals?.sourceKey);
  const cropLabel = cropContext?.cropType ? `${cropContext.cropType}` : "crop";
  const stageLabel =
    cropStagePresentation.displayStageLabel === "Stage unavailable"
      ? "current"
      : cropStagePresentation.displayStageLabel;
  const activeFindingCount =
    rm.summary?.activeFindingCount ??
    findings.length;
  const activeZoneCount =
    rm.summary?.activeTrackedZoneCount ??
    ((rm.zones?.newZoneCount ?? 0) +
      (rm.zones?.persistentZoneCount ?? 0) +
      (rm.zones?.recoveringZoneCount ?? 0));
  const activeAlertCount =
    rm.summary?.activeAlertCount ??
    alerts.length;
  const summaryDataQualityLabel = rm.summary?.dataQuality?.label ?? null;
  const hasActiveIntelligence =
    activeFindingCount > 0 ||
    activeZoneCount > 0 ||
    primaryFinding != null ||
    primaryAlert != null;
  const watchlistEligibleForDataQuality = isWatchlistEligibleForDataQuality(
    summaryDataQualityLabel,
  );
  const fieldAccessPresentation = resolveFieldAccessPresentation({
    surfaceMoisturePct: latestObservation?.soilMoisturePct ?? null,
    recentPrecipTotal72hMm: weatherSignals?.recentPrecipTotal72hMm ?? null,
    freezeThawCycles7d: weatherSignals?.freezeThawCycles7d ?? null,
    thresholds: resolvedRules.seedingThresholds,
  });
  const seedingRecommendation =
    resolveSeedingRecommendation({
      cropLabel,
      cropStagePresentation,
      seedingThresholds: resolvedRules.seedingThresholds,
      frostDamageTempC: resolvedRules.weatherRisk.frost.damageTempC,
      frostKillTempC: resolvedRules.weatherRisk.frost.killTempC,
      soilTemp6cmCurrentC:
        weatherSignals?.soilTemp6cmCurrentC ??
        latestObservation?.soilTemperature6cmC ??
        null,
      soilTemp6cmSustainedDays: weatherSignals?.soilTemp6cmSustainedDays ?? null,
      surfaceMoisturePct: latestObservation?.soilMoisturePct ?? null,
      fieldAccessPresentation,
      frostRiskMinTempC7d: weatherSignals?.frostRiskMinTempC7d ?? null,
      frostRiskNights7d: weatherSignals?.frostRiskNights7d ?? null,
      frostProbabilityPct7d: weatherSignals?.frostProbabilityPct7d ?? null,
      weatherSourceLabel,
    }) ?? null;
  const sprayRecommendation =
    seedingRecommendation == null
      ? resolveSprayWindowRecommendation({
          cropLabel,
          sprayWindowCount24h: weatherSignals?.sprayWindowCount24h ?? null,
          forecasts,
          fieldLabelPoint: rm.field.labelPoint,
          weatherSourceLabel,
        })
      : null;

  const watchlistSummary =
    !hasActiveIntelligence && watchlistEligibleForDataQuality
      ? buildWatchlistSummary({
          moisture,
          weatherSignals,
          moistureSourceLabel,
          weatherSourceLabel,
          seedingRecommendation:
            seedingRecommendation == null
              ? null
              : {
                  title: seedingRecommendation.title,
                  severity: seedingRecommendation.severity,
                  urgency: seedingRecommendation.urgency,
                  dueDate: seedingRecommendation.dueDate,
                  recommendation: seedingRecommendation.recommendation,
                  explanation: seedingRecommendation.explanation,
                  whyNow: seedingRecommendation.whyNow,
                  inspectFirst: seedingRecommendation.inspectFirst,
                  confidence: seedingRecommendation.confidence,
                  signals: seedingRecommendation.signals,
                  tags: seedingRecommendation.tags,
                },
          sprayRecommendation:
            sprayRecommendation == null
              ? null
              : {
                  title: sprayRecommendation.title,
                  severity: sprayRecommendation.severity,
                  urgency: sprayRecommendation.urgency,
                  dueDate: sprayRecommendation.dueDate,
                  recommendation: sprayRecommendation.recommendation,
                  explanation: sprayRecommendation.explanation,
                  whyNow: sprayRecommendation.whyNow,
                  inspectFirst: sprayRecommendation.inspectFirst,
                  confidence: sprayRecommendation.confidence,
                  signals: sprayRecommendation.signals,
                  tags: sprayRecommendation.tags,
                },
        })
      : null;

  const intelligenceState: FieldIntelligenceState = hasActiveIntelligence
    ? "active"
    : watchlistSummary
      ? "watchlist"
      : "none";
  const intelligenceSource: FieldIntelligenceSource = primaryEntry?.kind === "finding"
    ? "findings"
    : primaryEntry?.kind === "alert"
      ? "alerts"
      : watchlistSummary
        ? "heuristics"
        : "none";
  const intelligenceSourceLabel = resolveIntelligenceSourceLabel({
    state: intelligenceState,
    source: intelligenceSource,
  });
  const intelligenceFreshnessLabel = resolveIntelligenceFreshnessLabel({
    state: intelligenceState,
    source: intelligenceSource,
    findingUpdatedAt:
      primaryActiveFinding?.updatedAt ?? primaryActiveFinding?.startedAt ?? null,
    alertUpdatedAt:
      primaryActiveAlert?.updatedAt ?? primaryActiveAlert?.startedAt ?? null,
    weatherUpdatedAt:
      weatherSignals?.updatedAt ?? weatherSignals?.observedAt ?? null,
    moistureObservedAt: moisture?.observedAt ?? null,
  });
  const frostMin =
    weatherSignals?.frostRiskMinTempC7d ??
    weatherSignals?.frostRiskMinTempC ??
    null;
  const frostRiskNights7d = weatherSignals?.frostRiskNights7d ?? null;
  const frostHorizonLabel =
    weatherSignals?.frostRiskMinTempC7d != null ? "next 7d" : "next 24h";
  const frostDetailLabel =
    weatherSignals?.frostRiskMinTempC7d != null
      ? "Lowest forecast low"
      : "Next overnight minimum";
  const frostProbabilityPct7d = weatherSignals?.frostProbabilityPct7d ?? null;
  const frostProbabilityLabel =
    frostProbabilityPct7d != null && Number.isFinite(frostProbabilityPct7d)
      ? `${Math.round(frostProbabilityPct7d)}% probability`
      : null;

  const activeSignals = finalizeRankedSignals(
    [
      primaryFinding
        ? {
            key: `intelligence-family:${primaryFinding.family}`,
            score: 100 + severityRank(primaryFinding.severity) * 10 + countTrackedZones(primaryFinding),
            group: "intelligence",
            label: primaryFinding.family.replace(/_/g, " "),
            color: signalTagColor(primaryFinding.severity),
            detail: [
              primaryFinding.title,
              countTrackedZones(primaryFinding)
                ? `${countTrackedZones(primaryFinding)} tracked zone${countTrackedZones(primaryFinding) > 1 ? "s" : ""}`
                : null,
            ]
              .filter((value): value is string => Boolean(value))
              .join(" · "),
          }
        : null,
      primaryAlert
        ? {
            key: `intelligence-family:${primaryAlert.family}`,
            score: 95 + severityRank(primaryAlert.severity) * 10 + countTrackedZones(primaryAlert),
            group: "intelligence",
            label: primaryAlert.family.replace(/_/g, " "),
            color: signalTagColor(primaryAlert.severity),
            detail: [
              primaryAlert.title,
              countTrackedZones(primaryAlert)
                ? `${countTrackedZones(primaryAlert)} linked zone${countTrackedZones(primaryAlert) > 1 ? "s" : ""}`
                : "Field-wide alert",
            ].join(" · "),
          }
        : null,
      moisture?.rootZonePct != null
        ? {
            key: "metric:root-moisture",
            score: 70,
            group: "moisture",
            label: `Soil moisture ${moisture.rootZonePct.toFixed(1)}%`,
            color:
              moisture.rootZonePct < 25
                ? "red"
                : moisture.rootZonePct < 40
                  ? "yellow"
                  : "green",
            detail: [
              moisture.surfacePct != null
                ? `Surface ${moisture.surfacePct.toFixed(1)}%`
                : null,
              moistureSourceLabel,
              moisture.confidence ? `${moisture.confidence} confidence` : null,
            ]
              .filter((value): value is string => Boolean(value))
              .join(" · "),
          }
        : null,
      opticalSeasonality.status !== "context-only" && opticalNdviAvg != null
        ? {
            key: "metric:ndvi",
            score: 35,
            group: "optical",
            label: `Crop health ${opticalNdviAvg.toFixed(2)}`,
            color: signalColorFromAverage(opticalNdviAvg, {
              warningFloor: 0.45,
              healthyFloor: 0.65,
            }),
            detail: [
              `${cropStagePresentation.displayStageLabel} canopy`,
              latestOpticalRaster?.sourceKey
                ? shortSourceLabel(latestOpticalRaster.sourceKey)
                : null,
            ]
              .filter((value): value is string => Boolean(value))
              .join(" · "),
          }
        : null,
      opticalSeasonality.status !== "context-only" && opticalNdreAvg != null
        ? {
            key: "metric:ndre",
            score: 34,
            group: "optical",
            label: `Canopy vigor ${opticalNdreAvg.toFixed(2)}`,
            color: signalColorFromAverage(opticalNdreAvg, {
              warningFloor: 0.18,
              healthyFloor: 0.3,
            }),
            detail: [
              `${cropStagePresentation.displayStageLabel} red-edge`,
              latestOpticalRaster?.sourceKey
                ? shortSourceLabel(latestOpticalRaster.sourceKey)
                : null,
            ]
              .filter((value): value is string => Boolean(value))
              .join(" · "),
          }
        : null,
      opticalSeasonality.status === "context-only"
        ? {
            key: "context:optical",
            score: 20,
            group: "optical-context",
            label: opticalSeasonality.label,
            color: "yellow",
            detail: opticalSeasonality.detail,
          }
        : null,
      frostMin != null
        ? {
            key: "metric:frost-min",
            score:
              frostMin <= 0
                ? 75
                : frostMin <= 2
                  ? 60
                  : 25,
            group: "weather",
            label: `Frost min ${frostMin.toFixed(1)}°C`,
            color:
              frostMin <= 0
                ? "red"
                : frostMin <= 2
                  ? "yellow"
                  : "green",
            detail: [
              frostRiskNights7d != null && frostRiskNights7d > 0
                ? `${frostRiskNights7d} frost-risk night${frostRiskNights7d === 1 ? "" : "s"} ${frostHorizonLabel}`
                : frostDetailLabel,
              frostProbabilityLabel,
              weatherSourceLabel,
            ]
              .filter((value): value is string => Boolean(value))
              .join(" · "),
          }
        : null,
      weatherSignals?.peakForecastVpdKpa24h != null
        ? {
            key: "metric:vpd",
            score:
              weatherSignals.peakForecastVpdKpa24h >= 2
                ? 65
                : weatherSignals.peakForecastVpdKpa24h >= 1.2
                  ? 50
                  : 20,
            group: "weather",
            label: `Water demand ${weatherSignals.peakForecastVpdKpa24h.toFixed(1)} kPa`,
            color:
              weatherSignals.peakForecastVpdKpa24h >= 2
                ? "red"
                : weatherSignals.peakForecastVpdKpa24h >= 1.2
                  ? "yellow"
                  : "green",
            detail: [
              "Peak atmospheric demand next 24h",
              weatherSourceLabel,
            ]
              .filter((value): value is string => Boolean(value))
              .join(" · "),
          }
        : null,
    ].filter(Boolean) as RankedActionSignal[],
  );

  const trackedZoneCount =
    countTrackedZones(primaryEntry?.record);

  const topRiskTitle =
    intelligenceState === "active"
      ? primaryEntry?.record?.title ?? "Active field intelligence"
      : watchlistSummary?.title ?? "No active intelligence signal";

  const topRiskSeverity =
    intelligenceState === "active" ? primarySeverity : watchlistSummary?.severity ?? null;

  const recommendation =
    intelligenceState === "active"
      ? primaryEntry?.record?.recommendedAction ??
        "Review the strongest active field signal and confirm it on the ground before changing the whole-field plan."
      : intelligenceState === "watchlist"
        ? watchlistSummary!.recommendation
        : watchlistEligibleForDataQuality
          ? "No immediate intelligence-driven action is recommended right now."
          : "No heuristic action is being shown because current field context is not strong enough yet.";

  const explanationParts =
    intelligenceState === "active"
      ? [
          primaryEntry?.record?.summary ??
            primaryEntry?.record?.explanation ??
            null,
          opticalSeasonality.status === "context-only"
            ? `${opticalSeasonality.label}; active recommendations are weighted toward moisture, ${radarWetnessSignalLabel}, and weather until crop stage is verified.`
            : null,
          moisture?.rootZonePct != null
            ? `Root-zone moisture is ${moisture.rootZonePct.toFixed(1)}% with ${moisture.confidence} confidence.`
            : null,
          frostMin != null
            ? frostRiskNights7d != null && frostRiskNights7d > 0
              ? `Minimum forecast temperature is ${frostMin.toFixed(1)}°C, with ${frostRiskNights7d} frost-risk night${frostRiskNights7d === 1 ? "" : "s"} ${frostHorizonLabel}${frostProbabilityLabel ? ` and ${frostProbabilityLabel.toLowerCase()} below the crop damage threshold` : ""}.`
              : `Minimum forecast temperature is ${frostMin.toFixed(1)}°C ${frostHorizonLabel}${frostProbabilityLabel ? ` with ${frostProbabilityLabel.toLowerCase()} below the crop damage threshold` : ""}.`
            : null,
          weatherSignals?.peakForecastVpdKpa24h != null
            ? `Peak forecast crop water demand (VPD) over 24h is ${weatherSignals.peakForecastVpdKpa24h.toFixed(1)} kPa.`
            : null,
          cropContext
            ? cropStagePresentation.displayStageLabel === "Stage unverified"
              ? `${cropLabel} stage is currently unverified; default crop thresholds are being used until season GDD accumulates.`
              : `${cropLabel} is in the ${stageLabel.toLowerCase()} stage.`
            : null,
        ]
      : intelligenceState === "watchlist"
        ? [
            watchlistSummary!.explanation,
            opticalSeasonality.status === "context-only"
              ? `${opticalSeasonality.label}; this remains a watchlist recommendation until active findings or alerts are confirmed.`
              : null,
            cropContext
              ? cropStagePresentation.displayStageLabel === "Stage unverified"
                ? `${cropLabel} stage is currently unverified; watchlist thresholds are being interpreted with default crop assumptions.`
                : `${cropLabel} is in the ${stageLabel.toLowerCase()} stage.`
              : null,
          ]
      : [
            watchlistEligibleForDataQuality
              ? "No active findings, tracked zones, or watchlist heuristics are currently driving action for this field."
              : `No active findings or alerts are currently driving action for this field, and heuristic watchlists stay suppressed while data quality is ${String(summaryDataQualityLabel).toLowerCase()}.`,
          ];

  const questions: ActionQAItem[] =
    intelligenceState === "active"
      ? [
          {
            question: "What should I inspect first?",
            answer:
              trackedZoneCount && trackedZoneCount > 0
                ? `Start with the ${trackedZoneCount} tracked zone${trackedZoneCount > 1 ? "s" : ""} linked to the highest-severity finding, then verify whether the recommendation matches on-the-ground conditions.`
                : "Start with the cells and field area showing the strongest active finding or alert signal.",
            tags: [
              { label: "Field visit", color: "green" },
              {
                label: primaryEntry?.family
                  ? primaryEntry.family.replace(/_/g, " ")
                  : "active signal",
                color: signalTagColor(primarySeverity),
              },
            ],
          },
          {
            question: "Why is this urgent?",
            answer:
              primaryEntry?.record?.summary ??
              (opticalSeasonality.status === "context-only"
                ? `Optical canopy layers are being treated as preseason context, so urgency is being driven by moisture, ${radarWetnessSignalLabel}, weather, and non-optical findings.`
                : null) ??
              "The field is carrying active intelligence signals that should be checked before they expand.",
            tags: [
              { label: stageLabel, color: "green" },
              {
                label: primarySeverity ? severityLabel(primarySeverity) : "Routine",
                color: signalTagColor(primarySeverity),
              },
            ],
          },
          {
            question: "What supports this recommendation?",
            answer:
              [
                opticalSeasonality.status === "context-only"
                  ? `Optical validity: ${opticalSeasonality.label}.`
                  : null,
                opticalSeasonality.status !== "context-only" && latestOpticalRaster != null
                  ? `Optical validity: ${opticalSeasonality.label}.`
                  : null,
                moisture?.sourceKey
                  ? `Moisture source: ${shortSourceLabel(moisture.sourceKey)}.`
                  : null,
                rm.imagery?.latestSourceKey
                  ? `Imagery source: ${shortSourceLabel(rm.imagery.latestSourceKey)}.`
                  : null,
                weatherSignals?.sourceKey
                  ? `Weather signal source: ${shortSourceLabel(weatherSignals.sourceKey)}.`
                  : null,
              ]
                .filter((value): value is string => Boolean(value))
                .join(" ") ||
              "The recommendation is based on the latest field intelligence, moisture, and weather signals.",
            tags: [
              { label: "Moisture", color: moisture ? "green" : "yellow" },
              { label: "Weather", color: weatherSignals ? "green" : "yellow" },
            ],
          },
        ]
      : intelligenceState === "watchlist"
        ? [
            {
              question: "What should I inspect first?",
              answer: watchlistSummary!.inspectFirst,
              tags: [...watchlistSummary!.tags],
            },
            {
              question: "Why is this flagged?",
              answer: watchlistSummary!.whyNow,
              tags: [...watchlistSummary!.tags],
            },
            {
              question: "Is this a confirmed finding?",
              answer:
                "No. This is a watchlist recommendation derived from current moisture and weather signals, not an active tracked finding or alert.",
              tags: [
                { label: "Advisory", color: "yellow" },
                { label: "No zones", color: "yellow" },
              ],
            },
          ]
        : [
            {
              question: "What should I inspect first?",
              answer:
                "No active intelligence is telling you to prioritize a specific field area right now. Keep normal scouting cadence and wait for the next refresh.",
              tags: [{ label: "Routine", color: "green" }],
            },
            {
              question: "Why is nothing active?",
              answer:
                watchlistEligibleForDataQuality
                  ? "There are no active findings, tracked zones, or watchlist heuristics currently attached to this field."
                  : `There are no active findings or alerts currently attached to this field, and watchlist heuristics are being held back because data quality is ${String(summaryDataQualityLabel).toLowerCase()}.`,
              tags: [{ label: "No active signals", color: "green" }],
            },
            {
              question: "What supports this status?",
              answer:
                watchlistEligibleForDataQuality
                  ? "The current field view has no active finding, no active alert, and no moisture or weather heuristic that crossed the watchlist thresholds used for recommendations."
                  : "The current field view has no active finding or active alert, and heuristic recommendations are intentionally suppressed until field data quality is ready.",
              tags: [{ label: "Quiet field", color: "green" }],
            },
          ];

  const confidence =
    intelligenceState === "active"
      ? opticalSeasonality.status === "context-only"
        ? `${canopySignalPresentation.actionConfidenceLabel} · ${moisture?.confidence != null ? `${moisture.confidence} moisture` : "model-backed"}`
        : latestOpticalRaster != null && moisture?.confidence != null
          ? `${canopySignalPresentation.actionConfidenceLabel} · ${moisture.confidence} moisture`
          : latestOpticalRaster != null
            ? canopySignalPresentation.actionConfidenceLabel
            : moisture?.confidence != null
              ? `${moisture.confidence.charAt(0).toUpperCase()}${moisture.confidence.slice(1)} confidence`
              : "Model-backed"
      : intelligenceState === "watchlist"
        ? watchlistSummary!.confidence
        : "No active intelligence";

  const signals =
    intelligenceState === "active"
      ? activeSignals.slice(0, 3)
      : intelligenceState === "watchlist"
        ? dedupeSignals(watchlistSummary!.signals).slice(0, 4)
        : [];

  const baseActionProps: FieldActionProps = {
    name: fieldName,
    lld: rm.intake?.legalLandDescription ?? "No legal land description",
    recommendation,
    dueDate:
      intelligenceState === "active"
        ? dueDateLabel(primarySeverity)
        : intelligenceState === "watchlist"
          ? watchlistSummary!.dueDate
          : "—",
    explanation:
      explanationParts.join(" ") ||
      "No active recommendation context is available for this field yet.",
    urgency:
      intelligenceState === "active"
        ? severityLabel(primarySeverity)
        : intelligenceState === "watchlist"
          ? watchlistSummary!.urgency
          : "Routine",
    confidence,
    signalCount: signals.length,
    signals,
    questions,
    intelligenceState,
    intelligenceSource,
    intelligenceSourceLabel,
    intelligenceFreshnessLabel,
    activeFindingCount,
    activeZoneCount,
    activeAlertCount,
    topRiskTitle,
    topRiskSeverity,
  };

  if (
    intelligenceState !== "active" ||
    !options?.curation?.inputVersion ||
    options.curation.inputVersion !== buildFieldActionCurationVersion({
      state: "active",
      source: intelligenceSource === "alerts" ? "alerts" : "findings",
      topRiskTitle,
      topRiskSeverity,
      dueDate: baseActionProps.dueDate,
      activeFindingCount,
      activeZoneCount,
      activeAlertCount,
    })
  ) {
    return baseActionProps;
  }

  const curatedQuestions = [...baseActionProps.questions];
  if (curatedQuestions[0]) {
    curatedQuestions[0] = {
      ...curatedQuestions[0],
      answer: options.curation.inspectFirst,
    };
  }
  if (curatedQuestions[1]) {
    curatedQuestions[1] = {
      ...curatedQuestions[1],
      answer: options.curation.whyNow,
    };
  }
  if (curatedQuestions[2]) {
    curatedQuestions[2] = {
      ...curatedQuestions[2],
      answer: options.curation.supportingContext,
    };
  }

  return {
    ...baseActionProps,
    recommendation: options.curation.recommendation,
    explanation: options.curation.explanation,
    confidence: options.curation.confidence ?? baseActionProps.confidence,
    questions: curatedQuestions,
  };
}
