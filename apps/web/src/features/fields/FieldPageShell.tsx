"use client";

import type {
  CellClickEvent,
  CellHoverEvent,
  FieldBoundaryPreviewRenderModel,
} from "@fieldpulse/map";
import {
  describeCellAnomalyClass,
  describeCellAttentionLevel,
  describeCellSourceTier,
  formatCellPercentile,
  formatMetricDisplayValue,
  resolveCellAttentionLevel,
  resolveMetricModeContract,
} from "@fieldpulse/map";
import {
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WorkspaceShell } from "../../components/layout/WorkspaceShell";
import type { SidebarFieldItem } from "../../components/layout/Sidebar";
import {
  type ActionTag,
  type FieldActionProps,
} from "../../components/panels/ActionTab";
import {
  type FieldNotesProps,
} from "../../components/panels/NotesTab";
import {
  type FieldSummaryProps,
} from "../../components/panels/SummaryTab";
import {
  type FieldMarketProps,
} from "../../components/panels/MarketTab";
import {
  type FieldReportProps,
  type ReadingIconKey,
} from "../../components/panels/ReportTab";
import { AlertsPanel, type AlertsPanelProps } from "../../components/panels/AlertsPanel";
import {
  ZoneDetailPanel,
  type ZoneDetailPanelCell,
  type ZoneDetailPanelFinding,
  type ZoneDetailPanelZone,
} from "../../components/panels/ZoneDetailPanel";
import { CropTab, type FieldCropProps } from "./tabs/CropTab";
import { LazyFieldBoundaryMap } from "./LazyFieldBoundaryMap";
import type {
  FieldCellInspectorCell,
  FieldCellInspectorModel,
} from "./CellInspectorModel";
import { SelectedCellInspector } from "./SelectedCellInspector";
import type { FieldActivityPanelModel } from "./FieldActivityPanelModel";
import { FieldActivityPanel } from "./FieldActivityPanel";
import {
  FieldDetailPanel,
  MODE_TO_METRIC_KEY,
  type ModeKey,
} from "../../components/panels/FieldDetailPanel";
import {
  chooseFirstInsightField,
  type FirstInsightFieldEntry,
} from "./firstInsightChooser";
import { SettingsPanel } from "../../components/panels/SettingsPanel";
import {
  AddFieldPanel,
  type CommitFieldHydrationSummary,
} from "../../components/panels/AddFieldPanel";
import { HydrationOverlay } from "../../components/ui/HydrationOverlay";

export interface FieldPageShellProps {
  workspaceId?: string | null;
  fields: SidebarFieldItem[];
  activeFieldId: string;
  activeFieldName: string;
  summary: FieldSummaryProps | null;
  report: FieldReportProps | null;
  action: FieldActionProps | null;
  notes: FieldNotesProps | null;
  market: FieldMarketProps | null;
  crop: FieldCropProps | null;
  alerts: AlertsPanelProps | null;
  mapModel: FieldBoundaryPreviewRenderModel;
  cellInspector: FieldCellInspectorModel | null;
  activity: FieldActivityPanelModel | null;
}

type PanelView = "detail" | "alerts" | "activity" | "cell" | "action" | "notes" | "crops" | "settings" | "zoneDetail" | "addField" | "none";
type CellInteractionSelection = CellClickEvent | CellHoverEvent;
const DETAIL_PANEL_MODES: readonly ModeKey[] = ["moisture", "ndvi", "ndre", "ndmi", "radarWetness"];
const ONBOARDING_STATUS_POLL_MS = 3_000;
const PENDING_ONBOARDING_STORAGE_KEY = "fieldpulse:pending-onboarding-watch";

type PendingOnboardingWatch = {
  workspaceId?: string | null;
  preferredFieldId?: string | null;
  fieldIds: string[];
  dispatchIds: string[];
  dispatchFieldEntries?: readonly {
    dispatchId: string;
    fieldId: string;
    fieldLabel: string;
  }[];
};

type OnboardingDispatchSnapshot = {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  activePhaseLabel?: string | null;
  progressPct?: number | null;
  progressMessage?: string | null;
  fieldId?: string | null;
};

type JobDispatchSnapshot = {
  id: string;
  key: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  activePhaseLabel: string | null;
  progressPct: number | null;
  progressMessage: string | null;
  updatedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  lastError: string | null;
  fieldId: string | null;
};

function parsePendingOnboardingWatch(raw: string | null): PendingOnboardingWatch | null {
  if (!raw) {
    return null;
  }

  try {
    const value = JSON.parse(raw) as Partial<PendingOnboardingWatch>;
    const dispatchIds = Array.isArray(value.dispatchIds)
      ? value.dispatchIds.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
      : [];
    const fieldIds = Array.isArray(value.fieldIds)
      ? value.fieldIds.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
      : [];
    const dispatchFieldEntries = Array.isArray(value.dispatchFieldEntries)
      ? value.dispatchFieldEntries.filter(
          (
            entry,
          ): entry is {
            dispatchId: string;
            fieldId: string;
            fieldLabel: string;
          } =>
            typeof entry === "object" &&
            entry != null &&
            typeof entry.dispatchId === "string" &&
            entry.dispatchId.length > 0 &&
            typeof entry.fieldId === "string" &&
            entry.fieldId.length > 0 &&
            typeof entry.fieldLabel === "string",
        )
      : [];

    if (dispatchIds.length === 0) {
      return null;
    }

    return {
      workspaceId: typeof value.workspaceId === "string" ? value.workspaceId : null,
      preferredFieldId:
        typeof value.preferredFieldId === "string" ? value.preferredFieldId : null,
      dispatchIds,
      fieldIds,
      dispatchFieldEntries,
    };
  } catch {
    return null;
  }
}

export function shouldResumeFieldPageOnboardingWatch(
  watch: PendingOnboardingWatch | null,
  workspaceId?: string | null,
): boolean {
  if (!watch || watch.dispatchIds.length === 0) {
    return false;
  }

  if (workspaceId && watch.workspaceId && workspaceId !== watch.workspaceId) {
    return false;
  }

  return true;
}

export function resolveFieldPageCanonicalDetailInitialPage(
  panelView: PanelView,
): "actions" | "notes" | "crops" | null {
  switch (panelView) {
    case "action":
      return "actions";
    case "notes":
      return "notes";
    case "crops":
      return "crops";
    default:
      return null;
  }
}

function resolveAvailableDetailModes(
  mapModel: FieldBoundaryPreviewRenderModel,
): readonly ModeKey[] {
  return DETAIL_PANEL_MODES.filter((mode) => {
    const metricKey = MODE_TO_METRIC_KEY[mode];
    if (mapModel.agronomicSurface?.metricKey === metricKey) {
      return true;
    }

    return mapModel.alternateAgronomicSurfaces?.[metricKey] != null;
  });
}

function resolveDetailFieldMeta(
  summary: FieldSummaryProps | null,
  crop: FieldCropProps | null,
  areaLabel?: string,
) {
  const cropLabel = summary?.crop || crop?.cropName;
  const stageLabel = summary?.cropStage || crop?.thresholdStageLabel;
  return [cropLabel, stageLabel, areaLabel].filter(Boolean).join(" · ");
}

function formatMetricLabel(
  metricKey: CellInteractionSelection["metricKey"],
  sourceLabel?: string,
) {
  return resolveMetricModeContract(metricKey, sourceLabel).label;
}

function formatHoverMetricValue(selection: CellInteractionSelection): string {
  return formatMetricDisplayValue(selection.metricKey, selection.metricValuePct);
}

