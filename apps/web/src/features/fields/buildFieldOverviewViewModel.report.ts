import {
  prairieDefaultRulePack,
  resolveCropRuleContext,
} from "@fieldpulse/module-crop-intelligence";
import { resolveMetricModeContract } from "@fieldpulse/map/server";
import type { FieldRasterObservation } from "@fieldpulse/module-imagery";
import type {
  FieldReportProps,
  ReadingIconKey,
  ReportAlertItem,
  ReportCropParam,
  ReportFindingItem,
  ReportReadingCell,
  ReportZoneItem,
} from "../../components/panels/ReportTab";
import {
  buildObservationHistoryLabels,
  extractTrackedZoneIds,
  formatHistoryLabel,
  shortProviderTag,
} from "./buildFieldOverviewViewModel.shared";
import {
  averageAgronomicMeasurement,
  averageMeasurement,
  deriveObservationRootMoisturePct,
  deriveObservationSurfaceMoisturePct,
} from "./buildFieldOverviewViewModel.raster";
import {
  resolveCanopySignalPresentation,
  resolveCropStagePresentation,
  resolveOpticalSeasonality,
} from "./buildFieldOverviewViewModel.cropSignals";

function formatSignedMillimetres(value: number | null | undefined) {
  if (value == null) {
    return "—";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} mm`;
}

/** Build a compact detail string for hail alerts (size + time window). */
function buildAlertDetail(alert: any): string | null {
  if (alert.family !== "hail_risk") return null;

  const meta = alert.evidence?.metadata ?? alert.facts ?? {};
  const parts: string[] = [];

  const sizeMm = meta.hailSizeMm ?? meta.hailSize;
  if (typeof sizeMm === "number" && sizeMm > 0) {
    const sizeCm = sizeMm / 10;
    parts.push(sizeCm >= 1 ? `${sizeCm.toFixed(1)} cm` : `${sizeMm} mm`);
  }

  const windowStart = meta.windowStart ?? meta.reportedAt;
  if (windowStart) {
    try {
      const d = new Date(windowStart);
      parts.push(
        d.toLocaleDateString("en-CA", { month: "short", day: "numeric" }),
      );
    } catch {
      // ignore malformed dates
    }
  }

  const affectedCells = alert.evidence?.affectedCellKeys?.length;
  if (typeof affectedCells === "number" && affectedCells > 0) {
    parts.push(`${affectedCells} cell${affectedCells === 1 ? "" : "s"}`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

export function buildReportProps(
  rm: any,
  fieldName: string,
  formatTimeAgo: (iso: string) => string,
): FieldReportProps {
  const obs = rm.weather?.profile?.latestObservation;
  const forecasts = rm.weather?.profile?.forecasts ?? [];
  const weatherDataAvailability = rm.weather?.profile?.dataAvailability ?? {
    latestObservation: true,
    forecasts: true,
  };
  const moisture = rm.moisture;
  const alerts = rm.alerts ?? [];
  const summary = rm.summary;
  const activeAlertsAvailable = rm.dataAvailability?.activeAlerts !== false;
  const cropContext = rm.cropContext;
  const weatherSignals = rm.weather?.signals ?? null;
  const defaultCropRules = resolveCropRuleContext({
    rulePack: prairieDefaultRulePack,
    cropContext: {
      cropType: cropContext?.cropType ?? summary?.cropType ?? null,
      growthStage: null,
    },
  });
  const cropStagePresentation = resolveCropStagePresentation({
    cropContext,
    fallbackGrowthStage: summary?.growthStage ?? null,
    defaultGrowthStage: defaultCropRules.crop.growthStage,
    gddBaseC: defaultCropRules.crop.gddBaseC,
  });
  const resolvedRules = resolveCropRuleContext({
    rulePack: prairieDefaultRulePack,
    cropContext: {
      cropType: cropContext?.cropType ?? summary?.cropType ?? null,
      growthStage: cropStagePresentation.ruleStage,
    },
  });
  const latestOpticalRaster = rm.imagery?.latestOpticalRasterObservation ?? null;
  const latestNdmiRaster =
    rm.imagery?.latestNdmiRasterObservation ??
    latestOpticalRaster ??
    null;
  const latestRadarWetnessRaster =
    rm.imagery?.latestSarRasterObservation ??
    null;
  const opticalNdviAvg = averageMeasurement(
    latestOpticalRaster?.cells ?? [],
    "ndvi",
  );
  const opticalNdreAvg = averageMeasurement(
    latestOpticalRaster?.cells ?? [],
    "ndre",
  );
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
  const ndmiAvg = averageAgronomicMeasurement(
    latestNdmiRaster?.cells ?? [],
    "ndmi",
  );
  const ndmiMetricContract = resolveMetricModeContract(
    "ndmi",
    latestNdmiRaster?.sourceKey,
  );
  const radarWetnessAvg = averageAgronomicMeasurement(
    latestRadarWetnessRaster?.cells ?? [],
    "radar-wetness",
  );
  const radarWetnessMetricContract = resolveMetricModeContract(
    "radar-wetness",
    latestRadarWetnessRaster?.sourceKey,
  );
  const rootMoistureAvg = moisture?.rootZoneAvgPct ?? null;
  const surfaceMoistureAvg = moisture?.surfaceAvgPct ?? null;
  const frostMinTemp = weatherSignals?.frostRiskMinTempC ?? null;
  const peakVpd = weatherSignals?.peakForecastVpdKpa24h ?? null;
  const waterBalance72h = weatherSignals?.netWaterBalance72hMm ?? null;

  /* Derive a short human-readable source tag from a sourceKey or providerKey.
     Intentionally terse — these appear as tiny hints next to values. */
  const moistureMode = moisture?.latestSnapshot?.inputs?.derivationMode;
  const moistureSourceTag =
    moistureMode === "source-backed" ? "SAR" :
    moistureMode === "seeded-range" ? "Modeled" : undefined;

  const weatherSourceTag = obs?.providerKey
    ? shortProviderTag(obs.providerKey)
    : undefined;

  const opticalSourceTag = latestOpticalRaster?.sourceKey
    ? shortProviderTag(latestOpticalRaster.sourceKey)
    : undefined;

  const ndmiSourceTag = latestNdmiRaster?.sourceKey
    ? shortProviderTag(latestNdmiRaster.sourceKey)
    : undefined;

  const radarSourceTag = latestRadarWetnessRaster?.sourceKey
    ? shortProviderTag(latestRadarWetnessRaster.sourceKey)
    : undefined;

  const readings: ReportReadingCell[] = [
    {
      iconKey: "temperature" as ReadingIconKey,
      label: "Temperature",
      value: obs ? `${obs.airTemperatureC.toFixed(1)}°C` : "—",
      sourceTag: weatherSourceTag,
    },
    {
      iconKey: "soil-moisture" as ReadingIconKey,
      label: "Soil Moisture",
      value: obs?.soilMoisturePct != null ? `${obs.soilMoisturePct.toFixed(1)}%` : "—",
      sourceTag: weatherSourceTag,
    },
    {
      iconKey: "root-moisture" as ReadingIconKey,
      label: "Root Moisture",
      value: rootMoistureAvg != null ? `${rootMoistureAvg.toFixed(1)}%` : "—",
      sourceTag: moistureSourceTag,
    },
    {
      iconKey: "wind" as ReadingIconKey,
      label: "Wind",
      value: obs ? `${obs.windSpeedKph.toFixed(0)} km/h` : "—",
      sourceTag: weatherSourceTag,
    },
    {
      iconKey: "ndvi" as ReadingIconKey,
      label: "NDVI",
      value: opticalNdviAvg != null ? opticalNdviAvg.toFixed(2) : "—",
      sourceTag: opticalSourceTag,
    },
    {
      iconKey: "ndre" as ReadingIconKey,
      label: "NDRE",
      value: opticalNdreAvg != null ? opticalNdreAvg.toFixed(2) : "—",
      sourceTag: opticalSourceTag,
    },
    {
      iconKey: "ndmi" as ReadingIconKey,
      label: ndmiMetricContract.label,
      value: ndmiAvg != null ? ndmiAvg.toFixed(2) : "—",
      sourceTag: ndmiSourceTag,
    },
    {
      iconKey: "radar-wetness" as ReadingIconKey,
      label: radarWetnessMetricContract.label,
      value: radarWetnessAvg != null ? radarWetnessAvg.toFixed(2) : "—",
      sourceTag: radarSourceTag,
    },
    {
      iconKey: "stress-area" as ReadingIconKey,
      label: "Stress Area",
      value: summary?.activeFindingCount != null ? `${summary.activeFindingCount} findings` : "—",
    },
  ];

  const forecastByDay = new Map<
    string,
    {
      label: string;
      maxC: number | null;
      minC: number | null;
      precipProbabilityPct: number | null;
      precipitationMm: number;
    }
  >();
  for (const forecast of forecasts) {
    const dateKey = new Date(forecast.validAt).toISOString().slice(0, 10);
    const existing = forecastByDay.get(dateKey);
    const label = new Date(forecast.validAt).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    if (!existing) {
      forecastByDay.set(dateKey, {
        label,
        maxC:
          typeof forecast.airTemperatureMaxC === "number"
            ? forecast.airTemperatureMaxC
            : null,
        minC:
          typeof forecast.airTemperatureMinC === "number"
            ? forecast.airTemperatureMinC
            : null,
        precipProbabilityPct:
          typeof forecast.precipitationProbabilityPct === "number"
            ? forecast.precipitationProbabilityPct
            : null,
        precipitationMm:
          typeof forecast.precipitationMm === "number"
            ? forecast.precipitationMm
            : 0,
      });
      continue;
    }

    existing.maxC =
      typeof forecast.airTemperatureMaxC === "number"
        ? existing.maxC == null
          ? forecast.airTemperatureMaxC
          : Math.max(existing.maxC, forecast.airTemperatureMaxC)
        : existing.maxC;
    existing.minC =
      typeof forecast.airTemperatureMinC === "number"
        ? existing.minC == null
          ? forecast.airTemperatureMinC
          : Math.min(existing.minC, forecast.airTemperatureMinC)
        : existing.minC;
    existing.precipProbabilityPct =
      typeof forecast.precipitationProbabilityPct === "number"
        ? existing.precipProbabilityPct == null
          ? forecast.precipitationProbabilityPct
          : Math.max(existing.precipProbabilityPct, forecast.precipitationProbabilityPct)
        : existing.precipProbabilityPct;
    existing.precipitationMm +=
      typeof forecast.precipitationMm === "number" ? forecast.precipitationMm : 0;
  }

  const forecastDays = [...forecastByDay.values()].slice(0, 7).map((day) => ({
    day: day.label,
    temp:
      day.maxC != null && day.minC != null
        ? `${Math.round(day.maxC)}/${Math.round(day.minC)}`
        : "—",
    precip: day.precipProbabilityPct != null
      ? `${Math.round(day.precipProbabilityPct)}%`
      : `${day.precipitationMm.toFixed(1)}mm`,
  }));

  const alertFamilyToIconKey: Record<string, ReportAlertItem["iconKey"]> = {
    moisture_stress: "moisture",
    weather_risk: "temperature",
    crop_health: "leaf",
    hail_risk: "hail",
    disease_risk: "leaf",
  };

  const alertItems: ReportAlertItem[] = alerts.map((a: any) => ({
    iconKey: alertFamilyToIconKey[a.family] ?? "generic",
    text: a.summary ?? a.title,
    severity: a.severity === "critical" || a.severity === "high" ? "High" as const
      : a.severity === "medium" ? "Med" as const
      : "Low" as const,
    trackedZoneIds: extractTrackedZoneIds(a.evidence),
    detail: buildAlertDetail(a),
  }));

  const findingItems: ReportFindingItem[] = (rm.findings ?? []).map((finding: any) => ({
    id: finding.id,
    title: finding.title,
    summary: finding.summary,
    severity: finding.severity === "critical" || finding.severity === "high" ? "High" as const
      : finding.severity === "medium" ? "Med" as const
      : "Low" as const,
    trackedZoneIds:
      finding.evidence?.trackedZones?.map((zone: any) => zone.zoneId).filter((zoneId: unknown) => typeof zoneId === "string") ?? [],
  }));

  const zoneItems: ReportZoneItem[] = (rm.zones?.zones ?? []).map((zone: any) => ({
    id: zone.id,
    family: zone.family,
    trackingKey: zone.trackingKey,
    status: zone.status,
    severity:
      zone.latestSeverity === "critical" || zone.latestSeverity === "high"
        ? "High"
        : zone.latestSeverity === "medium"
          ? "Med"
          : zone.latestSeverity === "low"
            ? "Low"
            : null,
    affectedCellCount: zone.affectedCellCount,
    lastSeenAt: zone.lastSeenAt,
  }));

  const sourceKeys = new Set<string>();
  if (moisture?.latestSnapshot?.sourceKey) sourceKeys.add(moisture.latestSnapshot.sourceKey);
  if (obs?.providerKey) sourceKeys.add(obs.providerKey);
  if (latestOpticalRaster?.sourceKey) sourceKeys.add(latestOpticalRaster.sourceKey);
  if (latestNdmiRaster?.sourceKey) sourceKeys.add(latestNdmiRaster.sourceKey);

  const baseHealthStatus =
    summary?.activeAlertCount != null && summary.activeAlertCount > 0
      ? "Needs Attention"
      : latestOpticalRaster != null
        ? canopySignalPresentation.reportHealthStatus
        : rootMoistureAvg != null &&
            rootMoistureAvg <= resolvedRules.moistureStress.rootZoneMonitorPct
          ? "Moisture Watch"
          : "Healthy";
  const healthStatus =
    !activeAlertsAvailable && baseHealthStatus === "Healthy"
      ? "Partial Data"
      : baseHealthStatus;

  const cropParams: ReportCropParam[] = [
    {
      label: "Root Moisture",
      value: rootMoistureAvg != null ? `${rootMoistureAvg.toFixed(1)}%` : "—",
      rangeLow: `${resolvedRules.moistureStress.rootZoneCriticalPct}%`,
      rangeHigh: "70%",
      fillPercent:
        rootMoistureAvg != null
          ? Math.max(0, Math.min((rootMoistureAvg / 70) * 100, 100))
          : 0,
    },
    {
      label: "Surface Moisture",
      value: surfaceMoistureAvg != null ? `${surfaceMoistureAvg.toFixed(1)}%` : "—",
      rangeLow: `${resolvedRules.moistureStress.cellCriticalPct}%`,
      rangeHigh: "60%",
      fillPercent:
        surfaceMoistureAvg != null
          ? Math.max(0, Math.min((surfaceMoistureAvg / 60) * 100, 100))
          : 0,
    },
    {
      label: "Frost Min",
      value: frostMinTemp != null ? `${frostMinTemp.toFixed(1)}°C` : "—",
      rangeLow: `${resolvedRules.weatherRisk.frost.killTempC}°C`,
      rangeHigh: `>${resolvedRules.weatherRisk.frost.damageTempC}°C`,
      fillPercent:
        frostMinTemp != null
          ? Math.max(0, Math.min(((frostMinTemp + 10) / 20) * 100, 100))
          : 0,
    },
    {
      label: "Water Balance 72h",
      value: formatSignedMillimetres(waterBalance72h),
      rangeLow: `${resolvedRules.weatherRisk.atmosphericDemand.severeWaterBalance72hMm}mm`,
      rangeHigh: ">0mm",
      fillPercent:
        waterBalance72h != null
          ? Math.max(0, Math.min(((waterBalance72h + 20) / 40) * 100, 100))
          : 0,
    },
    {
      label: "Peak VPD",
      value: peakVpd != null ? `${peakVpd.toFixed(1)} kPa` : "—",
      rangeLow: "0",
      rangeHigh: `${resolvedRules.weatherRisk.atmosphericDemand.severeVpdKpa.toFixed(1)} kPa`,
      fillPercent:
        peakVpd != null
          ? Math.max(
              0,
              Math.min(
                (peakVpd / resolvedRules.weatherRisk.atmosphericDemand.severeVpdKpa) * 100,
                100,
              ),
            )
          : 0,
    },
  ];

  const opticalHistory = Array.isArray(rm.imagery?.opticalRasterHistory)
    ? rm.imagery.opticalRasterHistory
    : [];
  const sarHistory = Array.isArray(rm.imagery?.sarRasterHistory)
    ? rm.imagery.sarRasterHistory
    : [];
  const vegetationHistory = opticalHistory.slice(0, 6).reverse();
  const moistureHistory = sarHistory.slice(0, 6).reverse();
  const vegetationLabels = buildObservationHistoryLabels(vegetationHistory);
  const moistureLabels = buildObservationHistoryLabels(moistureHistory);
  const temperatureWindow = [
    {
      label: "Now",
      maxC: obs?.airTemperatureC ?? null,
      minC: obs?.airTemperatureC ?? null,
    },
    ...[...forecastByDay.values()].slice(0, 7).map((entry) => ({
      label: entry.label,
      maxC: entry.maxC,
      minC: entry.minC,
    })),
  ];
  const vegetationEmptyText =
    latestOpticalRaster == null
      ? "No optical canopy raster is available yet. NDVI and NDRE history needs Sentinel-2 or Planet coverage."
      : opticalSeasonality.status === "context-only"
        ? `${opticalSeasonality.detail} Only one or two captures are available, so the optical trend is informational rather than in-season crop stress.`
      : opticalHistory.length <= 1
        ? "Only one optical capture is stored so far. More optical passes are needed before a vegetation trend can be drawn."
        : "Optical history is present, but NDVI and NDRE values are not populated on the recent captures yet.";
  const moistureHistoryEmptyText =
    moisture?.latestSnapshot != null || rm.imagery?.latestRasterObservation != null
      ? sarHistory.length <= 1
        ? "Only one SAR-backed moisture capture is stored so far. More raster passes are needed before a moisture trend can be drawn."
        : "SAR moisture history exists, but the recent captures do not contain enough populated values for a trend."
      : "No raster-backed moisture history is available yet.";
  const temperatureWindowEmptyText =
    !weatherDataAvailability.latestObservation && !weatherDataAvailability.forecasts
      ? "Weather observation and forecast data were unavailable for this field."
      : !weatherDataAvailability.latestObservation
        ? "Forecast days are available, but the latest live weather observation could not be loaded."
        : !weatherDataAvailability.forecasts
          ? "Latest weather observation is available, but the forecast window could not be loaded."
      : obs == null && forecastByDay.size === 0
      ? "No weather observation or forecast window is available for this field yet."
      : obs == null
        ? "Forecast days are available, but the latest live weather observation is missing."
      : forecastByDay.size === 0
          ? "Latest weather observation is available, but no forecast window has been stored yet."
          : "No forecast temperature window is available yet.";

  const charts = [
    {
      title: "VEGETATION HISTORY",
      subtitle: canopySignalPresentation.reportVegetationSubtitle,
      emptyText: vegetationEmptyText,
      series: [
        {
          label: "NDVI",
          color: "#16a34a",
          format: "index" as const,
          points: vegetationHistory.map((observation: FieldRasterObservation, index: number) => ({
            label: vegetationLabels[index] ?? formatHistoryLabel(observation.observedAt),
            value: averageAgronomicMeasurement(observation.cells, "ndvi"),
          })),
        },
        {
          label: "NDRE",
          color: "#14b8a6",
          format: "index" as const,
          points: vegetationHistory.map((observation: FieldRasterObservation, index: number) => ({
            label: vegetationLabels[index] ?? formatHistoryLabel(observation.observedAt),
            value: averageAgronomicMeasurement(observation.cells, "ndre"),
          })),
        },
      ],
    },
    {
      title: "MOISTURE PROFILE HISTORY",
      subtitle: "Root + surface moisture from raster",
      emptyText: moistureHistoryEmptyText,
      series: [
        {
          label: "Root",
          color: "#3b82f6",
          format: "percent" as const,
          points: moistureHistory.map((observation: FieldRasterObservation, index: number) => ({
            label: moistureLabels[index] ?? formatHistoryLabel(observation.observedAt),
            value: deriveObservationRootMoisturePct(observation),
          })),
        },
        {
          label: "Surface",
          color: "#0ea5e9",
          format: "percent" as const,
          points: moistureHistory.map((observation: FieldRasterObservation, index: number) => ({
            label: moistureLabels[index] ?? formatHistoryLabel(observation.observedAt),
            value: deriveObservationSurfaceMoisturePct(observation),
          })),
        },
        {
          label: radarWetnessMetricContract.label,
          color: "#06b6d4",
          format: "index" as const,
          points: moistureHistory.map((observation: FieldRasterObservation, index: number) => ({
            label: moistureLabels[index] ?? formatHistoryLabel(observation.observedAt),
            value: averageAgronomicMeasurement(observation.cells, "radar-wetness"),
          })),
        },
      ],
    },
    {
      title: "TEMPERATURE WINDOW",
      subtitle: "Latest observation + next forecast days",
      emptyText: temperatureWindowEmptyText,
      series: [
        {
          label: "High",
          color: "#f97316",
          format: "temperature" as const,
          points: temperatureWindow.map((entry) => ({
            label: entry.label,
            value: entry.maxC,
          })),
        },
        {
          label: "Low",
          color: "#94a3b8",
          format: "temperature" as const,
          points: temperatureWindow.map((entry) => ({
            label: entry.label,
            value: entry.minC,
          })),
        },
      ],
    },
  ];

  return {
    name: fieldName,
    lld: rm.intake?.legalLandDescription ?? "",
    updatedDate: new Date(rm.generatedAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    healthStatus,
    readings,
    cropStage:
      cropStagePresentation.displayStageLabel === "Stage unavailable"
        ? "—"
        : cropStagePresentation.displayStageLabel,
    cropParams,
    charts,
    forecast: forecastDays,
    alerts: alertItems,
    alertsEmptyStateTitle: activeAlertsAvailable ? undefined : "Alert data unavailable",
    alertsEmptyStateDescription: activeAlertsAvailable
      ? undefined
      : "Active alerts could not be loaded for this report window. Re-run the report before treating this field as all clear.",
    findings: findingItems,
    zones: zoneItems,
    provenanceText: moisture?.latestSnapshot
      ? `Root zone moisture: avg ${moisture.rootZoneAvgPct?.toFixed(1) ?? "—"}%, range ${moisture.rootZoneMinPct?.toFixed(1) ?? "—"}–${moisture.rootZoneMaxPct?.toFixed(1) ?? "—"}%. ${moisture.latestCellCount} cells, ${moisture.lowConfidenceCellCount} low-confidence.`
      : "No moisture data available for provenance.",
    sources: [...sourceKeys].map((s) => ({ label: s })),
  };
}
