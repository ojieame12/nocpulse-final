import { resolveMetricModeContract } from "@fieldpulse/map/server";
import {
  prairieDefaultRulePack,
  resolveCropRuleContext,
} from "@fieldpulse/module-crop-intelligence";
import type { FieldActionProps } from "../../components/panels/ActionTab";
import { extractTrackedZoneIds } from "./buildFieldOverviewViewModel.shared";
import { averageMeasurement } from "./buildFieldOverviewViewModel.raster";
import {
  resolveCanopySignalPresentation,
  resolveCropStagePresentation,
  resolveOpticalSeasonality,
} from "./buildFieldOverviewViewModel.cropSignals";

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

export function buildActionProps(rm: any, fieldName: string): FieldActionProps {
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
  const latestOpticalRaster = rm.imagery?.latestOpticalRasterObservation ?? null;
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
          (finding: any) =>
            !["crop_health", "disease_risk"].includes(finding.family),
        )
      : findings;
  const actionableAlerts =
    opticalSeasonality.status === "context-only"
      ? alerts.filter(
          (alert: any) =>
            !["crop_health", "disease_risk"].includes(alert.family),
        )
      : alerts;
  const primaryFinding =
    [...(actionableFindings.length > 0 ? actionableFindings : findings)].sort(
      (left, right) => severityRank(right.severity) - severityRank(left.severity),
    )[0] ?? null;
  const primaryAlert =
    [...(actionableAlerts.length > 0 ? actionableAlerts : alerts)].sort(
      (left, right) => severityRank(right.severity) - severityRank(left.severity),
    )[0] ?? null;
  const primarySeverity = primaryFinding?.severity ?? primaryAlert?.severity ?? null;
  const moisture = rm.moisture?.latestSnapshot ?? null;
  const radarWetnessSignalLabel = resolveMetricModeContract(
    "radar-wetness",
    rm.imagery?.latestSarRasterObservation?.sourceKey,
  ).label;
  const weatherSignals = rm.weather?.signals ?? null;
  const cropLabel = cropContext?.cropType ? `${cropContext.cropType}` : "crop";
  const stageLabel =
    cropStagePresentation.displayStageLabel === "Stage unavailable"
      ? "current"
      : cropStagePresentation.displayStageLabel;

  const recommendation =
    primaryFinding?.recommendedAction ??
    primaryAlert?.recommendedAction ??
    (moisture?.rootZonePct != null && moisture.rootZonePct < 35
      ? `Scout the driest part of the field and verify root-zone moisture decline before the next weather window.`
      : `Prioritize a field walk on the most active tracked zone and confirm whether current intelligence signals match field conditions.`);

  const explanationParts = [
    primaryFinding?.summary ?? primaryAlert?.summary ?? primaryAlert?.explanation ?? null,
    opticalSeasonality.status === "context-only"
      ? `${opticalSeasonality.label}; active recommendations are weighted toward moisture, ${radarWetnessSignalLabel}, and weather until crop stage is verified.`
      : null,
    moisture?.rootZonePct != null
      ? `Root-zone moisture is ${moisture.rootZonePct.toFixed(1)}% with ${moisture.confidence} confidence.`
      : null,
    weatherSignals?.frostRiskMinTempC != null
      ? `Minimum forecast temperature is ${weatherSignals.frostRiskMinTempC.toFixed(1)}°C.`
      : null,
    weatherSignals?.peakForecastVpdKpa24h != null
      ? `Peak forecast VPD over 24h is ${weatherSignals.peakForecastVpdKpa24h.toFixed(1)} kPa.`
      : null,
    cropContext
      ? cropStagePresentation.displayStageLabel === "Stage unverified"
        ? `${cropLabel} stage is currently unverified; default crop thresholds are being used until season GDD accumulates.`
        : `${cropLabel} is in the ${stageLabel.toLowerCase()} stage.`
      : null,
  ].filter((value): value is string => Boolean(value));

  const signalCandidates = [
    primaryFinding
      ? {
          label: primaryFinding.family.replace(/_/g, " "),
          color: signalTagColor(primaryFinding.severity),
          detail: [
            primaryFinding.title,
            primaryFinding.evidence?.trackedZones?.length
              ? `${primaryFinding.evidence.trackedZones.length} tracked zone${primaryFinding.evidence.trackedZones.length > 1 ? "s" : ""}`
              : null,
          ]
            .filter((value): value is string => Boolean(value))
            .join(" · "),
        }
      : null,
    primaryAlert
      ? {
          label: primaryAlert.family.replace(/_/g, " "),
          color: signalTagColor(primaryAlert.severity),
          detail: [
            primaryAlert.title,
            extractTrackedZoneIds(primaryAlert.evidence).length
              ? `${extractTrackedZoneIds(primaryAlert.evidence).length} linked zone${extractTrackedZoneIds(primaryAlert.evidence).length > 1 ? "s" : ""}`
              : "Field-wide alert",
          ].join(" · "),
        }
      : null,
    moisture?.rootZonePct != null
      ? {
          label: `Root moisture ${moisture.rootZonePct.toFixed(1)}%`,
          color: moisture.rootZonePct < 25 ? "red" : moisture.rootZonePct < 40 ? "yellow" : "green",
          detail: [
            moisture.surfacePct != null
              ? `Surface ${moisture.surfacePct.toFixed(1)}%`
              : null,
            moisture.sourceKey ? shortSourceLabel(moisture.sourceKey) : null,
            moisture.confidence ? `${moisture.confidence} confidence` : null,
          ]
            .filter((value): value is string => Boolean(value))
            .join(" · "),
        }
      : null,
    opticalSeasonality.status !== "context-only" && opticalNdviAvg != null
      ? {
          label: `NDVI ${opticalNdviAvg.toFixed(2)}`,
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
          label: `NDRE ${opticalNdreAvg.toFixed(2)}`,
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
          label: opticalSeasonality.label,
          color: "yellow",
          detail: opticalSeasonality.detail,
        }
      : null,
    weatherSignals?.frostRiskMinTempC != null
      ? {
          label: `Frost min ${weatherSignals.frostRiskMinTempC.toFixed(1)}°C`,
          color:
            weatherSignals.frostRiskMinTempC <= 0
              ? "red"
              : weatherSignals.frostRiskMinTempC <= 2
                ? "yellow"
                : "green",
          detail: [
            "Next overnight minimum",
            weatherSignals.sourceKey ? shortSourceLabel(weatherSignals.sourceKey) : null,
          ]
            .filter((value): value is string => Boolean(value))
            .join(" · "),
        }
      : null,
    weatherSignals?.peakForecastVpdKpa24h != null
      ? {
          label: `VPD ${weatherSignals.peakForecastVpdKpa24h.toFixed(1)} kPa`,
          color:
            weatherSignals.peakForecastVpdKpa24h >= 2
              ? "red"
              : weatherSignals.peakForecastVpdKpa24h >= 1.2
                ? "yellow"
                : "green",
          detail: [
            "Peak atmospheric demand next 24h",
            weatherSignals.sourceKey ? shortSourceLabel(weatherSignals.sourceKey) : null,
          ]
            .filter((value): value is string => Boolean(value))
            .join(" · "),
        }
      : null,
  ].filter(Boolean) as FieldActionProps["signals"];

  const trackedZoneCount =
    primaryFinding?.evidence?.trackedZones?.length ??
    extractTrackedZoneIds(primaryAlert?.evidence).length;

  return {
    name: fieldName,
    lld: rm.intake?.legalLandDescription ?? "No legal land description",
    recommendation,
    dueDate: dueDateLabel(primarySeverity),
    explanation:
      explanationParts.join(" ") ||
      "No active recommendation context is available for this field yet.",
    urgency: severityLabel(primarySeverity),
    confidence:
      opticalSeasonality.status === "context-only"
        ? `${canopySignalPresentation.actionConfidenceLabel} · ${moisture?.confidence != null ? `${moisture.confidence} moisture` : "model-backed"}`
        : latestOpticalRaster != null && moisture?.confidence != null
          ? `${canopySignalPresentation.actionConfidenceLabel} · ${moisture.confidence} moisture`
        : latestOpticalRaster != null
          ? canopySignalPresentation.actionConfidenceLabel
        : moisture?.confidence != null
          ? `${moisture.confidence.charAt(0).toUpperCase()}${moisture.confidence.slice(1)} confidence`
        : "Model-backed",
    signalCount: signalCandidates.length,
    signals: signalCandidates.slice(0, 4),
    questions: [
      {
        question: "What should I inspect first?",
        answer:
          trackedZoneCount && trackedZoneCount > 0
            ? `Start with the ${trackedZoneCount} tracked zone${trackedZoneCount > 1 ? "s" : ""} linked to the highest-severity finding, then verify whether the recommendation matches on-the-ground conditions.`
            : "Start with the cells and field area showing the strongest active finding or alert signal.",
        tags: [
          { label: "Field visit", color: "green" },
          { label: primaryFinding ? primaryFinding.family.replace(/_/g, " ") : "active signal", color: signalTagColor(primarySeverity) },
        ],
      },
      {
        question: "Why is this urgent?",
        answer:
          primaryFinding?.summary ??
          primaryAlert?.summary ??
          (opticalSeasonality.status === "context-only"
            ? `Optical canopy layers are being treated as preseason context, so urgency is being driven by moisture, ${radarWetnessSignalLabel}, weather, and non-optical findings.`
            : null) ??
          (weatherSignals?.frostRiskMinTempC != null
            ? `Upcoming weather could worsen the current field condition before the next capture cycle.`
            : `The field is carrying active intelligence signals that should be checked before they expand.`),
        tags: [
          { label: stageLabel, color: "green" },
          { label: primarySeverity ? severityLabel(primarySeverity) : "Routine", color: signalTagColor(primarySeverity) },
        ],
      },
      {
        question: "What supports this recommendation?",
        answer: [
          opticalSeasonality.status === "context-only"
            ? `Optical validity: ${opticalSeasonality.label}.`
            : null,
          opticalSeasonality.status !== "context-only" && latestOpticalRaster != null
            ? `Optical validity: ${opticalSeasonality.label}.`
            : null,
          moisture?.sourceKey ? `Moisture source: ${shortSourceLabel(moisture.sourceKey)}.` : null,
          rm.imagery?.latestSourceKey ? `Imagery source: ${shortSourceLabel(rm.imagery.latestSourceKey)}.` : null,
          weatherSignals?.sourceKey ? `Weather signal source: ${shortSourceLabel(weatherSignals.sourceKey)}.` : null,
        ]
          .filter((value): value is string => Boolean(value))
          .join(" ") || "The recommendation is based on the latest field intelligence, moisture, and weather signals.",
        tags: [
          { label: "Moisture", color: moisture ? "green" : "yellow" },
          { label: "Weather", color: weatherSignals ? "green" : "yellow" },
        ],
      },
    ],
  };
}