function describeHoverContext(
  selection: CellInteractionSelection,
  sourceDescription: string,
) {
  const fieldRelativeLabel = `${formatCellPercentile(selection.percentileInField)} · ${describeCellAnomalyClass(selection.anomalyClass)}`;

  if (selection.metricKey === "radar-wetness") {
    return `Radar wetness hover · ${fieldRelativeLabel} · ${sourceDescription}`;
  }

  if (selection.metricKey === "ndmi") {
    return `Canopy-water hover · ${fieldRelativeLabel} · ${sourceDescription}`;
  }

  return `${formatMetricLabel(selection.metricKey, sourceDescription)} hover · ${fieldRelativeLabel} · ${sourceDescription}`;
}

function resolveRootMoistureSubLabel(
  selection: CellInteractionSelection,
  sourceDescription: string,
) {
  const fieldRelativeLabel = `${formatCellPercentile(selection.percentileInField)} · ${describeCellAnomalyClass(selection.anomalyClass)}`;

  if (
    selection.metricKey === "root-zone-moisture-pct" ||
    selection.metricKey === "surface-moisture-pct"
  ) {
    return `${selection.severityLabel ?? "active"} · ${fieldRelativeLabel} · ${sourceDescription}`;
  }

  if (selection.metricKey === "radar-wetness") {
    return `Radar wetness context · ${fieldRelativeLabel} · ${sourceDescription}`;
  }

  if (selection.metricKey === "ndmi") {
    return `Canopy-water context · ${fieldRelativeLabel} · ${sourceDescription}`;
  }

  return `Moisture context · ${formatMetricLabel(selection.metricKey, sourceDescription)} hover · ${fieldRelativeLabel}`;
}

function resolveCropHealthSectionTitle(
  metricKey: CellInteractionSelection["metricKey"],
) {
  switch (metricKey) {
    case "ndvi":
      return "NDVI VIGOR INDEX";
    case "ndre":
      return "NDRE RED-EDGE INDEX";
    case "ndmi":
      return "NDMI CANOPY WATER INDEX";
    case "radar-wetness":
      return "RADAR WETNESS INDEX";
    default:
      return "CANOPY SIGNAL CONTEXT";
  }
}

function resolveCropMoistureSectionTitle(
  metricKey: CellInteractionSelection["metricKey"],
) {
  if (
    metricKey === "root-zone-moisture-pct" ||
    metricKey === "surface-moisture-pct"
  ) {
    return "ROOT MOISTURE BALANCE";
  }

  if (metricKey === "radar-wetness") {
    return "RADAR WETNESS CONTEXT";
  }

  return "ROOT MOISTURE CONTEXT";
}

function resolveReportSignalIconKey(
  metricKey: CellInteractionSelection["metricKey"],
): ReadingIconKey {
  switch (metricKey) {
    case "ndre":
      return "ndre";
    case "ndmi":
      return "ndmi";
    case "radar-wetness":
      return "radar-wetness";
    case "ndvi":
    default:
      return "ndvi";
  }
}

function formatVarianceBucket(value: CellInteractionSelection["varianceBucket"]) {
  return value.replace(/-/g, " ");
}

function resolveSelectionAttention(selection: CellInteractionSelection) {
  return resolveCellAttentionLevel({
    metricKey: selection.metricKey,
    severityLabel: selection.severityLabel,
    anomalyClass: selection.anomalyClass,
    deltaFromFieldAvgPct: selection.deltaFromFieldAvgPct,
    percentileInField: selection.percentileInField,
  });
}

function attentionColor(level: ReturnType<typeof resolveSelectionAttention>) {
  if (level === "critical") {
    return "#ef4444";
  }

  if (level === "watch") {
    return "#f59e0b";
  }

  return "#16a34a";
}

function deriveFieldState(
  rootZonePct: number | null,
  selection: CellInteractionSelection,
) {
  if (rootZonePct != null) {
    if (rootZonePct < 25) {
      return { label: "Critical", color: "#ef4444" };
    }
    if (rootZonePct < 40) {
      return { label: "Watch", color: "#f59e0b" };
    }
    return { label: "Adequate", color: "#16a34a" };
  }

  const attention = resolveSelectionAttention(selection);
  return {
    label: describeCellAttentionLevel(attention),
    color: attentionColor(attention),
  };
}

