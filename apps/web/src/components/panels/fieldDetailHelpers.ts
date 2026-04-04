/**
 * Pure helper/utility functions for FieldDetailPanel.
 *
 * Parsing, formatting, percentile math, data finders, surface resolution.
 * Extracted from FieldDetailPanel.tsx — no behavior change.
 */

import {
  formatMetricDisplayValue,
  type FieldAgronomicSurfaceMetricKey,
  type FieldAgronomicSurfaceRenderModel,
  type FieldAgronomicAlternateSurfaceRenderModel,
  type FieldBoundaryPreviewRenderModel,
} from "@fieldpulse/map";
import type { ModeKey } from "./fieldDetailTypes";
import { MODE_TO_METRIC_KEY } from "./fieldDetailTypes";
import type { FieldReportProps } from "./ReportTab";
import type { FieldMarketProps } from "./MarketTab";
import type { FieldCropProps } from "../../features/fields/tabs/CropTab";

/* ── Parsing & formatting ───────────────────────────────────────── */

export function parseNumericValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const match = value.match(/-?\d+(\.\d+)?/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function hasDisplayValue(value: string | null | undefined) {
  if (value == null) {
    return false;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return false;
  }

  return normalized !== "—" && normalized.toLowerCase() !== "no data";
}

export function percentile(sortedValues: readonly number[], fraction: number) {
  if (sortedValues.length === 0) {
    return null;
  }

  const clampedFraction = Math.min(1, Math.max(0, fraction));
  const rawIndex = (sortedValues.length - 1) * clampedFraction;
  const lowerIndex = Math.floor(rawIndex);
  const upperIndex = Math.ceil(rawIndex);
  const lowerValue = sortedValues[lowerIndex]!;
  const upperValue = sortedValues[upperIndex]!;

  if (lowerIndex === upperIndex) {
    return lowerValue;
  }

  const weight = rawIndex - lowerIndex;
  return lowerValue + (upperValue - lowerValue) * weight;
}

export function titleCaseLabel(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatSignedMetricDelta(
  metricKey: FieldAgronomicSurfaceMetricKey,
  pct: number | null | undefined,
) {
  if (!Number.isFinite(pct)) {
    return "—";
  }

  const sign = pct! > 0 ? "+" : pct! < 0 ? "−" : "";
  return `${sign}${formatMetricDisplayValue(metricKey, Math.abs(pct!))}`;
}

/* ── Spark builders ─────────────────────────────────────────────── */

export function buildSparkFromSurface(surface: FieldAgronomicSurfaceRenderModel | FieldAgronomicAlternateSurfaceRenderModel | null) {
  const cellsList = surface ? (Array.isArray(surface.cells) ? surface.cells : Object.values(surface.cells)) : [];
  if (!surface || cellsList.length === 0) {
    return [0, 0, 0, 0, 0, 0];
  }

  const sorted = [...cellsList]
    .map((cell) => cell.metricValuePct)
    .sort((left, right) => left - right);

  return [0.1, 0.25, 0.4, 0.6, 0.75, 0.9].map(
    (fraction) => percentile(sorted, fraction) ?? surface.metricAveragePct,
  );
}

export function splitMetricDisplayParts(
  metricKey: FieldAgronomicSurfaceMetricKey,
  pct: number | null | undefined,
) {
  const label = formatMetricDisplayValue(metricKey, pct);

  if (label === "—") {
    return { display: "—", unit: "" };
  }

  if (label.endsWith("%")) {
    return {
      display: label.slice(0, -1),
      unit: "%",
    };
  }

  return {
    display: label,
    unit: "",
  };
}

/* ── Surface resolution ─────────────────────────────────────────── */

export function resolveSurfaceForMode(
  mapModel: FieldBoundaryPreviewRenderModel | null | undefined,
  mode: ModeKey,
) {
  if (!mapModel) {
    return null;
  }

  const metricKey = MODE_TO_METRIC_KEY[mode];

  if (mapModel.agronomicSurface?.metricKey === metricKey) {
    return mapModel.agronomicSurface;
  }

  return mapModel.alternateAgronomicSurfaces?.[metricKey] ?? null;
}

export function formatSurfaceMetricValue(
  mapModel: FieldBoundaryPreviewRenderModel | null | undefined,
  mode: ModeKey,
) {
  const surface = resolveSurfaceForMode(mapModel, mode);
  return formatMetricDisplayValue(MODE_TO_METRIC_KEY[mode], surface?.metricAveragePct ?? null);
}

export function isPreseasonOpticalContextSurface(
  surface: FieldAgronomicSurfaceRenderModel | FieldAgronomicAlternateSurfaceRenderModel | null | undefined,
) {
  const normalized = surface?.sourceLabel?.toLowerCase() ?? "";
  return normalized.includes("preseason-optical-context") || normalized.includes("context-only");
}

/* ── Data finders (null-safe lookups) ───────────────────────────── */

export function findContextTile(field: FieldMarketProps | null, label: string) {
  return field?.contextTiles.find((tile) => tile.label === label) ?? null;
}

export function findReportReading(field: FieldReportProps | null, iconKey: FieldReportProps["readings"][number]["iconKey"]) {
  return field?.readings.find((reading) => reading.iconKey === iconKey) ?? null;
}

export function findReportChart(field: FieldReportProps | null, index: number) {
  return field?.charts[index] ?? null;
}

export function findLatestReportChartPointValue(
  chart: FieldReportProps["charts"][number] | null,
  seriesIndex = 0,
) {
  const points = chart?.series[seriesIndex]?.points ?? [];
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const value = points[index]?.value;
    if (value != null && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

export function buildSparkFromReportChart(
  chart: FieldReportProps["charts"][number] | null,
  seriesIndex = 0,
) {
  const points = chart?.series[seriesIndex]?.points ?? [];
  const values = points
    .map((point) => point.value)
    .filter((value): value is number => value != null && Number.isFinite(value));

  return values.length > 0 ? values : [0];
}

export function buildSparkFromReportChartSeries(
  series: FieldReportProps["charts"][number]["series"][number] | null | undefined,
) {
  const values = (series?.points ?? [])
    .map((point) => point.value)
    .filter((value): value is number => value != null && Number.isFinite(value));

  return values.length > 0 ? values : [0];
}

export function resolveReportChartRangeLabels(
  chart: FieldReportProps["charts"][number] | null,
  seriesIndex = 0,
) {
  const points = chart?.series[seriesIndex]?.points ?? [];
  return {
    start: points[0]?.label ?? "Start",
    end: points.at(-1)?.label ?? "Latest",
  };
}

export function resolveModeTrendChart(
  report: FieldReportProps | null,
  mode: ModeKey,
) {
  const vegetationChart = findReportChart(report, 0);
  const moistureChart = findReportChart(report, 1);

  switch (mode) {
    case "moisture":
      return {
        chart: moistureChart,
        series: moistureChart?.series[0] ?? null,
      };
    case "ndvi":
      return {
        chart: vegetationChart,
        series: vegetationChart?.series[0] ?? null,
      };
    case "ndre":
      return {
        chart: vegetationChart,
        series: vegetationChart?.series[1] ?? null,
      };
    case "ndmi":
      return {
        chart: moistureChart,
        series: null,
      };
    case "radarWetness":
      return {
        chart: moistureChart,
        series: moistureChart?.series[2] ?? moistureChart?.series[0] ?? null,
      };
  }
}

/* ── Crop data finders ──────────────────────────────────────────── */

export function findCropFieldTile(field: FieldCropProps | null, label: string) {
  return field?.fieldTiles.find((tile) => tile.label === label) ?? null;
}

export function findCropProvenanceValue(field: FieldCropProps | null, key: string) {
  return field?.provenanceRows.find((row) => row.key === key)?.value ?? null;
}
