/**
 * Mode-data builder for FieldDetailPanel.
 *
 * Pure computation: given a mode key, map model, hover state, and tab props,
 * produces the DetailPanelModeData that drives the panel's top fold.
 * Extracted from FieldDetailPanel.tsx — no behavior change.
 */

import {
  describeCellAnomalyClass,
  describeCellAttentionLevel,
  describeMetricSource,
  describeCellSourceTier,
  formatCellPercentile,
  formatMetricDisplayValue,
  resolveCellAttentionLevel,
  resolveMetricModeContract,
  type CellHoverEvent,
  type FieldAgronomicSurfaceMetricKey,
  type FieldBoundaryPreviewRenderModel,
} from "@fieldpulse/map";
import type { ModeKey, DetailPanelModeVital, DetailPanelModeData } from "./fieldDetailTypes";
import { MODE_TO_METRIC_KEY } from "./fieldDetailTypes";
import {
  buildSparkFromReportChartSeries,
  buildSparkFromSurface,
  findContextTile,
  findReportReading,
  formatSignedMetricDelta,
  formatSurfaceMetricValue,
  hasDisplayValue,
  isPreseasonOpticalContextSurface,
  parseNumericValue,
  percentile,
  resolveModeTrendChart,
  resolveReportChartRangeLabels,
  resolveSurfaceForMode,
  splitMetricDisplayParts,
  titleCaseLabel,
} from "./fieldDetailHelpers";
import type { FieldSummaryProps } from "./SummaryTab";
import type { FieldReportProps } from "./ReportTab";
import type { FieldMarketProps } from "./MarketTab";
import type { FieldCropProps } from "../../features/fields/tabs/CropTab";
import type { FieldActionProps } from "./ActionTab";

/** Phrases that mean "we don't actually know the stage" — treat as empty so fallbacks kick in */
const STAGE_PLACEHOLDER = /^stage\s+(unverified|unavailable)$/i;

/**
 * Strip verbose suffixes so "Vegetative default stage" → "Vegetative",
 * "Reproductive stage" → "Reproductive", etc.  Keep short codes like "V3" as-is.
 */
function compactStageLabel(raw: string): string {
  return raw.replace(/\s+default\s+stage$/i, "").replace(/\s+stage$/i, "").trim();
}

function resolveStageLabel(
  summary: { cropStage?: string | null } | null,
  crop: { thresholdStageLabel?: string | null } | null,
  fallback = "Preseason",
): string {
  const fromSummary = summary?.cropStage;
  if (fromSummary && !STAGE_PLACEHOLDER.test(fromSummary)) return compactStageLabel(fromSummary);
  const fromCrop = crop?.thresholdStageLabel;
  if (fromCrop && !STAGE_PLACEHOLDER.test(fromCrop)) return compactStageLabel(fromCrop);
  return fallback;
}

