import {
  prairieDefaultRulePack,
  resolveCropRuleContext,
} from "@fieldpulse/module-crop-intelligence";
import type { FieldCropProps } from "./tabs/CropTab";
import {
  averageMeasurement,
} from "./buildFieldOverviewViewModel.raster";
import {
  resolveCanopySignalPresentation,
  resolveCropStagePresentation,
  resolveOpticalSeasonality,
  titleCaseStage,
} from "./buildFieldOverviewViewModel.cropSignals";

function metricTone(input: "danger" | "warning" | "positive" | "info") {
  switch (input) {
    case "danger":
      return { valueColor: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.25)" };
    case "warning":
      return { valueColor: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.25)" };
    case "positive":
      return { valueColor: "#16a34a", bg: "rgba(22,163,74,0.12)", border: "rgba(22,163,74,0.25)" };
    case "info":
      return { valueColor: "#3b82f6", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.25)" };
  }
}

function shortSourceLabel(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const parts = value.split(":");
  return parts.length > 1 ? parts.slice(-2).join(" · ") : value;
}

function toCapturePercentLabel(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return `${value.toFixed(1)}%`;
}

export function buildCropProps(rm: any): FieldCropProps {
  const cropContext = rm.cropContext ?? null;
  const moisture = rm.moisture ?? null;
  const weatherSignals = rm.weather?.signals ?? null;
  const latestOpticalRaster = rm.imagery?.latestOpticalRasterObservation ?? null;
  const latestOpticalRasterCells = latestOpticalRaster?.cells ?? [];
  const latestOpticalCapture = rm.imagery?.latestOpticalCapture ?? null;
  const latestSarCapture = rm.imagery?.latestSarCapture ?? null;
  const latestCanopyRaster =
    latestOpticalRaster ?? rm.imagery?.latestNdmiRasterObservation ?? rm.imagery?.latestRasterObservation ?? null;
  const latestCanopyCapture =
    latestCanopyRaster?.providerKey === "sentinel-1"
      ? latestSarCapture
      : latestOpticalCapture ?? latestSarCapture;
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

  const growthSegments = resolvedRules.crop.stageProgression.map((segment, index, all) => {
    const activeIndex = all.findIndex(
      (candidate) => candidate.stage === resolvedRules.crop.growthStage,
    );

    return {
      label: titleCaseStage(segment.stage),
      active: segment.stage === resolvedRules.crop.growthStage,
      color:
        index < activeIndex
          ? "#4ade80"
          : index === activeIndex
            ? "#16a34a"
            : "#d4d4d4",
    };
  });

  const rootZoneAvgPct = moisture?.rootZoneAvgPct ?? null;
  const surfaceAvgPct = moisture?.surfaceAvgPct ?? null;
  const ndviAvg = averageMeasurement(latestOpticalRasterCells, "ndvi");
  const ndreAvg = averageMeasurement(latestOpticalRasterCells, "ndre");
  const opticalSeasonality = resolveOpticalSeasonality({
    cropStagePresentation,
    latestOpticalCaptureAt:
      latestOpticalCapture?.capturedAt ?? latestOpticalRaster?.observedAt ?? null,
    ndviAvg,
    ndreAvg,
  });
  const canopySignalPresentation = resolveCanopySignalPresentation({
    cropStagePresentation,
    opticalSeasonality,
    ndviAvg,
    ndreAvg,
    hasOpticalRaster: latestOpticalRaster != null,
  });
  const frostMinTemp = weatherSignals?.frostRiskMinTempC ?? null;
  const peakVpd = weatherSignals?.peakForecastVpdKpa24h ?? null;
  const waterBalance24h = weatherSignals?.netWaterBalance24hMm ?? null;
  const waterBalance72h = weatherSignals?.netWaterBalance72hMm ?? null;

  const thresholdRows: FieldCropProps["thresholds"] = [
    {
      param: "Root Moisture (%)",
      min: `${resolvedRules.moistureStress.rootZoneCriticalPct}`,
      optimal: `${resolvedRules.moistureStress.rootZoneMonitorPct}–70`,
      optimalColor: "#16a34a",
      max: "85",
      status:
        rootZoneAvgPct == null
          ? "warn"
          : rootZoneAvgPct <= resolvedRules.moistureStress.rootZoneCriticalPct
            ? "danger"
            : rootZoneAvgPct <= resolvedRules.moistureStress.rootZoneMonitorPct
              ? "warn"
              : "ok",
      borderColor:
        rootZoneAvgPct == null
          ? "#f59e0b44"
          : rootZoneAvgPct <= resolvedRules.moistureStress.rootZoneCriticalPct
            ? "#ef444444"
            : rootZoneAvgPct <= resolvedRules.moistureStress.rootZoneMonitorPct
              ? "#f59e0b44"
              : "#16a34a44",
    },
    {
      param: "Surface Moisture (%)",
      min: `${resolvedRules.moistureStress.cellCriticalPct}`,
      optimal: `${resolvedRules.moistureStress.cellMonitorPct}–60`,
      optimalColor: "#16a34a",
      max: "80",
      status:
        surfaceAvgPct == null
          ? "warn"
          : surfaceAvgPct <= resolvedRules.moistureStress.cellCriticalPct
            ? "danger"
            : surfaceAvgPct <= resolvedRules.moistureStress.cellMonitorPct
              ? "warn"
              : "ok",
      borderColor:
        surfaceAvgPct == null
          ? "#f59e0b44"
          : surfaceAvgPct <= resolvedRules.moistureStress.cellCriticalPct
            ? "#ef444444"
            : surfaceAvgPct <= resolvedRules.moistureStress.cellMonitorPct
              ? "#f59e0b44"
              : "#16a34a44",
    },
    {
      param: "Frost Min (°C)",
      min: `${resolvedRules.weatherRisk.frost.killTempC}`,
      optimal: `>${resolvedRules.weatherRisk.frost.damageTempC}`,
      optimalColor: "#16a34a",
      max: "10",
      status:
        frostMinTemp == null
          ? "warn"
          : frostMinTemp <= resolvedRules.weatherRisk.frost.killTempC
            ? "danger"
            : frostMinTemp <= resolvedRules.weatherRisk.frost.damageTempC
              ? "warn"
              : "ok",
      borderColor:
        frostMinTemp == null
          ? "#f59e0b44"
          : frostMinTemp <= resolvedRules.weatherRisk.frost.killTempC
            ? "#ef444444"
            : frostMinTemp <= resolvedRules.weatherRisk.frost.damageTempC
              ? "#f59e0b44"
              : "#16a34a44",
    },
    {
      param: "Peak VPD (kPa)",
      min: "0",
      optimal: `<${resolvedRules.weatherRisk.atmosphericDemand.elevatedVpdKpa.toFixed(1)}`,
      optimalColor: "#16a34a",
      max: `${resolvedRules.weatherRisk.atmosphericDemand.severeVpdKpa.toFixed(1)}`,
      status:
        peakVpd == null
          ? "warn"
          : peakVpd >= resolvedRules.weatherRisk.atmosphericDemand.severeVpdKpa
            ? "danger"
            : peakVpd >= resolvedRules.weatherRisk.atmosphericDemand.elevatedVpdKpa
              ? "warn"
              : "ok",
      borderColor:
        peakVpd == null
          ? "#f59e0b44"
          : peakVpd >= resolvedRules.weatherRisk.atmosphericDemand.severeVpdKpa
            ? "#ef444444"
            : peakVpd >= resolvedRules.weatherRisk.atmosphericDemand.elevatedVpdKpa
              ? "#f59e0b44"
              : "#16a34a44",
    },
    {
      param: "Water Balance 24h (mm)",
      min: `${resolvedRules.weatherRisk.atmosphericDemand.severeWaterBalance24hMm}`,
      optimal: `>${resolvedRules.weatherRisk.atmosphericDemand.monitorWaterBalance24hMm}`,
      optimalColor: "#16a34a",
      max: "20",
      status:
        waterBalance24h == null
          ? "warn"
          : waterBalance24h <= resolvedRules.weatherRisk.atmosphericDemand.severeWaterBalance24hMm
            ? "danger"
            : waterBalance24h <= resolvedRules.weatherRisk.atmosphericDemand.monitorWaterBalance24hMm
              ? "warn"
              : "ok",
      borderColor:
        waterBalance24h == null
          ? "#f59e0b44"
          : waterBalance24h <= resolvedRules.weatherRisk.atmosphericDemand.severeWaterBalance24hMm
            ? "#ef444444"
            : waterBalance24h <= resolvedRules.weatherRisk.atmosphericDemand.monitorWaterBalance24hMm
              ? "#f59e0b44"
              : "#16a34a44",
    },
  ];

  const ndviTone =
    opticalSeasonality.status === "context-only"
      ? "#64748b"
      : ndviAvg == null
        ? "#6b7280"
        : ndviAvg >= 0.65
          ? "#16a34a"
          : ndviAvg >= 0.45
            ? "#f59e0b"
            : "#ef4444";
  const rootStatus =
    rootZoneAvgPct == null
      ? { label: "Unavailable", color: "#6b7280" }
      : rootZoneAvgPct <= resolvedRules.moistureStress.rootZoneCriticalPct
        ? { label: "Deficit", color: "#ef4444" }
        : rootZoneAvgPct <= resolvedRules.moistureStress.rootZoneMonitorPct
          ? { label: "Watch", color: "#f59e0b" }
          : { label: "Adequate", color: "#16a34a" };

  const frostTone =
    frostMinTemp == null
      ? metricTone("warning")
      : frostMinTemp <= resolvedRules.weatherRisk.frost.killTempC
        ? metricTone("danger")
        : frostMinTemp <= resolvedRules.weatherRisk.frost.damageTempC
          ? metricTone("warning")
          : metricTone("positive");
  const vpdTone =
    peakVpd == null
      ? metricTone("warning")
      : peakVpd >= resolvedRules.weatherRisk.atmosphericDemand.severeVpdKpa
        ? metricTone("danger")
        : peakVpd >= resolvedRules.weatherRisk.atmosphericDemand.elevatedVpdKpa
          ? metricTone("warning")
          : metricTone("info");
  const waterTone =
    waterBalance72h == null
      ? metricTone("warning")
      : waterBalance72h <= resolvedRules.weatherRisk.atmosphericDemand.severeWaterBalance72hMm
        ? metricTone("danger")
        : waterBalance72h < 0
          ? metricTone("warning")
          : metricTone("positive");
  const gddTone = metricTone("positive");

  const diseaseRisks = (rm.findings ?? [])
    .filter((finding: any) => finding.family === "disease_risk")
    .slice(0, 3)
    .map((finding: any) => {
      const tone =
        finding.severity === "critical" || finding.severity === "high"
          ? metricTone("danger")
          : finding.severity === "medium"
            ? metricTone("warning")
            : metricTone("positive");

      return {
        name: finding.title,
        desc: finding.summary ?? "Active disease model finding.",
        pct:
          finding.severity === "critical" || finding.severity === "high"
            ? "HIGH"
            : finding.severity === "medium"
              ? "MED"
              : "LOW",
        color: tone.valueColor,
        bg: tone.bg,
      };
    });

  if (diseaseRisks.length === 0) {
    const tone = metricTone("positive");
    diseaseRisks.push({
      name: "No active disease findings",
      desc: canopySignalPresentation.diseaseClearDescription,
      pct: "CLEAR",
      color: tone.valueColor,
      bg: tone.bg,
    });
  }

  const cropAlerts = (rm.alerts ?? [])
    .filter((alert: any) =>
      ["moisture_stress", "weather_risk", "disease_risk", "hail_risk"].includes(alert.family),
    )
    .slice(0, 2)
    .map((alert: any) => {
      const tone =
        alert.severity === "critical" || alert.severity === "high"
          ? metricTone("danger")
          : alert.severity === "medium"
            ? metricTone("warning")
            : metricTone("positive");

      return {
        iconKey:
          alert.family === "weather_risk"
            ? "temperature"
            : alert.family === "disease_risk"
              ? "disease"
              : alert.family === "moisture_stress"
                ? "moisture"
                : alert.family === "hail_risk"
                  ? "hail"
                  : "ok",
        iconColor: tone.valueColor,
        bg: tone.bg,
        title: alert.title,
        desc: alert.summary ?? alert.family.replace(/_/g, " "),
      };
    });

  if (cropAlerts.length === 0) {
    const tone = metricTone("positive");
    cropAlerts.push({
      iconKey: "ok",
      iconColor: tone.valueColor,
      bg: tone.bg,
      title: "No active crop alerts",
      desc: "Moisture, weather, hail, and disease alert families are currently clear for this field.",
    });
  }

  const provenanceChips = [
    latestCanopyRaster?.providerKey ?? "no-raster",
    moisture?.latestSnapshot?.confidence ?? "no-moisture",
  ];
  const moistureSubLabel =
    rootZoneAvgPct != null ? "Moisture" : "No raster moisture";
  const moistureSourceValue =
    shortSourceLabel(moisture?.latestSnapshot?.sourceKey) !== "—"
      ? shortSourceLabel(moisture?.latestSnapshot?.sourceKey)
      : "No moisture source";

  return {
    cropName: cropContext?.cropType ?? rm.summary?.cropType ?? "Crop profile",
    lld: rm.intake?.legalLandDescription ?? "No legal land description",
    growthSegments,
    accumulatedGddLabel: cropStagePresentation.accumulatedGddLabel,
    gddUnitLabel: cropStagePresentation.gddUnitLabel,
    thresholdStageLabel: cropStagePresentation.thresholdStageLabel,
    thresholds: thresholdRows,
    healthIndexTitle: canopySignalPresentation.cropTitle,
    healthIndex: {
      value: ndviAvg ?? 0,
      label: ndviAvg != null ? ndviAvg.toFixed(2) : "—",
      subLabel: canopySignalPresentation.cropSubLabel,
      fillColor: ndviTone,
      metrics: [
        {
          label: "Health",
          value: canopySignalPresentation.cropValue,
          valueColor: ndviTone,
        },
        {
          label: "Source",
          value: latestOpticalRaster?.providerKey ?? "No optical raster",
          valueColor: "#6b7280",
        },
        {
          label: "Cells",
          value:
            latestOpticalRaster == null
              ? "No optical cells"
              : `${latestOpticalRasterCells.length} optical`,
          valueColor: "#6b7280",
        },
      ],
    },
    moistureBalanceTitle: "ROOT MOISTURE BALANCE",
    moistureBalance: {
      value: (rootZoneAvgPct ?? 0) / 100,
      label: rootZoneAvgPct != null ? `${rootZoneAvgPct.toFixed(0)}%` : "—",
      subLabel: moistureSubLabel,
      fillColor: rootStatus.color,
      metrics: [
        {
          label: "Status",
          value: rootStatus.label,
          valueColor: rootStatus.color,
        },
        {
          label: "Optimal",
          value: `${resolvedRules.moistureStress.rootZoneMonitorPct}–70%`,
          valueColor: "#16a34a",
        },
        {
          label: "Source",
          value: moistureSourceValue,
          valueColor: "#6b7280",
        },
      ],
    },
    fieldTiles: [
      {
        label: "FROST RISK",
        value:
          frostMinTemp == null
            ? "No forecast"
            : frostMinTemp <= resolvedRules.weatherRisk.frost.killTempC
              ? "High"
              : frostMinTemp <= resolvedRules.weatherRisk.frost.damageTempC
                ? "Watch"
                : "Clear",
        sub:
          frostMinTemp == null
            ? "No frost signal available"
            : `Min temp ${frostMinTemp.toFixed(1)}°C`,
        ...frostTone,
      },
      {
        label: "ATMOSPHERIC DEMAND",
        value: peakVpd == null ? "No forecast" : peakVpd.toFixed(1),
        sub:
          peakVpd == null
            ? "No VPD signal available"
            : `Peak VPD next 24h`,
        ...vpdTone,
      },
      {
        label: "GDD 72H",
        value: weatherSignals?.gdd72h != null ? weatherSignals.gdd72h.toFixed(1) : "No forecast",
        sub:
          weatherSignals?.gdd72h != null
            ? `Base ${resolvedRules.crop.gddBaseC}°C`
            : "Weather still initializing",
        ...gddTone,
      },
      {
        label: "WATER BALANCE",
        value: waterBalance72h != null ? `${waterBalance72h.toFixed(1)}mm` : "No forecast",
        sub:
          waterBalance72h != null
            ? "72h forecast balance"
            : "No forecast water balance yet",
        ...waterTone,
      },
    ],
    diseaseRisks,
    provenanceLabel:
      latestCanopyRaster?.providerKey === "sentinel-1" ||
      latestCanopyRaster?.sourceKey?.includes("sentinel-1")
        ? "SAR DATA PROVENANCE"
        : "IMAGERY PROVENANCE",
    provenanceRows: [
      { key: "Stage Source", value: cropStagePresentation.stageSourceLabel },
      { key: "Optical Validity", value: opticalSeasonality.label },
      {
        key: "Season GDD",
        value: cropStagePresentation.hasCredibleAccumulatedGdd
          ? cropStagePresentation.accumulatedGddLabel
          : "Unavailable",
      },
      { key: "Provider", value: latestCanopyRaster?.providerKey ?? "—" },
      { key: "Source", value: shortSourceLabel(latestCanopyRaster?.sourceKey) },
      {
        key: "Last Capture",
        value: latestCanopyCapture?.capturedAt ?? latestCanopyRaster?.observedAt
          ? new Date(latestCanopyCapture?.capturedAt ?? latestCanopyRaster?.observedAt).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : "—",
      },
      {
        key: "Cloud Cover",
        value:
          latestCanopyCapture?.cloudCoverPct != null
            ? toCapturePercentLabel(latestCanopyCapture.cloudCoverPct)
            : latestCanopyCapture?.providerKey === "sentinel-1"
              ? "SAR clear-sky independent"
              : "—",
      },
      {
        key: "Coverage",
        value:
          latestCanopyCapture?.coveragePct != null
            ? toCapturePercentLabel(latestCanopyCapture.coveragePct)
            : "—",
      },
      {
        key: "Capture Mode",
        value:
          typeof latestCanopyCapture?.metadata?.materializationMode === "string"
            ? latestCanopyCapture.metadata.materializationMode
            : latestCanopyCapture?.status ?? "—",
      },
      {
        key: "Grid Cells",
        value: latestCanopyRaster ? String(latestCanopyRaster.cells.length) : "—",
      },
      {
        key: "Moisture Source",
        value: shortSourceLabel(moisture?.latestSnapshot?.sourceKey),
      },
    ],
    provenanceChips,
    alerts: cropAlerts,
    footer: `Last updated: ${new Date(rm.generatedAt).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    })} · ${[latestCanopyRaster?.providerKey, shortSourceLabel(moisture?.latestSnapshot?.sourceKey)]
      .filter((value) => value && value !== "—")
      .join(" + ")}`,
  };
}