function severityRank(
  value: "low" | "medium" | "high" | "critical" | null | undefined,
) {
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

function buildInteractiveSummary(
  summary: FieldSummaryProps | null,
  selection: CellHoverEvent | null,
  model: FieldCellInspectorModel | null,
): FieldSummaryProps | null {
  if (!summary || !selection) {
    return summary;
  }

  const cell = model?.cells.find((entry) => entry.id === selection.cellId) ?? null;
  const relatedFindings =
    model?.findings.filter((finding) => finding.affectedCellKeys.includes(selection.cellId)) ?? [];
  const rootZonePct =
    cell?.rootZonePct ??
    (selection.metricKey === "root-zone-moisture-pct" ? selection.metricValuePct : null);
  const surfacePct =
    cell?.surfacePct ??
    (selection.metricKey === "surface-moisture-pct" ? selection.metricValuePct : null);
  const state = deriveFieldState(rootZonePct, selection);
  const cellLabel = cell
    ? `Cell r${cell.rowIndex + 1} · c${cell.columnIndex + 1}`
    : `Cell ${selection.cellId.toUpperCase()}`;
  const observedLabel =
    cell?.observedAt != null
      ? `UPDATED ${new Date(cell.observedAt).toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        }).toUpperCase()}`
      : summary.updatedLabel;
  const sourceDescription = describeCellSourceTier(
    selection.sourceTier,
    selection.metricKey,
  );

  return {
    ...summary,
    contextLabel: cellLabel,
    conditionsMeta: describeHoverContext(selection, sourceDescription),
    updatedLabel: observedLabel,
    moisture: rootZonePct != null ? rootZonePct / 100 : summary.moisture,
    surfaceMoisture:
      surfacePct != null ? `${surfacePct.toFixed(1)}%` : summary.surfaceMoisture,
    fieldState: state.label,
    fieldStateColor: state.color,
    rootMoisture:
      rootZonePct != null ? `${rootZonePct.toFixed(1)}%` : summary.rootMoisture,
    rootMoistureSub: resolveRootMoistureSubLabel(selection, sourceDescription),
    trend: `${selection.deltaFromFieldAvgPct > 0 ? "+" : ""}${selection.deltaFromFieldAvgPct.toFixed(1)}%`,
    trendSub: `${formatMetricLabel(selection.metricKey, sourceDescription)} vs field average`,
    spread: formatVarianceBucket(selection.varianceBucket),
    spreadSub: `${formatMetricLabel(selection.metricKey, sourceDescription)} variability`,
    confidence: `${Math.round(selection.confidence * 100)}%`,
    confidenceSub: sourceDescription,
    alerts:
      relatedFindings.length > 0
        ? relatedFindings.slice(0, 3).map((finding) => ({
            label: finding.title,
            desc: finding.summary ?? finding.family.replace(/_/g, " "),
            severity:
              finding.severity === "critical" || finding.severity === "high"
                ? "danger"
                : "warning",
          }))
        : summary.alerts,
  };
}

function buildInteractiveReport(
  report: FieldReportProps | null,
  selection: CellHoverEvent | null,
  model: FieldCellInspectorModel | null,
): FieldReportProps | null {
  if (!report || !selection) {
    return report;
  }

  const cell = model?.cells.find((entry) => entry.id === selection.cellId) ?? null;
  const cellLabel = cell
    ? `Cell r${cell.rowIndex + 1} · c${cell.columnIndex + 1}`
    : `Cell ${selection.cellId.toUpperCase()}`;
  const relatedZoneIds = selection.zoneId ? [selection.zoneId] : [];
  const matchingZoneIds = new Set<string>(relatedZoneIds);
  const relatedFindings =
    report.findings.filter((finding) =>
      finding.trackedZoneIds.some((zoneId) => matchingZoneIds.has(zoneId)),
    );
  const relatedAlerts =
    report.alerts.filter((alert) =>
      alert.trackedZoneIds.some((zoneId) => matchingZoneIds.has(zoneId)),
    );
  const relatedZones = report.zones.filter((zone) => matchingZoneIds.has(zone.id));
  const sourceDescription = describeCellSourceTier(
    selection.sourceTier,
    selection.metricKey,
  );
  const fieldRelativeLabel = `${formatCellPercentile(selection.percentileInField)} · ${describeCellAnomalyClass(selection.anomalyClass)}`;
  const attention = resolveSelectionAttention(selection);
  const attentionLabel = describeCellAttentionLevel(attention);
  const attentionTone = attentionColor(attention);

  const readings = report.readings.map((reading) => {
    if (reading.label === "Soil Moisture" || reading.label === "Root Moisture") {
      const rootZonePct =
        cell?.rootZonePct ??
        (selection.metricKey === "root-zone-moisture-pct" ? selection.metricValuePct : null);
      return {
        ...reading,
        value: rootZonePct != null ? `${rootZonePct.toFixed(1)}%` : reading.value,
      };
    }

    if (
      reading.iconKey === "ndvi" ||
      reading.iconKey === "ndre" ||
      reading.iconKey === "ndmi" ||
      reading.iconKey === "radar-wetness" ||
      reading.label === "NDVI" ||
      reading.label === "NDRE" ||
      reading.label === "NDMI" ||
      reading.label === "Radar Wetness"
    ) {
      if (
        selection.metricKey !== "ndvi" &&
        selection.metricKey !== "ndre" &&
        selection.metricKey !== "ndmi" &&
        selection.metricKey !== "radar-wetness"
      ) {
        return reading;
      }

      return {
        ...reading,
        iconKey: resolveReportSignalIconKey(selection.metricKey),
        label: formatMetricLabel(selection.metricKey, sourceDescription),
        value: formatHoverMetricValue(selection),
        valueColor: attentionTone,
      };
    }

    if (reading.label === "Stress Area") {
      return {
        ...reading,
        value:
          relatedFindings.length > 0
            ? `${relatedFindings.length} linked`
            : `${attentionLabel.toLowerCase()} cell`,
      };
    }

    return reading;
  });

  return {
    ...report,
    updatedDate: cell?.observedAt
      ? new Date(cell.observedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : report.updatedDate,
    alerts: relatedAlerts.length > 0 ? relatedAlerts : report.alerts,
    findings: relatedFindings.length > 0 ? relatedFindings : report.findings,
    zones: relatedZones.length > 0 ? relatedZones : report.zones,
    provenanceText: `${cellLabel} · ${formatMetricLabel(selection.metricKey, sourceDescription)} ${formatHoverMetricValue(selection)} · ${fieldRelativeLabel} · ${sourceDescription} · Δ vs field average ${selection.deltaFromFieldAvgPct > 0 ? "+" : ""}${selection.deltaFromFieldAvgPct.toFixed(1)}%.`,
  };
}

function buildInteractiveCrop(
  crop: FieldCropProps | null,
  selection: CellHoverEvent | null,
  model: FieldCellInspectorModel | null,
): FieldCropProps | null {
  if (!crop || !selection) {
    return crop;
  }

  const cell = model?.cells.find((entry) => entry.id === selection.cellId) ?? null;
  const cellLabel = cell
    ? `Cell r${cell.rowIndex + 1} · c${cell.columnIndex + 1}`
    : `Cell ${selection.cellId.toUpperCase()}`;
  const rootZonePct =
    cell?.rootZonePct ??
    (selection.metricKey === "root-zone-moisture-pct" ? selection.metricValuePct : null);
  const surfacePct =
    cell?.surfacePct ??
    (selection.metricKey === "surface-moisture-pct" ? selection.metricValuePct : null);
  const state = deriveFieldState(rootZonePct, selection);
  const relatedFindings =
    model?.findings.filter((finding) => finding.affectedCellKeys.includes(selection.cellId)) ?? [];
  const sourceDescription = describeCellSourceTier(
    selection.sourceTier,
    selection.metricKey,
  );
  const fieldRelativeLabel = `${formatCellPercentile(selection.percentileInField)} · ${describeCellAnomalyClass(selection.anomalyClass)}`;
  const attention = resolveSelectionAttention(selection);
  const attentionLabel = describeCellAttentionLevel(attention);
  const severityColor = attentionColor(attention);

  return {
    ...crop,
    healthIndexTitle: resolveCropHealthSectionTitle(selection.metricKey),
    moistureBalance: {
      ...crop.moistureBalance,
      value: rootZonePct != null ? rootZonePct / 100 : crop.moistureBalance.value,
      label: rootZonePct != null ? `${rootZonePct.toFixed(0)}%` : crop.moistureBalance.label,
      subLabel: describeHoverContext(selection, sourceDescription),
      fillColor: state.color,
      metrics: [
        {
          label: "Status",
          value: state.label,
          valueColor: state.color,
        },
        {
          label: "Surface",
          value: surfacePct != null ? `${surfacePct.toFixed(1)}%` : "—",
          valueColor: "#3b82f6",
        },
        {
          label: "Source",
          value: sourceDescription,
          valueColor: "#6b7280",
        },
      ],
    },
    moistureBalanceTitle: resolveCropMoistureSectionTitle(selection.metricKey),
    healthIndex:
      selection.metricKey === "ndvi" ||
      selection.metricKey === "ndre" ||
      selection.metricKey === "ndmi" ||
      selection.metricKey === "radar-wetness"
        ? {
            ...crop.healthIndex,
            value: selection.metricValuePct / 100,
            label: (selection.metricValuePct / 100).toFixed(2),
            subLabel: describeHoverContext(selection, sourceDescription),
            fillColor: severityColor,
            metrics: [
              {
                label: "Focus",
                value: cellLabel,
                valueColor: "#6b7280",
              },
              {
                label: "Attention",
                value: attentionLabel,
                valueColor: severityColor,
              },
              {
                label: "Δ avg",
                value: `${selection.deltaFromFieldAvgPct > 0 ? "+" : ""}${selection.deltaFromFieldAvgPct.toFixed(1)}%`,
                valueColor: severityColor,
              },
            ],
          }
        : crop.healthIndex,
    alerts:
      relatedFindings.length > 0
        ? relatedFindings.slice(0, 2).map((finding) => ({
            iconKey:
              finding.family === "disease_risk"
                ? "disease"
                : finding.family === "weather_risk"
                  ? "temperature"
                  : "moisture",
            iconColor:
              finding.severity === "critical" || finding.severity === "high"
                ? "#ef4444"
                : finding.severity === "medium"
                  ? "#f59e0b"
                  : "#16a34a",
            bg:
              finding.severity === "critical" || finding.severity === "high"
                ? "#fef2f2"
                : finding.severity === "medium"
                  ? "#fffbeb"
                  : "#f0fdf4",
            title: finding.title,
            desc: finding.summary ?? finding.family.replace(/_/g, " "),
          }))
        : crop.alerts,
    provenanceRows: crop.provenanceRows.map((row) => {
      if (row.key === "Source") {
        return { ...row, value: sourceDescription };
      }
      if (row.key === "Grid Cells") {
        return { ...row, value: cellLabel };
      }
      if (row.key === "Moisture Source" && cell?.sourceKey) {
        return { ...row, value: cell.sourceKey };
      }
      return row;
    }),
    footer: `${cellLabel} · ${formatMetricLabel(selection.metricKey, sourceDescription)} ${formatHoverMetricValue(selection)} · ${sourceDescription}`,
  };
}

function buildInteractiveAction(
  action: FieldActionProps | null,
  selection: CellHoverEvent | null,
  model: FieldCellInspectorModel | null,
): FieldActionProps | null {
  if (!action || !selection) {
    return action;
  }

  const cell = model?.cells.find((entry) => entry.id === selection.cellId) ?? null;
  const cellLabel = cell
    ? `Cell r${cell.rowIndex + 1} · c${cell.columnIndex + 1}`
    : `Cell ${selection.cellId.toUpperCase()}`;
  const relatedFindings =
    model?.findings.filter((finding) => finding.affectedCellKeys.includes(selection.cellId)) ?? [];
  const primaryFinding = relatedFindings[0] ?? null;
  const urgency =
    resolveSelectionAttention(selection) === "critical"
      ? "Urgent"
      : resolveSelectionAttention(selection) === "watch"
        ? "Watch"
        : action.urgency;
  const sourceDescription = describeCellSourceTier(
    selection.sourceTier,
    selection.metricKey,
  );
  const fieldRelativeLabel = `${formatCellPercentile(selection.percentileInField)} · ${describeCellAnomalyClass(selection.anomalyClass)}`;
  const attention = resolveSelectionAttention(selection);
  const attentionLabel = describeCellAttentionLevel(attention);
  const attentionTone = attentionColor(attention);

  return {
    ...action,
    recommendation:
      primaryFinding?.recommendedAction ??
      `Inspect ${cellLabel.toLowerCase()} and verify the ${formatMetricLabel(selection.metricKey, sourceDescription).toLowerCase()} signal against field conditions using the current ${sourceDescription.toLowerCase()}.`,
    dueDate:
      attention === "critical"
        ? "Within 24h"
        : attention === "watch"
          ? "Within 48h"
          : action.dueDate,
    explanation:
      primaryFinding?.summary ??
      `${cellLabel} is currently ${attentionLabel.toLowerCase()} on ${formatMetricLabel(selection.metricKey, sourceDescription).toLowerCase()} (${formatHoverMetricValue(selection)}), sitting ${fieldRelativeLabel} with a delta of ${selection.deltaFromFieldAvgPct > 0 ? "+" : ""}${selection.deltaFromFieldAvgPct.toFixed(1)}% versus the field average from a ${sourceDescription.toLowerCase()}.`,
    urgency,
    confidence: `${Math.round(selection.confidence * 100)}% hover confidence`,
    signalCount: Math.max(1, relatedFindings.length + 2),
    signals: ([
      {
        label: `${formatMetricLabel(selection.metricKey, sourceDescription)} ${formatHoverMetricValue(selection)}`,
        color:
          attention === "critical"
            ? ("red" as const)
            : attention === "watch"
              ? ("yellow" as const)
              : ("green" as const),
        detail: [
          selection.zoneId ? "Linked tracked zone" : "No tracked zone link",
          fieldRelativeLabel,
          sourceDescription,
        ].join(" · "),
      },
      {
        label: `${formatCellPercentile(selection.percentileInField)} ${describeCellAnomalyClass(selection.anomalyClass)}`,
        color:
          Math.abs(selection.deltaFromFieldAvgPct) >= 10
            ? ("red" as const)
            : Math.abs(selection.deltaFromFieldAvgPct) >= 5
              ? ("yellow" as const)
              : ("green" as const),
        detail: `Δ avg ${selection.deltaFromFieldAvgPct > 0 ? "+" : ""}${selection.deltaFromFieldAvgPct.toFixed(1)}% · ${selection.varianceBucket.replace(/-/g, " ")} variance`,
      },
      {
        label: sourceDescription,
        color: "green" as const,
        detail: `${Math.round(selection.confidence * 100)}% hover confidence`,
      },
      ...relatedFindings.slice(0, 1).map((finding) => ({
        label: finding.family.replace(/_/g, " "),
        color:
          finding.severity === "critical" || finding.severity === "high"
            ? ("red" as const)
            : finding.severity === "medium"
              ? ("yellow" as const)
              : ("green" as const),
        detail: finding.title,
      })),
    ] satisfies ActionTag[]).slice(0, 4),
    questions: [
      {
        question: "What should I inspect first?",
        answer:
          primaryFinding?.recommendedAction ??
          `Start with ${cellLabel.toLowerCase()} and the surrounding affected cells in the same tracked zone.`,
        tags: [
          { label: cellLabel, color: "green" },
          {
            label: attentionLabel,
            color:
              attention === "critical"
                ? "red"
                : attention === "watch"
                  ? "yellow"
                  : "green",
          },
        ],
      },
      {
        question: "Why this cell right now?",
        answer: `${cellLabel} is ${selection.deltaFromFieldAvgPct > 0 ? `${selection.deltaFromFieldAvgPct.toFixed(1)}% above` : `${Math.abs(selection.deltaFromFieldAvgPct).toFixed(1)}% below`} the field average on ${formatMetricLabel(selection.metricKey, sourceDescription).toLowerCase()}, sitting ${fieldRelativeLabel}.`,
        tags: [
          { label: selection.varianceBucket.replace(/-/g, " "), color: "yellow" },
          { label: sourceDescription, color: "green" },
        ],
      },
      action.questions[2],
    ],
  };
}

function buildInteractiveAlerts(
  alerts: AlertsPanelProps | null,
  selection: CellHoverEvent | null,
  model: FieldCellInspectorModel | null,
): AlertsPanelProps | null {
  if (!alerts || !selection) {
    return alerts;
  }

  const cell = model?.cells.find((entry) => entry.id === selection.cellId) ?? null;
  const cellLabel = cell
    ? `Cell r${cell.rowIndex + 1} · c${cell.columnIndex + 1}`
    : `Cell ${selection.cellId.toUpperCase()}`;
  const relatedFindings =
    model?.findings.filter((finding) => finding.affectedCellKeys.includes(selection.cellId)) ?? [];
  const zoneIds = new Set<string>();

  if (selection.zoneId) {
    zoneIds.add(selection.zoneId);
  }

  for (const finding of relatedFindings) {
    for (const zoneId of finding.trackedZoneIds) {
      zoneIds.add(zoneId);
    }
  }

  for (const zone of model?.zones ?? []) {
    if (zone.affectedCellKeys.includes(selection.cellId)) {
      zoneIds.add(zone.id);
    }
  }

  const activeAlerts = alerts.activeAlerts.filter((alert) =>
    alert.trackedZoneIds.some((zoneId) => zoneIds.has(zoneId)),
  );
  const resolvedAlerts = alerts.resolvedAlerts.filter((alert) =>
    alert.trackedZoneIds.some((zoneId) => zoneIds.has(zoneId)),
  );

  return {
    ...alerts,
    activeAlerts,
    resolvedAlerts,
    activeCount: activeAlerts.length,
    criticalCount: activeAlerts.filter((alert) => alert.severity === "critical").length,
    weekCount: activeAlerts.length + resolvedAlerts.length,
    contextLabel: `${cellLabel} · linked alerts`,
    emptyStateTitle: "No linked alerts",
    emptyStateDescription: `No active or resolved alerts are linked to ${cellLabel}.`,
  };
}

function buildInteractiveActivity(
  activity: FieldActivityPanelModel | null,
  selection: CellHoverEvent | null,
  model: FieldCellInspectorModel | null,
): { activity: FieldActivityPanelModel | null; contextLabel?: string; scopeLabel?: string } {
  if (!activity || !selection) {
    return { activity };
  }

  const cell = model?.cells.find((entry) => entry.id === selection.cellId) ?? null;
  const cellLabel = cell
    ? `cell r${cell.rowIndex + 1} · c${cell.columnIndex + 1}`
    : `cell ${selection.cellId.toUpperCase()}`;
  const relatedFindings =
    model?.findings.filter((finding) => finding.affectedCellKeys.includes(selection.cellId)) ?? [];
  const zoneIds = new Set<string>();
  const findingIds = new Set<string>(relatedFindings.map((finding) => finding.id));

  if (selection.zoneId) {
    zoneIds.add(selection.zoneId);
  }

  for (const finding of relatedFindings) {
    for (const zoneId of finding.trackedZoneIds) {
      zoneIds.add(zoneId);
    }
  }

  for (const zone of model?.zones ?? []) {
    if (zone.affectedCellKeys.includes(selection.cellId)) {
      zoneIds.add(zone.id);
    }
  }

  const findings = activity.findings.filter(
    (finding) =>
      findingIds.has(finding.id) ||
      finding.trackedZoneIds.some((zoneId) => zoneIds.has(zoneId)),
  );
  const zones = activity.zones.filter((zone) => zoneIds.has(zone.id));
  const familySummaries = Array.from(
    zones.reduce((summaries, zone) => {
      const summary = summaries.get(zone.family) ?? {
        family: zone.family,
        activeZoneCount: 0,
        totalZoneCount: 0,
      };
      summary.totalZoneCount += 1;
      if (zone.status !== "resolved") {
        summary.activeZoneCount += 1;
      }
      summaries.set(zone.family, summary);
      return summaries;
    }, new Map<string, { family: string; activeZoneCount: number; totalZoneCount: number }>()),
  ).map(([, summary]) => summary);

  return {
    activity: {
      ...activity,
      activeFindingCount: findings.length,
      activeZoneCount: zones.filter((zone) => zone.status !== "resolved").length,
      newZoneCount: zones.filter((zone) => zone.status === "new").length,
      recoveringZoneCount: zones.filter((zone) => zone.status === "recovering").length,
      resolvedZoneCount: zones.filter((zone) => zone.status === "resolved").length,
      familySummaries,
      findings,
      zones,
    },
    contextLabel: `${cellLabel} · linked findings and zones`,
    scopeLabel: cellLabel,
  };
}

function buildInteractiveNotes(
  notes: FieldNotesProps | null,
  selection: CellHoverEvent | null,
  model: FieldCellInspectorModel | null,
): FieldNotesProps | null {
  if (!notes || !selection) {
    return notes;
  }

  const cell = model?.cells.find((entry) => entry.id === selection.cellId) ?? null;
  const relatedFindings =
    model?.findings
      .filter((finding) => finding.affectedCellKeys.includes(selection.cellId))
      .sort((left, right) => severityRank(right.severity) - severityRank(left.severity)) ?? [];
  const primaryFinding = relatedFindings[0] ?? null;
  const zone =
    (selection.zoneId
      ? model?.zones.find((entry) => entry.id === selection.zoneId) ?? null
      : model?.zones.find((entry) => entry.affectedCellKeys.includes(selection.cellId)) ?? null) ??
    null;

  const scopedEntries = notes.entries.filter(
    (entry) =>
      entry.cellKey === selection.cellId ||
      (primaryFinding != null && entry.findingId === primaryFinding.id) ||
      (zone != null && entry.zoneId === zone.id),
  );

  const cellLabel = cell
    ? `Cell r${cell.rowIndex + 1} · c${cell.columnIndex + 1}`
    : `Cell ${selection.cellId.toUpperCase()}`;
  const metricLabel = formatMetricLabel(
    selection.metricKey,
    describeCellSourceTier(selection.sourceTier, selection.metricKey),
  );
  const targetDate =
    primaryFinding?.startedAt ??
    cell?.observedAt ??
    new Date().toISOString();

  return {
    ...notes,
    inspectionTarget: {
      dateLabel: new Date(targetDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      name:
        primaryFinding?.title ??
        (zone
          ? `${zone.family.replace(/_/g, " ")} · ${zone.trackingKey}`
          : `${metricLabel} · ${formatHoverMetricValue(selection)}`),
      coordinateLabel: `${cellLabel} · ${formatVarianceBucket(selection.varianceBucket)}`,
      findingId: primaryFinding?.id ?? null,
      zoneId: zone?.id ?? null,
      cellKey: selection.cellId,
    },
    entries: scopedEntries,
  };
}

function buildInteractiveMarket(
  market: FieldMarketProps | null,
  selection: CellHoverEvent | null,
  model: FieldCellInspectorModel | null,
): FieldMarketProps | null {
  if (!market || !selection) {
    return market;
  }

  const cell = model?.cells.find((entry) => entry.id === selection.cellId) ?? null;
  const cellLabel = cell
    ? `Cell r${cell.rowIndex + 1} · c${cell.columnIndex + 1}`
    : `Cell ${selection.cellId.toUpperCase()}`;
  const rootZonePct =
    cell?.rootZonePct ??
    (selection.metricKey === "root-zone-moisture-pct" ? selection.metricValuePct : null);
  const surfacePct =
    cell?.surfacePct ??
    (selection.metricKey === "surface-moisture-pct" ? selection.metricValuePct : null);
  const sourceDescription = describeCellSourceTier(
    selection.sourceTier,
    selection.metricKey,
  );
  const hoverContext = describeHoverContext(selection, sourceDescription);

  return {
    ...market,
    contextLabel: cellLabel,
    contextTiles: [
      {
        label: "ROOT MOISTURE",
        value: rootZonePct != null ? `${rootZonePct.toFixed(1)}%` : "—",
        valueColor:
          rootZonePct != null && rootZonePct < 35
            ? "#f59e0b"
            : "#16a34a",
        sub:
          rootZonePct != null
            ? resolveRootMoistureSubLabel(selection, sourceDescription)
            : `Unavailable · ${hoverContext}`,
        bg:
          rootZonePct != null && rootZonePct < 35
            ? "#fffbeb"
            : "#f0fdf4",
      },
      {
        label: "SURFACE MOISTURE",
        value: surfacePct != null ? `${surfacePct.toFixed(1)}%` : "—",
        valueColor:
          surfacePct != null && surfacePct < 20
            ? "#f59e0b"
            : "#3b82f6",
        sub:
          surfacePct != null
            ? `Surface context · ${formatMetricLabel(selection.metricKey, sourceDescription)} hover`
            : `Unavailable · ${hoverContext}`,
        bg:
          surfacePct != null && surfacePct < 20
            ? "#fffbeb"
            : "#eff6ff",
      },
      {
        label: "DELTA VS FIELD",
        value: `${selection.deltaFromFieldAvgPct >= 0 ? "+" : ""}${selection.deltaFromFieldAvgPct.toFixed(1)}%`,
        valueColor:
          selection.deltaFromFieldAvgPct < 0
            ? "#f59e0b"
            : "#16a34a",
        sub: `${hoverContext} · ${formatVarianceBucket(selection.varianceBucket)}`,
        bg:
          selection.deltaFromFieldAvgPct < 0
            ? "#fffbeb"
            : "#f0fdf4",
      },
    ],
    footerText: `${market.footerText} · hover confidence ${Math.round(selection.confidence * 100)}%`,
  };
}

function buildZoneDetailSelection(
  zoneId: string | null,
  activity: FieldActivityPanelModel | null,
  model: FieldCellInspectorModel | null,
):
  | {
      zone: ZoneDetailPanelZone;
      cells: readonly ZoneDetailPanelCell[];
      findings: readonly ZoneDetailPanelFinding[];
    }
  | null {
  if (!zoneId) {
    return null;
  }

  const zone = activity?.zones.find((entry) => entry.id === zoneId);
  const zoneInspector = model?.zones.find((entry) => entry.id === zoneId);

  if (!zone || !zoneInspector) {
    return null;
  }

  const cells: readonly ZoneDetailPanelCell[] =
    zoneInspector.affectedCellKeys
      .map((cellId) => model?.cells.find((cell) => cell.id === cellId) ?? null)
      .filter((cell): cell is FieldCellInspectorCell => cell != null)
      .map((cell) => ({
        id: cell.id,
        rootZonePct: cell.rootZonePct,
        surfacePct: cell.surfacePct,
        confidence: cell.confidence,
      }));

  const findings: readonly ZoneDetailPanelFinding[] =
    model?.findings
      .filter((finding) => finding.trackedZoneIds.includes(zoneId))
      .map((finding) => ({
        id: finding.id,
        title: finding.title,
        summary: finding.summary,
        severity: finding.severity,
        startedAt: finding.startedAt,
      })) ?? [];

  return {
    zone: {
      id: zone.id,
      family: zone.family,
      trackingKey: zone.trackingKey,
      status: zone.status,
      severity: zone.severity,
      affectedCellCount: zone.affectedCellCount,
      detectionCount: zone.detectionCount,
      lastSeenAt: zone.lastSeenAt,
    },
    cells,
    findings,
  };
}

export function FieldPageShell({
  workspaceId = null,
  fields,
  activeFieldId,
  activeFieldName,
  summary,
  report,
  action,
  notes,
  market,
  crop,
  alerts,
  mapModel,
  cellInspector,
  activity,
}: FieldPageShellProps) {
  const router = useRouter();
  const [panelView, setPanelView] = useState<PanelView>("detail");
  const [panelBeforeHide, setPanelBeforeHide] = useState<PanelView>("detail");
  const [selectedCell, setSelectedCell] = useState<CellClickEvent | null>(null);
  const [hoveredCell, setHoveredCell] = useState<CellHoverEvent | null>(null);
  const [focusedZoneId, setFocusedZoneId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [pendingOnboardingWatch, setPendingOnboardingWatch] =
    useState<PendingOnboardingWatch | null>(null);
  const [onboardingStatuses, setOnboardingStatuses] =
    useState<Map<string, JobDispatchSnapshot>>(new Map());
  const [prebuiltStagesByField, setPrebuiltStagesByField] = useState<
    ReadonlyMap<string, CommitFieldHydrationSummary["stages"]>
  >(new Map());
  const [zoneDetailReturnView, setZoneDetailReturnView] = useState<"detail" | "activity">(
    "detail",
  );
  const [activeDetailMode, setActiveDetailMode] = useState<ModeKey>("moisture");
  const availableDetailModes = useMemo(
    () => resolveAvailableDetailModes(mapModel),
    [mapModel],
  );
  const fieldOnboardingProgress = useMemo(() => {
    if (!pendingOnboardingWatch || onboardingStatuses.size === 0) {
      return new Map<
        string,
        {
          status: "queued" | "running" | "completed" | "failed" | "cancelled";
          progressPct: number | null;
          phaseLabel: string | null;
        }
      >();
    }

    const byField = new Map<
      string,
      {
        status: "queued" | "running" | "completed" | "failed" | "cancelled";
        progressPct: number | null;
        phaseLabel: string | null;
      }
    >();
    const statusOrder: Record<string, number> = {
      running: 0,
      queued: 1,
      failed: 2,
      cancelled: 3,
      completed: 4,
    };
    const dispatchEntries =
      pendingOnboardingWatch.dispatchFieldEntries?.length
        ? pendingOnboardingWatch.dispatchFieldEntries
        : pendingOnboardingWatch.dispatchIds.flatMap((dispatchId) => {
            const snap = onboardingStatuses.get(dispatchId);
            return snap?.fieldId
              ? [{ dispatchId, fieldId: snap.fieldId, fieldLabel: snap.fieldId }]
              : [];
          });

    for (const { dispatchId, fieldId } of dispatchEntries) {
      const snap = onboardingStatuses.get(dispatchId);
      const status = snap?.status ?? "queued";
      const existing = byField.get(fieldId);

      if (!existing) {
        byField.set(fieldId, {
          status,
          progressPct: snap?.progressPct ?? null,
          phaseLabel: snap?.activePhaseLabel ?? snap?.progressMessage ?? null,
        });
        continue;
      }

      if ((statusOrder[status] ?? 4) < (statusOrder[existing.status] ?? 4)) {
        existing.status = status;
        existing.phaseLabel =
          snap?.activePhaseLabel ?? snap?.progressMessage ?? existing.phaseLabel;
      }

      if (snap?.progressPct != null) {
        existing.progressPct =
          existing.progressPct != null
            ? Math.round((existing.progressPct + snap.progressPct) / 2)
            : snap.progressPct;
      }
    }

    return byField;
  }, [pendingOnboardingWatch, onboardingStatuses]);


  useEffect(() => {
    setPanelView("detail");
    setSelectedCell(null);
    setHoveredCell(null);
    setFocusedZoneId(null);
    setSelectedZoneId(null);
    setZoneDetailReturnView("detail");
  }, [activeFieldId]);

  useEffect(() => {
    if (availableDetailModes.length === 0) {
      return;
    }

    if (!availableDetailModes.includes(activeDetailMode)) {
      setActiveDetailMode(availableDetailModes[0]!);
    }
  }, [activeDetailMode, availableDetailModes]);

  useEffect(() => {
    if (pendingOnboardingWatch || typeof window === "undefined") {
      return;
    }

    const storedWatch = parsePendingOnboardingWatch(
      window.sessionStorage.getItem(PENDING_ONBOARDING_STORAGE_KEY),
    );

    if (shouldResumeFieldPageOnboardingWatch(storedWatch, workspaceId)) {
      setPendingOnboardingWatch(storedWatch);
    }
  }, [pendingOnboardingWatch, workspaceId]);

  useEffect(() => {
    if (!shouldResumeFieldPageOnboardingWatch(pendingOnboardingWatch, workspaceId)) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const dispatchFieldMap = new Map(
          (pendingOnboardingWatch?.dispatchFieldEntries ?? []).map((entry) => [
            entry.dispatchId,
            { fieldId: entry.fieldId, fieldLabel: entry.fieldLabel },
          ]),
        );
        const response = await fetch("/api/jobs/dispatches", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            workspaceId: pendingOnboardingWatch?.workspaceId ?? workspaceId,
            ids: pendingOnboardingWatch?.dispatchIds ?? [],
          }),
        });
        const payload = (await response.json()) as {
          result?: { dispatches?: OnboardingDispatchSnapshot[] };
          error?: { message?: string };
        };

        if (!response.ok) {
          throw new Error(payload.error?.message ?? "Onboarding dispatch lookup failed.");
        }

        const dispatchById = new Map(
          (payload.result?.dispatches ?? []).map((dispatch) => [
            dispatch.id,
            {
              id: dispatch.id,
              key: dispatch.id,
              status: dispatch.status,
              activePhaseLabel: dispatch.activePhaseLabel ?? null,
              progressPct: dispatch.progressPct ?? null,
              progressMessage: dispatch.progressMessage ?? null,
              updatedAt: null,
              completedAt: dispatch.status === "completed" ? new Date().toISOString() : null,
              failedAt: dispatch.status === "failed" ? new Date().toISOString() : null,
              cancelledAt: dispatch.status === "cancelled" ? new Date().toISOString() : null,
              lastError: null,
              fieldId: dispatch.fieldId ?? dispatchFieldMap.get(dispatch.id)?.fieldId ?? null,
            } satisfies JobDispatchSnapshot,
          ] as const),
        );
        const shouldContinue = pendingOnboardingWatch!.dispatchIds.some((dispatchId) => {
          const status = dispatchById.get(dispatchId)?.status ?? "queued";
          return status === "queued" || status === "running";
        });

        if (cancelled) {
          return;
        }

        setOnboardingStatuses(dispatchById);

        if (shouldContinue) {
          timeoutId = setTimeout(() => {
            void poll();
          }, ONBOARDING_STATUS_POLL_MS);
          return;
        }

        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(PENDING_ONBOARDING_STORAGE_KEY);
        }
        setPendingOnboardingWatch(null);
        router.refresh();
      } catch {
        if (!cancelled) {
          timeoutId = setTimeout(() => {
            void poll();
          }, ONBOARDING_STATUS_POLL_MS);
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [pendingOnboardingWatch, router, workspaceId]);

  function handleNavChange(nav: string) {
    if (nav === "Crops") {
      setPanelView("crops");
      return;
    }
    if (nav === "Action") {
      setPanelView("action");
      return;
    }
    if (nav === "Notes") {
      setPanelView("notes");
      return;
    }
    if (nav === "Zones" && activity) {
      setPanelView("activity");
      return;
    }
    if (nav === "Settings") {
      setPanelView("settings");
      return;
    }
    setPanelView("detail");
  }

  function handleAlertsBell() {
    if (panelView === "alerts") {
      setPanelView("detail");
    } else if (alerts) {
      setPanelView("alerts");
    }
  }

  function handleAddField() {
    if (panelView === "addField") {
      setPanelView("detail");
    } else {
      setPanelView("addField");
    }
  }

  const handleFieldsChanged = useCallback((result: {
    preferredFieldId?: string | null;
    fieldIds: string[];
    fieldEntries?: readonly FirstInsightFieldEntry[];
    fieldHydrationSummaries?: readonly CommitFieldHydrationSummary[];
  }) => {
    const preferredFieldId = chooseFirstInsightField({
      workspaceId,
      preferredFieldId: result.preferredFieldId ?? null,
      fieldEntries:
        result.fieldEntries ??
        result.fieldIds.map((fieldId) => ({ fieldId })),
      hydrationSummaries: result.fieldHydrationSummaries,
    });

    if (
      preferredFieldId &&
      result.fieldIds.length === 1 &&
      preferredFieldId !== activeFieldId
    ) {
      setPanelView("detail");
      router.push(`/fields/${preferredFieldId}`);
      return;
    }

    if (preferredFieldId && result.fieldIds.length === 1) {
      setPanelView("detail");
    }

    router.refresh();
  }, [activeFieldId, router, workspaceId]);

  const handleOnboardingTracked = useCallback((watch: PendingOnboardingWatch & {
    fieldEntries?: readonly FirstInsightFieldEntry[];
    trackedJobs?: readonly { dispatchId: string; fieldId: string; fieldLabel: string }[];
    fieldHydrationSummaries?: readonly CommitFieldHydrationSummary[];
  }) => {
    if (watch.dispatchIds.length === 0) {
      setPendingOnboardingWatch(null);
      setOnboardingStatuses(new Map());
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(PENDING_ONBOARDING_STORAGE_KEY);
      }
      return;
    }

    const hydrationSummaries = watch.fieldHydrationSummaries;
    const dispatchFieldEntries =
      watch.trackedJobs?.map((job) => ({
        dispatchId: job.dispatchId,
        fieldId: job.fieldId,
        fieldLabel: job.fieldLabel,
      })) ?? [];
    const preferredFieldId = chooseFirstInsightField({
      workspaceId,
      preferredFieldId: watch.preferredFieldId ?? null,
      fieldEntries:
        watch.fieldEntries ??
        dispatchFieldEntries.map((entry) => ({
          fieldId: entry.fieldId,
          fieldName: entry.fieldLabel,
        })),
      hydrationSummaries,
    });

    if (hydrationSummaries && hydrationSummaries.length > 0) {
      setOnboardingStatuses((prev) => {
        const next = new Map(prev);

        for (const summary of hydrationSummaries) {
          if (summary.status !== "completed") {
            continue;
          }

          const dispatchId = (watch.trackedJobs ?? []).find(
            (job) => job.fieldId === summary.fieldId,
          )?.dispatchId;

          if (!dispatchId) {
            continue;
          }

          next.set(dispatchId, {
            id: dispatchId,
            key: `hydration-seed:${summary.fieldId}`,
            status: "completed",
            activePhaseLabel: summary.phaseLabel,
            progressPct: 100,
            progressMessage: summary.phaseLabel,
            updatedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            failedAt: null,
            cancelledAt: null,
            lastError: null,
            fieldId: summary.fieldId,
          });
        }

        return next;
      });

      setPrebuiltStagesByField((prev) => {
        const next = new Map(prev);

        for (const summary of hydrationSummaries) {
          if (summary.stages && summary.stages.length > 0) {
            next.set(summary.fieldId, summary.stages);
          }
        }

        return next;
      });
    }

    const nextWatch: PendingOnboardingWatch = {
      ...watch,
      preferredFieldId,
      dispatchFieldEntries,
    };

    setPendingOnboardingWatch(nextWatch);

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        PENDING_ONBOARDING_STORAGE_KEY,
        JSON.stringify(nextWatch),
      );
    }
  }, [workspaceId]);

  function handlePanelClose() {
    if (panelView !== "none") {
      setPanelBeforeHide(panelView);
    }
    setPanelView("none");
  }

  function handlePanelReopen() {
    setPanelView(panelBeforeHide === "none" ? "detail" : panelBeforeHide);
  }

  function handleCellHover(event: CellHoverEvent | null) {
    setHoveredCell((previous) => {
      if (previous === event) {
        return previous;
      }

      if (previous == null || event == null) {
        return event;
      }

      const unchangedCell =
        previous.cellId === event.cellId &&
        previous.metricKey === event.metricKey &&
        previous.metricValuePct === event.metricValuePct &&
        previous.displayHeightM === event.displayHeightM &&
        previous.sourceTier === event.sourceTier &&
        previous.deltaFromFieldAvgPct === event.deltaFromFieldAvgPct &&
        previous.percentileInField === event.percentileInField &&
        previous.anomalyClass === event.anomalyClass &&
        previous.varianceBucket === event.varianceBucket &&
        previous.severityLabel === event.severityLabel &&
        previous.zoneId === event.zoneId;

      return unchangedCell ? previous : event;
    });
  }

  function handleCellClick(event: CellClickEvent) {
    if (event.selected) {
      setSelectedCell(event);
      setFocusedZoneId(event.zoneId);
      setPanelView("cell");
      return;
    }

    setSelectedCell(null);
    setFocusedZoneId(null);
    setPanelView("detail");
  }

  const effectiveFocusedZoneId = focusedZoneId ?? hoveredCell?.zoneId ?? null;
  const interactiveSummary = buildInteractiveSummary(summary, hoveredCell, cellInspector);
  const interactiveReport = buildInteractiveReport(report, hoveredCell, cellInspector);
  const interactiveAction = buildInteractiveAction(action, hoveredCell, cellInspector);
  const interactiveNotes = buildInteractiveNotes(notes, hoveredCell, cellInspector);
  const interactiveMarket = buildInteractiveMarket(market, hoveredCell, cellInspector);
  const interactiveCrop = buildInteractiveCrop(crop, hoveredCell, cellInspector);
  const interactiveAlerts = buildInteractiveAlerts(alerts, hoveredCell, cellInspector);
  const interactiveActivityState = buildInteractiveActivity(
    activity,
    hoveredCell,
    cellInspector,
  );
  const interactiveActivity = interactiveActivityState.activity;
  const interactiveMapModel = useMemo(
    () => ({
      ...mapModel,
      focusedZoneId: effectiveFocusedZoneId,
    }),
    [effectiveFocusedZoneId, mapModel],
  );
  const hoveredZonePreview = buildZoneDetailSelection(
    selectedZoneId ? null : hoveredCell?.zoneId ?? null,
    activity,
    cellInspector,
  );
  const pinnedZoneDetail = buildZoneDetailSelection(selectedZoneId, activity, cellInspector);
  const hoveredZoneContextLabel = hoveredZonePreview
    ? `Hovered zone · ${hoveredZonePreview.zone.family.replace(/_/g, " ")} · ${hoveredZonePreview.zone.trackingKey}`
    : undefined;

  const canonicalDetailInitialPage =
    resolveFieldPageCanonicalDetailInitialPage(panelView);

  const panel =
    canonicalDetailInitialPage ? (
      <FieldDetailPanel
        fieldId={activeFieldId}
        fieldName={activeFieldName}
        fieldMeta={resolveDetailFieldMeta(
          interactiveSummary,
          interactiveCrop,
          fields.find((field) => field.id === activeFieldId)?.area,
        )}
        areaLabel={fields.find((field) => field.id === activeFieldId)?.area}
        mapModel={mapModel}
        hoveredCell={hoveredCell}
        activeMode={activeDetailMode}
        availableModes={availableDetailModes}
        onModeChange={setActiveDetailMode}
        summary={interactiveSummary}
        report={interactiveReport}
        market={interactiveMarket}
        crop={interactiveCrop}
        action={interactiveAction}
        notes={interactiveNotes}
        activity={interactiveActivity}
        initialPage={canonicalDetailInitialPage}
        onInitialPageClose={() => setPanelView("detail")}
        onboardingStatus={fieldOnboardingProgress.get(activeFieldId) ?? null}
        prebuiltStages={prebuiltStagesByField.get(activeFieldId) ?? null}
      />
    ) :
    panelView === "alerts" && alerts ? (
      <AlertsPanel
        {...interactiveAlerts!}
        focusedZoneId={effectiveFocusedZoneId}
        onAlertSelect={setFocusedZoneId}
        onClose={() => setPanelView("detail")}
      />
    ) : panelView === "activity" ? (
      <FieldActivityPanel
        activity={interactiveActivity}
        contextLabel={interactiveActivityState.contextLabel}
        scopeLabel={interactiveActivityState.scopeLabel}
        focusedZoneId={effectiveFocusedZoneId}
        onZoneSelect={setFocusedZoneId}
        onZoneDrillDown={(zoneId) => {
          setSelectedZoneId(zoneId);
          setFocusedZoneId(zoneId);
          setZoneDetailReturnView("activity");
          setPanelView("zoneDetail");
        }}
        onClose={() => setPanelView("detail")}
      />
    ) : panelView === "zoneDetail" && pinnedZoneDetail ? (
      <ZoneDetailPanel
        zone={pinnedZoneDetail?.zone}
        cells={pinnedZoneDetail?.cells}
        findings={pinnedZoneDetail?.findings}
        onClose={() => {
          setSelectedZoneId(null);
          setPanelView(zoneDetailReturnView);
        }}
      />
    ) : panelView === "zoneDetail" ? (
      <FieldActivityPanel
        activity={interactiveActivity}
        contextLabel={interactiveActivityState.contextLabel}
        scopeLabel={interactiveActivityState.scopeLabel}
        focusedZoneId={effectiveFocusedZoneId}
        onZoneSelect={setFocusedZoneId}
        onZoneDrillDown={(zoneId) => {
          setSelectedZoneId(zoneId);
          setFocusedZoneId(zoneId);
          setZoneDetailReturnView("activity");
          setPanelView("zoneDetail");
        }}
        onClose={() => setPanelView(zoneDetailReturnView)}
      />
    ) : panelView === "cell" ? (
      <SelectedCellInspector
        selection={selectedCell}
        model={cellInspector}
        focusedZoneId={effectiveFocusedZoneId}
        onZoneSelect={setFocusedZoneId}
        onClose={() => {
          setSelectedCell(null);
          setFocusedZoneId(null);
          setPanelView("detail");
        }}
      />
    ) : panelView === "settings" ? (
      <SettingsPanel
        workspaceId={workspaceId}
        onClose={() => setPanelView("detail")}
      />
    ) : panelView === "addField" ? (
      <AddFieldPanel
        onFieldsChanged={handleFieldsChanged}
        onOnboardingTracked={handleOnboardingTracked}
        jobStatuses={onboardingStatuses}
        workspaceId={workspaceId}
        onClose={() => setPanelView("detail")}
      />
    ) : panelView === "none" ? (
      null
    ) : (
      <FieldDetailPanel
        fieldId={activeFieldId}
        fieldName={activeFieldName}
        fieldMeta={resolveDetailFieldMeta(
          interactiveSummary,
          interactiveCrop,
          fields.find((field) => field.id === activeFieldId)?.area,
        )}
        areaLabel={fields.find((field) => field.id === activeFieldId)?.area}
        mapModel={mapModel}
        hoveredCell={hoveredCell}
        activeMode={activeDetailMode}
        availableModes={availableDetailModes}
        onModeChange={setActiveDetailMode}
        summary={interactiveSummary}
        report={interactiveReport}
        market={interactiveMarket}
        crop={interactiveCrop}
        action={interactiveAction}
        notes={interactiveNotes}
        activity={interactiveActivity}
        onClose={handlePanelClose}
        onboardingStatus={fieldOnboardingProgress.get(activeFieldId) ?? null}
        prebuiltStages={prebuiltStagesByField.get(activeFieldId) ?? null}
      />
    );

  /* Floating reopen pill when panel is hidden */
  const panelReopenPill = panelView === "none" ? (
    <button
      type="button"
      className="panel-reopen-pill"
      onClick={handlePanelReopen}
      aria-label="Open panel"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      <span className="panel-reopen-pill__label">Panel</span>
    </button>
  ) : null;

  const finalPanel = panel || panelReopenPill ? (
    <>
      {panel}
      {panelReopenPill}
      <HydrationOverlay
        active={
          panelView === 'detail' &&
          fieldOnboardingProgress.has(activeFieldId) &&
          (fieldOnboardingProgress.get(activeFieldId)?.status === 'queued' ||
            fieldOnboardingProgress.get(activeFieldId)?.status === 'running')
        }
        fieldName={activeFieldName}
        onboardingStatus={fieldOnboardingProgress.get(activeFieldId) ?? null}
        progressMessage={fieldOnboardingProgress.get(activeFieldId)?.phaseLabel ?? null}
        prebuiltStages={prebuiltStagesByField.get(activeFieldId) ?? null}
      />
    </>
  ) : null;

  return (
    <WorkspaceShell
      fields={fields}
      activeFieldId={activeFieldId}
      activeNav={
        panelView === "activity"
          ? "Zones"
          : panelView === "action"
            ? "Action"
            : panelView === "notes"
              ? "Notes"
              : undefined
      }
      onNavChange={handleNavChange}
      onAlertsBell={handleAlertsBell}
      onAddField={handleAddField}
      panel={finalPanel}
      panelHidden={panelView === "none"}
    >
      <div className="map-area__canvas">
        <LazyFieldBoundaryMap
          model={interactiveMapModel}
          activeMetric={MODE_TO_METRIC_KEY[activeDetailMode]}
          onCellHover={handleCellHover}
          onCellClick={handleCellClick}
        />
      </div>
    </WorkspaceShell>
  );
}