export function buildFieldDetailModeData({
  mode,
  mapModel,
  hoveredCell,
  summary,
  report,
  crop,
  action,
  market,
}: {
  mode: ModeKey;
  mapModel: FieldBoundaryPreviewRenderModel | null | undefined;
  hoveredCell: CellHoverEvent | null | undefined;
  summary: FieldSummaryProps | null;
  report: FieldReportProps | null;
  crop: FieldCropProps | null;
  action: FieldActionProps | null;
  market: FieldMarketProps | null;
}): DetailPanelModeData {
  const surface = resolveSurfaceForMode(mapModel, mode);
  const metricKey = MODE_TO_METRIC_KEY[mode];
  const contract = resolveMetricModeContract(metricKey, surface?.sourceLabel);
  const hoveredMetricMatches = hoveredCell?.metricKey === metricKey;
  const effectiveMetricPct =
    hoveredMetricMatches && hoveredCell
      ? hoveredCell.metricValuePct
      : surface?.metricAveragePct ?? null;
  const sourceSummary = describeMetricSource(surface?.sourceLabel, surface?.confidence);
  const preseasonOpticalContext = isPreseasonOpticalContextSurface(surface);
  const heroParts = splitMetricDisplayParts(metricKey, effectiveMetricPct);
  const cellsList = surface ? (Array.isArray(surface.cells) ? surface.cells : Object.values(surface.cells)) : [];
  const sortedMetricValues = cellsList.map((cell) => cell.metricValuePct).sort((left, right) => left - right);
  const p10 = percentile(sortedMetricValues, 0.1);
  const p50 = percentile(sortedMetricValues, 0.5);
  const p90 = percentile(sortedMetricValues, 0.9);
  const mappedCells = cellsList.length;
  const stressedCellCount =
    cellsList.filter((cell) => cell.severityLabel === "stressed" || cell.severityLabel === "critical").length;
  const zonedCellCount =
    cellsList.filter((cell) => cell.zoneId != null).length;
  const stressedPct = mappedCells > 0 ? Math.round((stressedCellCount / mappedCells) * 100) : 0;
  const zonedPct = mappedCells > 0 ? Math.round((zonedCellCount / mappedCells) * 100) : 0;
  const attentionLevels = cellsList.map((cell) =>
    resolveCellAttentionLevel({
      metricKey,
      severityLabel: cell.severityLabel,
      anomalyClass: cell.anomalyClass,
      deltaFromFieldAvgPct: cell.deltaFromFieldAvgPct,
      percentileInField: cell.percentileInField,
    }),
  );
  const localizedWatchCount = attentionLevels.filter((level) => level === "watch" || level === "critical").length;
  const localizedCriticalCount = attentionLevels.filter((level) => level === "critical").length;
  const localizedWatchInZonesCount =
    cellsList.reduce((count, cell, index) => {
      const level = attentionLevels[index];
      if ((level === "watch" || level === "critical") && cell.zoneId) {
        return count + 1;
      }

      return count;
    }, 0);
  const localizedWatchOutsideZonesCount =
    cellsList.reduce((count, cell, index) => {
      const level = attentionLevels[index];
      if ((level === "watch" || level === "critical") && !cell.zoneId) {
        return count + 1;
      }

      return count;
    }, 0);
  const localizedCriticalInZonesCount =
    cellsList.reduce((count, cell, index) => {
      const level = attentionLevels[index];
      if (level === "critical" && cell.zoneId) {
        return count + 1;
      }

      return count;
    }, 0);
  const localizedWatchPct =
    mappedCells > 0 ? Math.round((localizedWatchCount / mappedCells) * 100) : 0;
  const localizedCriticalPct =
    mappedCells > 0 ? Math.round((localizedCriticalCount / mappedCells) * 100) : 0;
  const localizedWatchInZonesPct =
    mappedCells > 0 ? Math.round((localizedWatchInZonesCount / mappedCells) * 100) : 0;
  const localizedWatchOutsideZonesPct =
    mappedCells > 0 ? Math.round((localizedWatchOutsideZonesCount / mappedCells) * 100) : 0;
  const localizedCriticalInZonesPct =
    mappedCells > 0 ? Math.round((localizedCriticalInZonesCount / mappedCells) * 100) : 0;
  const availableValue = surface != null;
  const fieldRelativeMode =
    metricKey !== "root-zone-moisture-pct" &&
    metricKey !== "surface-moisture-pct";
  const broadStressSignal =
    fieldRelativeMode &&
    stressedPct >= 30 &&
    localizedWatchPct <= Math.max(10, Math.round(stressedPct * 0.45));
  const localizedContrastSignal =
    localizedWatchPct >= 18 || localizedCriticalPct >= 8;
  const trackedZoneFocusSignal = localizedWatchInZonesPct >= 8;
  const untrackedPocketSignal =
    localizedWatchOutsideZonesPct >= Math.max(8, localizedWatchInZonesPct + 4);
  const derivedRiskLevel =
    localizedCriticalPct >= 12 || (!fieldRelativeMode && stressedPct >= 30)
      ? "High"
      : trackedZoneFocusSignal && localizedCriticalInZonesPct >= 4
        ? "Zone Critical"
        : trackedZoneFocusSignal
          ? "Zone Watch"
          : untrackedPocketSignal
            ? "Emerging"
    : broadStressSignal
      ? "Broad Stress"
      : localizedContrastSignal
        ? "Localized Watch"
        : stressedPct > 0
          ? "Moderate"
          : "Low";
  const riskLevel = action?.urgency && action.urgency !== "Routine"
    ? action.urgency
    : derivedRiskLevel;
  const riskSeverity: "positive" | "warning" | "danger" =
    !availableValue
      ? "warning"
      : preseasonOpticalContext
        ? "positive"
      : localizedCriticalPct >= 12 || localizedCriticalInZonesPct >= 4 || (!fieldRelativeMode && stressedPct >= 30)
        ? "danger"
        : trackedZoneFocusSignal || untrackedPocketSignal || broadStressSignal || localizedContrastSignal || stressedPct > 0
          ? "warning"
          : "positive";

  const defaultVitals: DetailPanelModeVital[] = [
    { label: "Cells", value: mappedCells > 0 ? `${mappedCells}` : "—" },
    { label: "Watch", value: mappedCells > 0 ? `${stressedPct}%` : "—", sev: stressedPct > 0 },
    { label: "Zones", value: mappedCells > 0 ? `${zonedPct}%` : "—" },
  ];

  if (!availableValue) {
    return {
      hero: {
        v: 0,
        d: "—",
        u: "",
        sev: "warning",
      },
      headline: `${contract.label} unavailable`,
      sub: `No current ${contract.subtitle.toLowerCase()} surface is available for this field.`,
      contextOnly: false,
      vitals: defaultVitals,
      spark: [0, 0, 0, 0, 0, 0],
      trendLabel: "No live profile",
      trendMeta: "Waiting on raster surface",
      spatialColumns: [
        { label: "P10", value: "—" },
        { label: "Median", value: "—" },
        { label: "P90", value: "—" },
      ],
      spatialProgressPct: 0,
      belowThresholdLabel: "Watch cells",
      belowThresholdValue: "—",
      inZonesLabel: "In zones",
      inZonesValue: "—",
      interpretation: contract.valueMeaning,
      risk: action?.recommendation ?? `Switch back to an available mode or wait for a current ${contract.shortLabel} surface.`,
      riskLevel: "Unavailable",
      sourceSummary: "No current source context",
    };
  }

  const moistureTile = findContextTile(market, "ROOT MOISTURE");
  const waterBalanceTile = findContextTile(market, "WATER BALANCE");
  const activeSignalsTile = findContextTile(market, "ACTIVE SIGNALS");
  const modeTrend = resolveModeTrendChart(report, mode);
  const modeTrendSeriesIndex =
    modeTrend.chart?.series.findIndex((series) => series.label === modeTrend.series?.label) ?? 0;
  const modeTrendRange = resolveReportChartRangeLabels(
    modeTrend.chart,
    modeTrendSeriesIndex >= 0 ? modeTrendSeriesIndex : 0,
  );
  const ndviReading = findReportReading(report, "ndvi");
  const ndreReading = findReportReading(report, "ndre");
  const ndmiReading = findReportReading(report, "ndmi");
  const radarWetnessReading = findReportReading(report, "radar-wetness");
  const ndviValue =
    ndviReading?.value ?? formatSurfaceMetricValue(mapModel, "ndvi");
  const ndreValue =
    ndreReading?.value ?? formatSurfaceMetricValue(mapModel, "ndre");
  const ndmiValue =
    ndmiReading?.value ?? formatSurfaceMetricValue(mapModel, "ndmi");
  const radarWetnessValue =
    radarWetnessReading?.value ?? formatSurfaceMetricValue(mapModel, "radarWetness");
  const ndmiLabel = resolveMetricModeContract(
    "ndmi",
    resolveSurfaceForMode(mapModel, "ndmi")?.sourceLabel,
  ).label;
  const radarWetnessLabel = resolveMetricModeContract(
    "radar-wetness",
    resolveSurfaceForMode(mapModel, "radarWetness")?.sourceLabel,
  ).label;
  const healthMetric = crop?.healthIndex.metrics[0]?.value ?? "—";
  const moistureMetric = crop?.moistureBalance.metrics[0]?.value ?? "—";
  const topDiseaseRisk = crop?.diseaseRisks[0]?.pct ?? "—";
  const trendValue = summary?.trend ?? "—";
  const trendIcon: "up" | "down" | undefined =
    trendValue.startsWith("+") ? "up" : trendValue.startsWith("−") || trendValue.startsWith("-") ? "down" : undefined;
  const moistureTrendVital = hasDisplayValue(trendValue)
    ? { label: "Trend 7d", value: trendValue, icon: trendIcon, sev: trendIcon === "down" }
    : hasDisplayValue(waterBalanceTile?.value)
      ? {
          label: "Balance",
          value: waterBalanceTile?.value ?? "—",
          sev: Boolean(waterBalanceTile?.value?.startsWith("-")),
        }
      : hasDisplayValue(summary?.nextRain)
        ? {
            label: "Next Rain",
            value: summary?.nextRain ?? "—",
          }
        : { label: "Trend 7d", value: trendValue, icon: trendIcon, sev: trendIcon === "down" };
  const hoveredSourceSummary =
    hoveredMetricMatches && hoveredCell
      ? describeCellSourceTier(hoveredCell.sourceTier, metricKey)
      : sourceSummary;
  const hoveredDeltaLabel =
    hoveredMetricMatches && hoveredCell
      ? formatSignedMetricDelta(metricKey, hoveredCell.deltaFromFieldAvgPct)
      : null;
  const hoveredPercentileLabel =
    hoveredMetricMatches && hoveredCell
      ? formatCellPercentile(hoveredCell.percentileInField)
      : null;
  const hoveredAnomalyLabel =
    hoveredMetricMatches && hoveredCell
      ? titleCaseLabel(describeCellAnomalyClass(hoveredCell.anomalyClass))
      : null;
  const hoveredAttentionLevel =
    hoveredMetricMatches && hoveredCell
      ? resolveCellAttentionLevel({
          metricKey,
          severityLabel: hoveredCell.severityLabel,
          anomalyClass: hoveredCell.anomalyClass,
          deltaFromFieldAvgPct: hoveredCell.deltaFromFieldAvgPct,
          percentileInField: hoveredCell.percentileInField,
        })
      : null;
  const hoveredAttentionLabel =
    hoveredAttentionLevel != null
      ? describeCellAttentionLevel(hoveredAttentionLevel)
      : null;
  const hoveredSeverityLabel =
    hoveredAttentionLabel;
  const hoveredVarianceLabel =
    hoveredMetricMatches && hoveredCell
      ? titleCaseLabel(hoveredCell.varianceBucket)
      : null;
  const vitalsByMode: Record<ModeKey, DetailPanelModeVital[]> = {
    moisture: [
      { label: "Surface", value: summary?.surfaceMoisture ?? "—" },
      { label: "Stress", value: `${stressedPct}%`, sev: stressedPct > 0 },
      moistureTrendVital,
    ],
    ndvi: preseasonOpticalContext
      ? [
          { label: "NDVI", value: ndviValue },
          { label: "Stage", value: resolveStageLabel(summary, crop) },
          { label: "Moisture", value: summary?.rootMoisture ?? "—" },
        ]
      : [
          { label: "NDVI", value: ndviValue },
          { label: "NDRE", value: ndreValue },
          { label: "Moisture", value: summary?.rootMoisture ?? "—" },
        ],
    ndre: preseasonOpticalContext
      ? [
          { label: "NDRE", value: ndreValue },
          { label: "Stage", value: resolveStageLabel(summary, crop) },
          { label: "Moisture", value: summary?.rootMoisture ?? "—" },
        ]
      : [
          { label: "NDRE", value: ndreValue },
          { label: "NDVI", value: ndviValue },
          { label: "Disease", value: topDiseaseRisk, sev: topDiseaseRisk === "HIGH" || topDiseaseRisk === "MED" },
        ],
    ndmi: preseasonOpticalContext
      ? [
          { label: ndmiLabel, value: ndmiValue },
          { label: "Stage", value: resolveStageLabel(summary, crop) },
          { label: "Moisture", value: summary?.rootMoisture ?? "—" },
        ]
      : [
          { label: ndmiLabel, value: ndmiValue },
          { label: "Moisture", value: moistureTile?.value ?? summary?.rootMoisture ?? "—" },
          { label: "Balance", value: waterBalanceTile?.value ?? "—", sev: Boolean(waterBalanceTile?.value?.startsWith("-")) },
        ],
    radarWetness: [
      { label: radarWetnessLabel, value: radarWetnessValue },
      { label: "Moisture", value: moistureTile?.value ?? summary?.rootMoisture ?? "—" },
      { label: "Balance", value: waterBalanceTile?.value ?? "—", sev: Boolean(waterBalanceTile?.value?.startsWith("-")) },
    ],
  };
  const hoveredVitals: DetailPanelModeVital[] =
    hoveredMetricMatches && hoveredCell
      ? [
          { label: "Delta", value: hoveredDeltaLabel ?? "—", sev: Boolean(hoveredDeltaLabel && hoveredDeltaLabel.startsWith("−")) },
          {
            label: "Percentile",
            value: hoveredPercentileLabel ?? "—",
            sev: hoveredCell.anomalyClass !== "near-field",
          },
          {
            label: "Anomaly",
            value: hoveredAnomalyLabel ?? "—",
            sev: hoveredCell.anomalyClass !== "near-field",
          },
        ]
      : vitalsByMode[mode];

  const headlineByMode: Record<ModeKey, string> = {
    moisture:
      stressedPct >= 30
        ? "Moisture stress is widespread"
        : localizedContrastSignal
          ? "Moisture pockets need attention"
        : stressedPct > 0
          ? "Mixed moisture profile"
          : "Moisture profile is stable",
    ndvi:
      preseasonOpticalContext
        ? "Preseason canopy context loaded"
        : broadStressSignal
          ? "Canopy baseline is low but locally consistent"
        : localizedContrastSignal
          ? "Canopy contrast pockets need attention"
        : parseNumericValue(healthMetric) == null
        ? "Canopy vigor signal loaded"
        : healthMetric === "Healthy"
          ? "Canopy vigor is holding"
          : healthMetric === "Watch"
            ? "Canopy vigor needs attention"
            : "Canopy vigor is stressed",
    ndre:
      preseasonOpticalContext
        ? "Preseason red-edge context loaded"
        : broadStressSignal
          ? "Red-edge baseline is low but locally consistent"
        : localizedContrastSignal
          ? "Red-edge contrast pockets detected"
        : topDiseaseRisk === "HIGH"
        ? "Red-edge stress signal is elevated"
        : topDiseaseRisk === "MED"
          ? "Chlorophyll watch signal detected"
          : "Red-edge response is stable",
    ndmi: preseasonOpticalContext
      ? "Preseason canopy-water context loaded"
      : broadStressSignal
        ? "Canopy-water baseline is low but locally consistent"
        : localizedContrastSignal
          ? "Canopy-water pockets need attention"
        : stressedPct > 0
          ? "Canopy water is mixed"
          : "Canopy water profile is stable",
    radarWetness:
      broadStressSignal
        ? "Radar wetness baseline is shifted field-wide"
        : localizedContrastSignal
          ? "Radar wetness pockets stand out"
        : stressedPct > 0
          ? "Radar wetness is mixed"
          : "Radar wetness profile is stable",
  };

  const subByMode: Record<ModeKey, string> = {
    moisture: `${summary?.rootMoisture ?? "—"} root moisture · ${summary?.surfaceMoisture ?? "—"} surface · ${sourceSummary}`,
    ndvi: preseasonOpticalContext
      ? `${ndviValue} NDVI · ${summary?.rootMoisture ?? "—"} root moisture · ${sourceSummary}`
      : `${ndviValue} NDVI · ${ndreValue} NDRE · ${summary?.rootMoisture ?? "—"} root moisture · ${sourceSummary}`,
    ndre: preseasonOpticalContext
      ? `${ndreValue} NDRE · ${summary?.rootMoisture ?? "—"} root moisture · ${sourceSummary}`
      : `${ndreValue} NDRE · ${ndviValue} NDVI · ${topDiseaseRisk} disease watch · ${sourceSummary}`,
    ndmi: preseasonOpticalContext
      ? `${ndmiValue} ${ndmiLabel} · ${summary?.rootMoisture ?? "—"} root moisture · ${sourceSummary}`
      : `${ndmiValue} ${ndmiLabel} · ${summary?.rootMoisture ?? "—"} root moisture · ${waterBalanceTile?.value ?? "—"} balance · ${sourceSummary}`,
    radarWetness: `${radarWetnessValue} ${radarWetnessLabel} · ${summary?.rootMoisture ?? "—"} root moisture · ${waterBalanceTile?.value ?? "—"} balance · ${sourceSummary}`,
  };
  const hoveredSub =
    hoveredMetricMatches && hoveredCell
      ? [
          hoveredPercentileLabel ? `${hoveredPercentileLabel} in field` : null,
          hoveredAnomalyLabel ? hoveredAnomalyLabel.toLowerCase() : null,
          hoveredDeltaLabel ? `${hoveredDeltaLabel} vs field` : null,
          hoveredVarianceLabel ? `${hoveredVarianceLabel} variance` : null,
          hoveredSourceSummary,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  const interpretationByMode: Record<ModeKey, string> = {
    moisture: summary?.rootMoistureSub
      ? `${summary.rootMoistureSub}. ${summary.trendSub}`
      : contract.valueMeaning,
    ndvi: preseasonOpticalContext
      ? `${crop?.healthIndex.subLabel ?? "Preseason optical context"}. Use moisture and ${radarWetnessLabel} for current field decisions until crop stage and season GDD are verified.`
      : `${crop?.healthIndexTitle ?? "Canopy signal"} · ${healthMetric}. ${crop?.healthIndex.subLabel ?? "Field-average vigor context"}`,
    ndre: preseasonOpticalContext
      ? `${crop?.healthIndex.subLabel ?? "Preseason optical context"}. Red-edge values are informational only until crop stage and season GDD are verified.`
      : `${crop?.alerts[0]?.title ?? "No active crop alert"}. ${crop?.alerts[0]?.desc ?? contract.valueMeaning} ${ndreValue !== "—" ? `Current NDRE ${ndreValue}.` : ""}`.trim(),
    ndmi: preseasonOpticalContext
      ? `${crop?.moistureBalance.subLabel ?? crop?.healthIndex.subLabel ?? "Preseason optical context"}. Use moisture and ${radarWetnessLabel} for current field decisions until crop stage and season GDD are verified.`
      : `${moistureMetric}. ${waterBalanceTile?.sub ?? "72h forecast water balance context"} ${ndmiValue !== "—" ? `Current ${ndmiLabel} ${ndmiValue}.` : ""}`.trim(),
    radarWetness: `${moistureMetric}. ${waterBalanceTile?.sub ?? "72h forecast water balance context"} ${radarWetnessValue !== "—" ? `Current ${radarWetnessLabel} ${radarWetnessValue}.` : ""}`.trim(),
  };

  return {
    hero: {
      v: Math.max(0, Math.min(1, (effectiveMetricPct ?? 0) / 100)),
      d: heroParts.display,
      u: heroParts.unit,
      sev: riskSeverity,
    },
    contextOnly: preseasonOpticalContext,
    headline:
      hoveredMetricMatches && hoveredCell
        ? `${contract.shortLabel} cell ${hoveredSeverityLabel?.toLowerCase() ?? "signal"}`
        : headlineByMode[mode],
    sub: hoveredSub ?? subByMode[mode],
    vitals: hoveredVitals,
    spark:
      modeTrend.series != null
        ? buildSparkFromReportChartSeries(modeTrend.series)
        : buildSparkFromSurface(surface),
    trendLabel: modeTrend.chart?.title ?? "Signal profile",
    trendMeta:
      modeTrend.chart && modeTrend.series
        ? [
            modeTrend.chart.subtitle,
            modeTrendRange.start === modeTrendRange.end
              ? modeTrendRange.start
              : `${modeTrendRange.start} → ${modeTrendRange.end}`,
          ]
            .filter(Boolean)
            .join(" · ")
        : `${contract.shortLabel} field distribution`,
    trendColor: modeTrend.series?.color ?? undefined,
    spatialColumns: [
      { label: "P10", value: formatMetricDisplayValue(metricKey, p10) },
      { label: "Median", value: formatMetricDisplayValue(metricKey, p50) },
      { label: "P90", value: formatMetricDisplayValue(metricKey, p90) },
    ],
    spatialProgressPct:
      zonedPct > 0
        ? Math.max(localizedWatchInZonesPct, localizedWatchOutsideZonesPct)
        : fieldRelativeMode
          ? localizedWatchPct
          : stressedPct,
    belowThresholdLabel: zonedPct > 0 ? "Tracked pockets" : "Localized watch",
    belowThresholdValue: zonedPct > 0 ? `${localizedWatchInZonesPct}%` : `${localizedWatchPct}%`,
    inZonesLabel: zonedPct > 0 ? "Outside zones" : "Absolute stress",
    inZonesValue: zonedPct > 0 ? `${localizedWatchOutsideZonesPct}%` : `${stressedPct}%`,
    interpretation:
      hoveredMetricMatches && hoveredCell
        ? [
            hoveredAnomalyLabel
              ? `${hoveredAnomalyLabel} signal within this field distribution.`
              : null,
            hoveredPercentileLabel
              ? `${hoveredPercentileLabel} on the current field surface.`
              : null,
            hoveredCell.zoneId ? "Linked to a tracked zone." : "No tracked zone linked to this cell.",
            hoveredSeverityLabel ? `${hoveredSeverityLabel} signal at this cell.` : null,
            hoveredSourceSummary,
          ]
            .filter(Boolean)
            .join(" ")
        : [
            interpretationByMode[mode],
            trackedZoneFocusSignal
              ? "Tracked zones contain the strongest localized pockets on the active surface."
              : null,
            untrackedPocketSignal
              ? "Untracked pockets stand out beyond the current zone coverage."
              : null,
            broadStressSignal
              ? "The field baseline is shifted, but local contrast is still limited."
              : localizedContrastSignal
                ? "The main signal is localized contrast inside the field, not just a field-wide shift."
                : null,
          ]
            .filter(Boolean)
            .join(" "),
    risk:
      preseasonOpticalContext && (mode === "ndvi" || mode === "ndre" || mode === "ndmi")
        ? `Use Moisture and ${radarWetnessLabel} for current decisions. Optical layers are preseason context until stage is verified.`
        : trackedZoneFocusSignal
          ? `Start with tracked-zone pockets first. ${localizedCriticalInZonesPct > 0 ? "Some tracked pockets are already in localized critical territory." : "The strongest contrast already aligns with tracked zones."}`
        : untrackedPocketSignal
          ? `Untracked pockets now exceed the tracked-zone signal. Review the field for new zones before treating uniformly.`
        : broadStressSignal
          ? `Treat this as a field-wide baseline shift before escalating to localized intervention.`
        : localizedContrastSignal
          ? `Focus on the strongest localized pockets first rather than treating the whole field uniformly.`
        : action?.recommendation ?? contract.heightMeaning,
    riskLevel: preseasonOpticalContext ? "Context Only" : riskLevel,
    sourceSummary,
  };
}
