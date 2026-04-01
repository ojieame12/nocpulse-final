"use client";

import {
  describeCellAttentionLevel,
  resolveCellAttentionLevel,
  resolveMetricModeContract,
  type CellHoverEvent,
  type FieldBoundaryPreviewRenderModel,
} from "@fieldpulse/map";
import { buildFieldDetailModeData } from "./fieldDetailModeDataBuilder";
import { Spark, HeroDonut, ProgBar } from "./fieldDetailVisualizations";
import { Card, AlertCard, Lbl, LblM, Big, Sub, Mono } from "./fieldDetailCardPrimitives";
import { NotesSubPage } from "./fieldDetailNotesSubPage";
import { ZonesSubPage } from "./fieldDetailZonesSubPage";
import { ReportSubPage } from "./fieldDetailReportSubPage";
import { CropsSubPage } from "./fieldDetailCropsSubPage";
import { MarketSubPage } from "./fieldDetailMarketSubPage";
import { ActionsSubPage } from "./fieldDetailActionsSubPage";
import {
  Droplets,
  Leaf,
  FlaskConical,
  CloudRain,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Satellite,
  Clock,
  Radio,
  Eye,
  Target,
  Zap,
  FileText,
  MapPin,
  Sprout,
  DollarSign,
  StickyNote,
  ChevronLeft,
  ShieldCheck,
  Download,
  X,
  type LucideIcon,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAppTheme } from "../layout/WorkspaceShell";
import type { FieldSummaryProps } from "./SummaryTab";
import type { FieldReportProps } from "./ReportTab";
import type { FieldMarketProps } from "./MarketTab";
import type { FieldCropProps } from "../../features/fields/tabs/CropTab";
import type { FieldActionProps } from "./ActionTab";
import {
  type FieldNotesInspectionTarget,
  type FieldNotesProps,
} from "./NotesTab";
import type { FieldActivityPanelModel } from "../../features/fields/FieldActivityPanelModel";
export type { ModeKey } from "./fieldDetailTypes";
export { MODE_TO_METRIC_KEY } from "./fieldDetailTypes";
import type { ModeKey, SeverityKey, DetailPanelModeVital, DetailPanelModeData } from "./fieldDetailTypes";
import { MODE_TO_METRIC_KEY } from "./fieldDetailTypes";

/* ═══════════════════════════════════════════════════════════════════
   FIELD DETAIL PANEL — Card Grid Design
   Light-gray panel bg · white cards · label top / value bottom
   ═══════════════════════════════════════════════════════════════════ */

/* Color system imported from ./fieldDetailColorSystem */
import {
  resolveRampAccent,
  resolveRampSolid,
  SEV_COLORS_LIGHT,
  SEV_COLORS_DARK,
  resolveSeverityAccent,
  resolveHeroRingColor,
  sevCardGradient,
  resolveVitalSeverity,
  vitalValueColor,
} from "./fieldDetailColorSystem";
import { MetricHintProvider } from "../ui/MetricHintProvider";
import { HydrationStageTracker } from "../ui/HydrationStageTracker";

/** Resolve footer badge data: count + color for each sub-page section */
function resolveFooterBadge(
  pageKey: string,
  ctx: {
    report: FieldReportProps | null;
    action: FieldActionProps | null;
    summary: FieldSummaryProps | null;
    crop: FieldCropProps | null;
  },
): { count: number; color: string } | null {
  switch (pageKey) {
    case "report": {
      const findings = ctx.report?.findings.length ?? 0;
      if (findings > 0) return { count: findings, color: "#ef4444" };
      return null;
    }
    case "zones": {
      const critical = ctx.report?.zones.filter((z) => z.status === "critical").length ?? 0;
      const stressed = ctx.report?.zones.filter((z) => z.status === "stressed").length ?? 0;
      if (critical > 0) return { count: critical, color: "#ef4444" };
      if (stressed > 0) return { count: stressed, color: "#f59e0b" };
      return null;
    }
    case "crops": {
      // Show badge for disease risks above 10%
      const risks = ctx.crop?.diseaseRisks.filter((d) => {
        const n = parseFloat(d.pct);
        return !isNaN(n) && n >= 10;
      }).length ?? 0;
      if (risks > 0) return { count: risks, color: "#f59e0b" };
      return null;
    }
    case "actions": {
      // Show badge if there's an action recommendation with urgent status
      if (ctx.action?.intelligenceState === "none") return null;
      if (ctx.action?.urgency === "Urgent") return { count: 1, color: "#ef4444" };
      if (ctx.action?.recommendation) return { count: 1, color: "#f59e0b" };
      return null;
    }
    default:
      return null;
  }
}

const MODES: { k: ModeKey; l: string; icon: LucideIcon }[] = [
  { k: "moisture", l: "Moisture", icon: Droplets },
  { k: "ndvi", l: "NDVI", icon: Leaf },
  { k: "ndre", l: "NDRE", icon: FlaskConical },
  { k: "ndmi", l: "NDMI", icon: CloudRain },
  { k: "radarWetness", l: "Radar Wetness", icon: CloudRain },
];

function resolveModeLabel(
  mode: ModeKey,
  mapModel?: FieldBoundaryPreviewRenderModel | null,
): string {
  if (mode === "moisture") {
    return "Moisture";
  }

  const surface = resolveSurfaceForMode(mapModel, mode);
  return resolveMetricModeContract(MODE_TO_METRIC_KEY[mode], surface?.sourceLabel).label;
}

function resolveModeShortLabel(
  mode: ModeKey,
  mapModel?: FieldBoundaryPreviewRenderModel | null,
): string {
  if (mode === "moisture") {
    return "Moisture";
  }

  const surface = resolveSurfaceForMode(mapModel, mode);
  return resolveMetricModeContract(
    MODE_TO_METRIC_KEY[mode],
    surface?.sourceLabel,
  ).shortLabel;
}

/* ── Sub-pages ── */

const SUB_PAGES: { k: string; l: string; icon: LucideIcon; desc: string; stat: string }[] = [
  { k: "report", l: "Report", icon: FileText, desc: "Full field analysis", stat: "4 charts" },
  { k: "zones", l: "Zones", icon: MapPin, desc: "Zone health & inspection", stat: "3 active" },
  { k: "crops", l: "Crops", icon: Sprout, desc: "Growth stage & thresholds", stat: "Flowering" },
  { k: "market", l: "Market", icon: TrendingUp, desc: "Price, yield & contracts", stat: "$682/t" },
  {
    k: "actions",
    l: "Actions",
    icon: ShieldCheck,
    desc: "Recommendations & tasks",
    stat: "2 pending",
  },
  { k: "notes", l: "Notes", icon: StickyNote, desc: "Scout notes & history", stat: "6 entries" },
];

/* ═══════════════════════════════════════════════════════════════════
   Sub-page Views
   ═══════════════════════════════════════════════════════════════════ */

function SubPageView({
  fieldId,
  workspaceId,
  mapModel,
  page,
  mode,
  onBack,
  onOpenPage,
  ac,
  isDark,
  liveModeData,
  hoveredCell,
  summary,
  report,
  market,
  crop,
  action,
  notes,
  activity,
  selectedZoneId,
  onSelectZoneId,
  selectedNotesTarget,
  onSelectNotesTarget,
  onMarketScenarioSaved,
}: {
  fieldId: string;
  workspaceId?: string;
  mapModel?: FieldBoundaryPreviewRenderModel | null;
  page: string;
  mode: ModeKey;
  onBack: () => void;
  onOpenPage: (
    pageKey: string,
    options?: {
      zoneId?: string | null;
      notesTarget?: FieldNotesInspectionTarget | null;
    },
  ) => void;
  ac: string;
  isDark: boolean;
  liveModeData: DetailPanelModeData;
  hoveredCell?: CellHoverEvent | null;
  summary: FieldSummaryProps | null;
  report: FieldReportProps | null;
  market: FieldMarketProps | null;
  crop: FieldCropProps | null;
  action: FieldActionProps | null;
  notes: FieldNotesProps | null;
  activity: FieldActivityPanelModel | null;
  selectedZoneId: string | null;
  onSelectZoneId: (zoneId: string | null) => void;
  selectedNotesTarget: FieldNotesInspectionTarget | null;
  onSelectNotesTarget: (target: FieldNotesInspectionTarget | null) => void;
  onMarketScenarioSaved?: (() => void | Promise<void>) | null;
}) {
  const mc = liveModeData;
  const pg = SUB_PAGES.find((p) => p.k === page)!;
  const [openQ, setOpenQ] = useState(1);
  /* Notes form state moved to NotesSubPage */

  const statusColor = (s: string) =>
    s === "critical" ? "#ef4444" : s === "stressed" ? "#f59e0b" : "#16a34a";
  const statusBg = (s: string) =>
    s === "critical" ? "rgba(239,68,68,0.12)" : s === "stressed" ? "rgba(245,158,11,0.12)" : "rgba(22,163,74,0.12)";
  const reportReadings = report?.readings ?? [];
  const reportForecast = report?.forecast ?? [];
  const reportAlerts = report?.alerts ?? [];
  const reportFindings = report?.findings ?? [];
  const reportZones = report?.zones ?? [];
  const vegetationChart = findReportChart(report, 0);
  const moistureHistoryChart = findReportChart(report, 1);
  const temperatureChart = findReportChart(report, 2);
  const vegetationRange = resolveReportChartRangeLabels(vegetationChart);
  const moistureHistoryRange = resolveReportChartRangeLabels(moistureHistoryChart);
  const temperatureRange = resolveReportChartRangeLabels(temperatureChart);
  const cropThresholds = crop?.thresholds ?? [];
  const cropFieldTiles = crop?.fieldTiles ?? [];
  const cropDiseaseRisks = crop?.diseaseRisks ?? [];
  const marketContextTiles = market?.contextTiles ?? [];
  const cropSignalSub =
    crop?.healthIndex.subLabel ??
    crop?.healthIndexTitle ??
    "No canopy index available";
  const moistureBalanceSub =
    crop?.moistureBalance.subLabel ??
    crop?.moistureBalanceTitle ??
    "No moisture balance context";
  const marketHistoryEmptyText =
    market?.availabilityReasonLabel ??
    market?.quoteStatusLabel ??
    market?.footerText ??
    (market?.cropSymbol
      ? "Only one stored quote has been captured so far."
      : "No supported quote symbol is available for this crop yet.");
  const effectiveInspectionTarget =
    selectedNotesTarget ?? notes?.inspectionTarget ?? null;
  /* noteEntries computation moved to NotesSubPage */
  const trackedZoneCount = reportZones.length;
  const healthyZoneCount = reportZones.filter((zone) => zone.status === "healthy").length;
  const stressedZoneCount = reportZones.filter((zone) => zone.status === "stressed").length;
  const criticalZoneCount = reportZones.filter((zone) => zone.status === "critical").length;
  const affectedCellTotal = reportZones.reduce((sum, zone) => sum + zone.affectedCellCount, 0);
  const effectiveZoneId =
    selectedZoneId ?? hoveredCell?.zoneId ?? reportZones[0]?.id ?? null;
  const focusedZone = effectiveZoneId
    ? reportZones.find((zone) => zone.id === effectiveZoneId) ?? null
    : null;
  const focusedActivityZone = effectiveZoneId
    ? activity?.zones.find((zone) => zone.id === effectiveZoneId) ?? null
    : null;
  const focusedFamilySummary =
    focusedZone != null
      ? activity?.familySummaries.find((summary) => summary.family === focusedZone.family) ?? null
      : null;
  const focusedZoneFindings =
    effectiveZoneId != null
      ? reportFindings.filter((finding) => finding.trackedZoneIds.includes(effectiveZoneId))
      : [];
  const focusedZoneAlerts =
    effectiveZoneId != null
      ? reportAlerts.filter((alert) => alert.trackedZoneIds.includes(effectiveZoneId))
      : [];
  const exportUrl =
    page === "report"
      ? buildFieldExportUrl({ fieldId, workspaceId, kind: "report" })
      : page === "crops"
        ? buildFieldExportUrl({ fieldId, workspaceId, kind: "crop" })
        : null;
  const contextOnlyOptical = Boolean(
    mc.contextOnly && (mode === "ndvi" || mode === "ndre" || mode === "ndmi"),
  );
  const radarWetnessModeLabel = resolveModeLabel("radarWetness", mapModel);
  const contextTone = isDark ? "rgba(203,213,225,0.82)" : "#64748b";
  const contextToneSoft = isDark ? "rgba(148,163,184,0.14)" : "rgba(100,116,139,0.10)";
  const hoveredAttentionLevel = hoveredCell
    ? resolveCellAttentionLevel({
        metricKey: hoveredCell.metricKey,
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
  const trackedPocketPct =
    mc.belowThresholdLabel === "Tracked pockets"
      ? parseNumericValue(mc.belowThresholdValue)
      : null;
  const outsideZonePct =
    mc.inZonesLabel === "Outside zones"
      ? parseNumericValue(mc.inZonesValue)
      : null;
  const focusedZoneSignalColor: "green" | "yellow" | "red" =
    focusedZone?.status === "critical"
      ? "red"
      : focusedZone?.status === "stressed"
        ? "yellow"
        : "green";
  const handleOpenFocusedZone = useCallback(() => {
    if (!focusedZone) {
      return;
    }

    onSelectZoneId(focusedZone.id);
    onOpenPage("zones", { zoneId: focusedZone.id });
  }, [focusedZone, onOpenPage, onSelectZoneId]);
  const zonePrioritySignals = [
    trackedPocketPct != null
      ? {
          label: `Tracked ${Math.round(trackedPocketPct)}%`,
          color:
            mc.riskLevel === "Zone Critical" || trackedPocketPct >= 12
              ? ("red" as const)
              : trackedPocketPct > 0
                ? ("yellow" as const)
                : ("green" as const),
          detail: focusedZone
            ? `${focusedZone.trackingKey} is the current priority zone on the active surface.`
            : `${Math.round(trackedPocketPct)}% of mapped cells are localized watch pockets inside tracked zones.`,
        }
      : null,
    outsideZonePct != null
      ? {
          label: `Outside ${Math.round(outsideZonePct)}%`,
          color:
            trackedPocketPct != null && outsideZonePct > trackedPocketPct
              ? ("red" as const)
              : outsideZonePct > 0
                ? ("yellow" as const)
                : ("green" as const),
          detail:
            outsideZonePct > 0
              ? `${Math.round(outsideZonePct)}% of mapped cells are localized watch pockets outside tracked zones.`
              : "No localized watch pockets currently sit outside tracked zones.",
        }
      : null,
    focusedZone
      ? {
          label: `Zone ${focusedZone.trackingKey}`,
          color: focusedZoneSignalColor,
          detail: [
            `${focusedZone.affectedCellCount} affected cells`,
            `${focusedZoneFindings.length} findings`,
            `${focusedZoneAlerts.length} alerts`,
          ].join(" · "),
        }
      : null,
  ].filter(
    (
      value,
    ): value is {
      label: string;
      color: "green" | "yellow" | "red";
      detail: string;
    } => value != null,
  );
  const actionEvidenceSignals = [...zonePrioritySignals, ...(action?.signals ?? [])].filter(
    (signal, index, entries) =>
      entries.findIndex((candidate) => candidate.label === signal.label) === index,
  );
  const actionRecommendationText =
    contextOnlyOptical
      ? action?.recommendation ?? "No active recommendation is available."
      : focusedZone && trackedPocketPct != null && trackedPocketPct > 0
        ? `Start with tracked zone ${focusedZone.trackingKey} and verify the strongest localized signal before treating the whole field.`
        : trackedPocketPct != null && trackedPocketPct > 0
          ? "Start with tracked-zone pockets first before treating the whole field uniformly."
          : outsideZonePct != null && outsideZonePct > 0
            ? "Review the strongest untracked pockets and decide whether the current zone coverage needs to expand."
            : action?.recommendation ?? "No active recommendation is available.";
  const actionUrgencyLabel =
    contextOnlyOptical
      ? "Context"
      : focusedZone?.status === "critical"
        ? "Urgent"
        : trackedPocketPct != null && trackedPocketPct > 0
          ? "Zone Watch"
          : outsideZonePct != null && outsideZonePct > 0
            ? "Emerging"
            : action?.urgency ?? "—";
  const actionContextText = [
    contextOnlyOptical
      ? `${action?.explanation ?? mc.interpretation} Optical canopy layers are informational only until crop stage is verified.`
      : action?.explanation ?? mc.interpretation,
    focusedZone
      ? `Focused zone ${focusedZone.trackingKey} is ${focusedZone.status} with ${focusedZone.affectedCellCount} affected cells.`
      : null,
    trackedPocketPct != null && trackedPocketPct > 0
      ? `${Math.round(trackedPocketPct)}% of mapped cells are localized watch pockets inside tracked zones.`
      : null,
    outsideZonePct != null && outsideZonePct > 0
      ? `${Math.round(outsideZonePct)}% of mapped cells are localized watch pockets outside tracked zones.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
  const reportStatusTitle =
    contextOnlyOptical
      ? "Optical context only"
      : trackedPocketPct != null && trackedPocketPct > 0
        ? focusedZone
          ? "Tracked-zone pockets lead"
          : "Tracked pockets detected"
        : outsideZonePct != null && outsideZonePct > 0
          ? "Untracked pockets need review"
          : hoveredAttentionLabel
            ? `${hoveredAttentionLabel} ${resolveModeLabel(mode, mapModel) ?? "signal"}`
            : report?.healthStatus ?? summary?.fieldState ?? "No current field status";
  const reportStatusSub =
    contextOnlyOptical
      ? "Preseason optical layers are informational only"
      : trackedPocketPct != null && trackedPocketPct > 0
        ? [
            `${Math.round(trackedPocketPct)}% of mapped cells are localized watch pockets inside tracked zones.`,
            focusedZone ? `Focus ${focusedZone.trackingKey}.` : null,
          ]
            .filter(Boolean)
            .join(" ")
        : outsideZonePct != null && outsideZonePct > 0
          ? `${Math.round(outsideZonePct)}% of mapped cells are localized watch pockets outside tracked zone coverage.`
          : "Overall field status";
  const cropTrackedContextText =
    trackedPocketPct != null && trackedPocketPct > 0
      ? [
          `${Math.round(trackedPocketPct)}% of mapped cells are localized watch pockets inside tracked zones.`,
          focusedZone ? `Priority zone ${focusedZone.trackingKey}.` : null,
        ]
          .filter(Boolean)
          .join(" ")
      : outsideZonePct != null && outsideZonePct > 0
        ? `${Math.round(outsideZonePct)}% of mapped cells are localized watch pockets outside tracked zone coverage.`
        : null;
  const cropSignalSummary =
    cropTrackedContextText != null
      ? `${cropSignalSub}. ${cropTrackedContextText}`
      : cropSignalSub;
  const cropMoistureSummary =
    cropTrackedContextText != null
      ? `${moistureBalanceSub}. ${cropTrackedContextText}`
      : moistureBalanceSub;
  const cropActiveSignalSub =
    cropTrackedContextText ??
    mc.headline;
  const broadFieldSignal =
    mc.riskLevel === "Broad Stress" ||
    (mc.inZonesLabel === "Absolute stress" &&
      (parseNumericValue(mc.inZonesValue) ?? 0) >= 30);
  const marketAgronomicContextText =
    trackedPocketPct != null && trackedPocketPct > 0 && outsideZonePct != null && outsideZonePct > 0
      ? `Current agronomic signal is localized: ${Math.round(trackedPocketPct)}% of mapped cells are inside tracked pockets and ${Math.round(outsideZonePct)}% sit outside current zone coverage.`
      : trackedPocketPct != null && trackedPocketPct > 0
        ? `Current agronomic signal is concentrated in tracked pockets across ${Math.round(trackedPocketPct)}% of mapped cells.`
        : outsideZonePct != null && outsideZonePct > 0
          ? `Current agronomic signal is concentrated outside tracked zones across ${Math.round(outsideZonePct)}% of mapped cells.`
          : broadFieldSignal
            ? "Current agronomic signal is field-wide rather than pocketed."
            : null;
  const marketScenarioQualifier =
    marketAgronomicContextText != null
      ? `${marketAgronomicContextText} This revenue view remains a whole-field scenario, not a pocket-specific valuation.`
      : broadFieldSignal
        ? "This revenue view reflects a whole-field scenario."
        : null;
  const focusedZoneJumpHint = focusedZone
    ? [
        focusedZone.trackingKey,
        `${focusedZone.affectedCellCount} affected cells`,
        `${focusedZoneFindings.length} findings`,
      ].join(" · ")
    : null;
  const contextualFinding = focusedZoneFindings[0] ?? reportFindings[0] ?? null;
  const contextualZone =
    focusedZone ??
    (contextualFinding
      ? reportZones.find((zone) => contextualFinding.trackedZoneIds.includes(zone.id)) ?? null
      : null);
  const contextualNotesTarget: FieldNotesInspectionTarget | null =
    notes == null
      ? null
      : {
          dateLabel:
            report?.updatedDate ??
            summary?.updatedLabel ??
            new Date().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
          name:
            contextualFinding?.title ??
            (contextualZone
              ? `${contextualZone.family.replace(/_/g, " ")} · ${contextualZone.trackingKey}`
              : hoveredCell
                ? `${resolveModeLabel(mode, mapModel)} · Cell ${hoveredCell.cellId.toUpperCase()}`
                : notes.inspectionTarget?.name ?? "Field context"),
          coordinateLabel: [
            contextualZone?.trackingKey ?? null,
            hoveredCell ? `Cell ${hoveredCell.cellId.toUpperCase()}` : null,
            hoveredAttentionLabel,
          ]
            .filter(Boolean)
            .join(" · ") || notes.inspectionTarget?.coordinateLabel || "Field context",
          findingId: contextualFinding?.id ?? null,
          zoneId: contextualZone?.id ?? null,
          cellKey: hoveredCell?.cellId ?? notes.inspectionTarget?.cellKey ?? null,
        };
  const handleOpenContextNotes = useCallback(() => {
    if (!contextualNotesTarget) {
      return;
    }

    onSelectNotesTarget(contextualNotesTarget);
    onSelectZoneId(contextualNotesTarget.zoneId ?? null);
    onOpenPage("notes", {
      zoneId: contextualNotesTarget.zoneId ?? null,
      notesTarget: contextualNotesTarget,
    });
  }, [contextualNotesTarget, onOpenPage, onSelectNotesTarget, onSelectZoneId]);

  /* Notes form reset effect moved to NotesSubPage */

  useEffect(() => {
    onSelectZoneId(null);
  }, [fieldId, onSelectZoneId, report?.updatedDate]);

  /* handleNoteSubmit moved to NotesSubPage */

  return (
    <MetricHintProvider>
    <div className="fdp__subpage">
      {/* Back + title row */}
      <div className="fdp__subpage-header">
        <button className="fdp__back-btn" onClick={onBack}>
          <ChevronLeft size={16} color={ac} strokeWidth={2.5} />
        </button>
        <div style={{ flex: 1 }}>
          <h2 className="fdp__subpage-title">{pg.l}</h2>
          <span className="fdp__subpage-desc">{pg.desc}</span>
        </div>
        {(page === "report" || page === "crops") && exportUrl && (
          <a
            className="fdp__export-btn"
            href={exportUrl}
            style={{
              background: isDark ? "rgba(255,255,255,0.12)" : ac,
              boxShadow: isDark ? "none" : `0 2px 8px -2px ${ac}60`,
              border: isDark ? "1px solid rgba(255,255,255,0.18)" : "none",
            }}
          >
            <Download size={12} color="white" strokeWidth={2.5} />
            {page === "report" ? "Export PDF" : "Crop Report"}
          </a>
        )}
      </div>

      {/* Grid */}
      <div
        className="fdp__subpage-grid fdp__subpage-grid--cols-2"
      >
        {/* ═══ REPORT ═══ */}
        {page === "report" && (
          <ReportSubPage
            ac={ac}
            report={report}
            summary={summary}
            crop={crop}
            mc={mc}
            contextOnlyOptical={contextOnlyOptical}
            contextTone={contextTone}
            contextToneSoft={contextToneSoft}
            hoveredAttentionLevel={hoveredAttentionLevel}
            reportStatusTitle={reportStatusTitle}
            reportStatusSub={reportStatusSub}
            reportReadings={reportReadings}
            reportForecast={reportForecast}
            reportAlerts={reportAlerts}
            vegetationChart={vegetationChart}
            moistureHistoryChart={moistureHistoryChart}
            temperatureChart={temperatureChart}
            vegetationRange={vegetationRange}
            moistureHistoryRange={moistureHistoryRange}
            temperatureRange={temperatureRange}
            focusedZone={focusedZone}
            focusedZoneJumpHint={focusedZoneJumpHint}
            handleOpenFocusedZone={handleOpenFocusedZone}
            contextualNotesTarget={contextualNotesTarget}
            handleOpenContextNotes={handleOpenContextNotes}
            statusColor={statusColor}
          />
        )}

        {/* ═══ ZONES ═══ */}
        {page === "zones" && (
          <ZonesSubPage
            reportZones={reportZones}
            reportFindings={reportFindings}
            trackedZoneCount={trackedZoneCount}
            healthyZoneCount={healthyZoneCount}
            stressedZoneCount={stressedZoneCount}
            criticalZoneCount={criticalZoneCount}
            affectedCellTotal={affectedCellTotal}
            focusedZone={focusedZone}
            focusedActivityZone={focusedActivityZone}
            focusedFamilySummary={focusedFamilySummary}
            focusedZoneFindings={focusedZoneFindings}
            focusedZoneAlerts={focusedZoneAlerts}
            trackedPocketPct={trackedPocketPct}
            outsideZonePct={outsideZonePct}
            selectedZoneId={selectedZoneId}
            onSelectZoneId={onSelectZoneId}
            hoveredCell={hoveredCell}
            updatedDate={report?.updatedDate ?? null}
            statusColor={statusColor}
            statusBg={statusBg}
          />
        )}

        {/* ═══ CROPS ═══ */}
        {page === "crops" && (
          <CropsSubPage
            ac={ac}
            crop={crop}
            summary={summary}
            mc={mc}
            contextOnlyOptical={contextOnlyOptical}
            contextTone={contextTone}
            radarWetnessModeLabel={radarWetnessModeLabel}
            cropSignalSummary={cropSignalSummary}
            cropMoistureSummary={cropMoistureSummary}
            cropActiveSignalSub={cropActiveSignalSub}
            cropTrackedContextText={cropTrackedContextText}
            cropThresholds={cropThresholds}
            cropFieldTiles={cropFieldTiles}
            cropDiseaseRisks={cropDiseaseRisks}
            focusedZone={focusedZone}
            focusedZoneJumpHint={focusedZoneJumpHint}
            handleOpenFocusedZone={handleOpenFocusedZone}
            contextualNotesTarget={contextualNotesTarget}
            handleOpenContextNotes={handleOpenContextNotes}
            statusColor={statusColor}
          />
        )}

        {/* ═══ MARKET ═══ */}
        {page === "market" && (
          <MarketSubPage
            market={market}
            ac={ac}
            marketContextTiles={marketContextTiles}
            marketHistoryEmptyText={marketHistoryEmptyText}
            marketAgronomicContextText={marketAgronomicContextText}
            marketScenarioQualifier={marketScenarioQualifier}
            focusedZone={focusedZone}
            focusedZoneJumpHint={focusedZoneJumpHint}
            handleOpenFocusedZone={handleOpenFocusedZone}
            contextualNotesTarget={contextualNotesTarget}
            handleOpenContextNotes={handleOpenContextNotes}
            statusColor={statusColor}
            onScenarioSaved={onMarketScenarioSaved}
          />
        )}

        {/* ═══ ACTIONS ═══ */}
        {page === "actions" && (
          <ActionsSubPage
            ac={ac}
            action={action}
            contextOnlyOptical={contextOnlyOptical}
            contextTone={contextTone}
            radarWetnessModeLabel={radarWetnessModeLabel}
            actionRecommendationText={actionRecommendationText}
            actionUrgencyLabel={actionUrgencyLabel}
            actionContextText={actionContextText}
            actionEvidenceSignals={actionEvidenceSignals}
            openQ={openQ}
            setOpenQ={setOpenQ}
            focusedZone={focusedZone}
            focusedZoneJumpHint={focusedZoneJumpHint}
            handleOpenFocusedZone={handleOpenFocusedZone}
            contextualNotesTarget={contextualNotesTarget}
            handleOpenContextNotes={handleOpenContextNotes}
            statusColor={statusColor}
          />
        )}

        {/* ═══ NOTES ═══ */}
        {page === "notes" && (
          <NotesSubPage
            notes={notes}
            selectedNotesTarget={selectedNotesTarget}
            effectiveInspectionTarget={effectiveInspectionTarget}
            ac={ac}
            isDark={isDark}
          />
        )}
      </div>
    </div>
    </MetricHintProvider>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════════ */

export interface FieldDetailPanelProps {
  fieldId: string;
  workspaceId?: string;
  fieldName: string;
  fieldMeta?: string;
  areaLabel?: string;
  mapModel?: FieldBoundaryPreviewRenderModel | null;
  hoveredCell?: CellHoverEvent | null;
  activeMode?: ModeKey;
  availableModes?: readonly ModeKey[];
  onModeChange?: (mode: ModeKey) => void;
  summary: FieldSummaryProps | null;
  report: FieldReportProps | null;
  market: FieldMarketProps | null;
  crop: FieldCropProps | null;
  action: FieldActionProps | null;
  notes: FieldNotesProps | null;
  activity: FieldActivityPanelModel | null;
  onMarketScenarioSaved?: (() => void | Promise<void>) | null;
  initialPage?: string | null;
  onInitialPageClose?: (() => void) | null;
  onClose?: (() => void) | null;
  /** Onboarding status for this field — passed from PreviewShell. Null = not onboarding. */
  onboardingStatus?: {
    status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
    progressPct: number | null;
    phaseLabel: string | null;
  } | null;
  /** Raw worker progressMessage for deriving hydration stages. */
  progressMessage?: string | null;
}

/* Types and MODE_TO_METRIC_KEY imported from ./fieldDetailTypes */

/* Helpers imported from ./fieldDetailHelpers */
import {
  parseNumericValue,
  hasDisplayValue,
  percentile,
  titleCaseLabel,
  formatSignedMetricDelta,
  buildSparkFromSurface,
  splitMetricDisplayParts,
  resolveSurfaceForMode,
  formatSurfaceMetricValue,
  isPreseasonOpticalContextSurface,
  findContextTile,
  findReportReading,
  findReportChart,
  resolveReportChartRangeLabels,
  resolveModeTrendChart,
  findCropFieldTile,
  findCropProvenanceValue,
} from "./fieldDetailHelpers";

function resolveAvailableModes(
  mapModel: FieldBoundaryPreviewRenderModel | null | undefined,
): readonly ModeKey[] {
  return MODES
    .map((mode) => mode.k)
    .filter((mode) => resolveSurfaceForMode(mapModel, mode) != null);
}

function resolveFieldMeta({
  fieldMeta,
  areaLabel,
  summary,
  crop,
}: {
  fieldMeta?: string;
  areaLabel?: string;
  summary: FieldSummaryProps | null;
  crop: FieldCropProps | null;
}) {
  if (fieldMeta) {
    return fieldMeta;
  }

  const cropLabel = summary?.crop || crop?.cropName;
  const stageLabel = summary?.cropStage || crop?.thresholdStageLabel;

  return [cropLabel, stageLabel, areaLabel].filter(Boolean).join(" · ");
}

function buildFieldExportUrl(input: {
  fieldId: string;
  workspaceId?: string;
  kind: "report" | "crop";
}) {
  const path =
    input.kind === "report"
      ? `/api/fields/${input.fieldId}/report-export`
      : `/api/fields/${input.fieldId}/crop-report-export`;
  const params = new URLSearchParams();

  if (input.workspaceId) {
    params.set("workspaceId", input.workspaceId);
  }

  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

export function FieldDetailPanel({
  fieldId,
  workspaceId,
  fieldName,
  fieldMeta,
  areaLabel,
  mapModel,
  hoveredCell,
  activeMode,
  availableModes: availableModesProp,
  onModeChange,
  summary,
  crop,
  report,
  market,
  action,
  notes,
  activity,
  onMarketScenarioSaved,
  initialPage,
  onInitialPageClose,
  onClose,
  onboardingStatus,
  progressMessage,
}: FieldDetailPanelProps) {
  const [internalMode, setInternalMode] = useState<ModeKey>("moisture");
  const [page, setPage] = useState<string | null>(initialPage ?? null);
  const [prevPage, setPrevPage] = useState<string | null>(null);
  const [selectedSubpageZoneId, setSelectedSubpageZoneId] = useState<string | null>(null);
  const [selectedSubpageNotesTarget, setSelectedSubpageNotesTarget] =
    useState<FieldNotesInspectionTarget | null>(null);
  const [bodyKey, setBodyKey] = useState(0);
  const [modeSwitchKey, setModeSwitchKey] = useState(0);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const theme = useAppTheme();
  const isDark = theme === "dark";
  const mode = activeMode ?? internalMode;
  const availableModes = availableModesProp ?? resolveAvailableModes(mapModel);

  /* ── Scroll-linked header shadow ── */
  const handleBodyScroll = useCallback(() => {
    if (bodyRef.current) {
      setHeaderScrolled(bodyRef.current.scrollTop > 8);
    }
  }, []);

  /* ── Mode switch triggers re-cascade ── */
  const handleModeSwitch = useCallback((newMode: ModeKey) => {
    if (newMode === mode) return;
    if (activeMode == null) {
      setInternalMode(newMode);
    }
    onModeChange?.(newMode);
    setModeSwitchKey((k) => k + 1);
  }, [activeMode, mode, onModeChange]);

  /* ── Subpage navigation with direction tracking ── */
  const handlePageOpen = useCallback((
    pageKey: string,
    options?: {
      zoneId?: string | null;
      notesTarget?: FieldNotesInspectionTarget | null;
    },
  ) => {
    setPrevPage(page);
    setPage(pageKey);
    setSelectedSubpageZoneId(options?.zoneId ?? null);
    setSelectedSubpageNotesTarget(options?.notesTarget ?? null);
  }, [page]);

  const handlePageClose = useCallback(() => {
    if (initialPage != null) {
      if (prevPage != null) {
        setPage(prevPage);
        setPrevPage(null);
        setSelectedSubpageZoneId(null);
        setSelectedSubpageNotesTarget(null);
        setBodyKey((k) => k + 1);
        return;
      }

      onInitialPageClose?.();
      return;
    }

    setPrevPage(page);
    setPage(null);
    setSelectedSubpageZoneId(null);
    setSelectedSubpageNotesTarget(null);
    setBodyKey((k) => k + 1);
  }, [initialPage, onInitialPageClose, page, prevPage]);

  useEffect(() => {
    setPage(initialPage ?? null);
    setPrevPage(null);
    setSelectedSubpageZoneId(null);
    setSelectedSubpageNotesTarget(null);
  }, [fieldId, initialPage]);

  useEffect(() => {
    setSelectedSubpageZoneId(null);
    setSelectedSubpageNotesTarget(null);
  }, [fieldId, report?.updatedDate]);

  useEffect(() => {
    if (availableModes.length === 0) {
      return;
    }

    if (!availableModes.includes(mode)) {
      const nextMode = availableModes[0]!;
      if (activeMode == null) {
        setInternalMode(nextMode);
      }
      onModeChange?.(nextMode);
    }
  }, [activeMode, availableModes, mode, onModeChange]);

  const liveModeData = buildFieldDetailModeData({
    mode,
    mapModel,
    hoveredCell,
    summary,
    report,
    crop,
    action,
    market,
  });
  /* ── Ramp-derived accent — matches exact map extrusion color ── */
  const metricKey = MODE_TO_METRIC_KEY[mode];
  const heroValuePct = liveModeData.hero.v * 100; // hero.v is 0–1, ramp expects 0–100
  const rampPal = resolveRampAccent(metricKey, heroValuePct, isDark);
  const contextPal = isDark
    ? {
        accent: "rgba(203,213,225,0.82)",
        tint: "rgba(148,163,184,0.10)",
        deep: "rgba(148,163,184,0.38)",
      }
    : {
        accent: "#64748b",
        tint: "rgba(100,116,139,0.08)",
        deep: "rgba(71,85,105,0.38)",
      };
  const pal = liveModeData.contextOnly ? contextPal : rampPal;
  const modeAccent = pal.accent;
  const heroRingSolid = liveModeData.contextOnly
    ? isDark
      ? "rgba(203,213,225,0.82)"
      : "#64748b"
    : resolveRampSolid(metricKey, heroValuePct);

  /* ── Color roles ── */
  const heroSev = liveModeData.hero.sev;
  const ac = modeAccent; // ramp color for all neutral UI — labels, mono, chips, progress
  const heroRing = heroSev === "positive" ? heroRingSolid : resolveHeroRingColor(modeAccent, heroSev, isDark);
  const sevColors = isDark ? SEV_COLORS_DARK[heroSev] : SEV_COLORS_LIGHT[heroSev];
  // sevColors.text → ONLY for hero headline + explicitly stressed vitals

  const resolvedFieldMeta = resolveFieldMeta({
    fieldMeta,
    areaLabel,
    summary,
    crop,
  });
  const stageIndex =
    crop?.growthSegments.findIndex((segment) => segment.active) ?? -1;
  const stageProgressPct =
    crop && crop.growthSegments.length > 0 && stageIndex >= 0
      ? ((stageIndex + 1) / crop.growthSegments.length) * 100
      : 0;
  const temperatureReading = findReportReading(report, "temperature");
  const windReading = findReportReading(report, "wind");
  const waterBalanceTile = findContextTile(market, "WATER BALANCE");
  const activeSignalsTile = findContextTile(market, "ACTIVE SIGNALS");
  const frostRiskTile = findCropFieldTile(crop, "FROST RISK");
  const atmosphericDemandTile = findCropFieldTile(crop, "ATMOSPHERIC DEMAND");
  const cropWaterBalanceTile = findCropFieldTile(crop, "WATER BALANCE");
  const gdd72hTile = findCropFieldTile(crop, "GDD 72H");
  const providerLabel = findCropProvenanceValue(crop, "Provider");
  const lastCaptureLabel = findCropProvenanceValue(crop, "Last Capture");
  const cloudCoverLabel = findCropProvenanceValue(crop, "Cloud Cover");
  const coverageLabel = findCropProvenanceValue(crop, "Coverage");
  const captureModeLabel = findCropProvenanceValue(crop, "Capture Mode");
  const gridCellsLabel = findCropProvenanceValue(crop, "Grid Cells");
  const moistureSourceLabel = findCropProvenanceValue(crop, "Moisture Source");
  const opticalValidityLabel = findCropProvenanceValue(crop, "Optical Validity");
  const stageSourceLabel = findCropProvenanceValue(crop, "Stage Source");
  const yieldRow = market?.revenueRows.find((row) => row.label === "Expected Yield") ?? null;
  const priceAtHarvestRow =
    market?.revenueRows.find((row) => row.label === "Price at Harvest") ?? null;
  const basisRow = market?.revenueRows.find((row) => row.label === "Local Basis") ?? null;
  const areaRow = market?.revenueRows.find((row) => row.label === "Field Area") ?? null;
  const historyRow = market?.referenceRows.find((row) => row.label === "Stored History") ?? null;
  const conciseHistoryLabel =
    historyRow?.value === "No stored captures" ? "0 captures" : historyRow?.value ?? null;
  const conciseFeedStatus =
    market?.closePriceCadPerTonne != null
      ? "Stored"
      : !market?.cropSymbol
        ? "N/A"
        : market?.availabilityState === "unsupported-feed"
          ? "Unsupported"
        : market?.referenceStatusLabel?.includes("feed connected")
          ? "Offline"
          : market?.referenceStatusLabel?.includes("quote yet")
            ? "Pending"
            : "N/A";
  const conciseYieldLabel =
    yieldRow?.value === "Add yield" || yieldRow?.value == null || yieldRow?.value === "—"
      ? "N/A"
      : yieldRow.value;
  const conciseQuoteLabel =
    priceAtHarvestRow?.value === "Add quote" ||
    priceAtHarvestRow?.value === "Needs yield" ||
    priceAtHarvestRow?.value == null ||
    priceAtHarvestRow?.value === "—"
      ? "N/A"
      : priceAtHarvestRow.value;
  const conciseBasisLabel =
    basisRow?.value === "Uses feed basis"
      ? "Feed"
      : basisRow?.value === "Not set" || basisRow?.value == null || basisRow?.value === "—"
        ? "N/A"
        : basisRow.value;
  const marketCardValue =
    market?.closePriceCadPerTonne != null
      ? market?.priceLabel ?? "—"
      : market?.cropSymbol ?? market?.referenceStatusLabel ?? "—";
  const marketCardMeta =
    market?.closePriceCadPerTonne != null
      ? market?.priceDeltaLabel ?? market?.priceUnitLabel ?? ""
      : conciseFeedStatus;
  const marketCardSub =
    [conciseHistoryLabel, areaRow?.value]
      .filter(Boolean)
      .join(" · ") || "N/A";
  const revenueCardValue =
    market?.grossRevenueLabel != null && market.grossRevenueLabel !== "—"
      ? market.grossRevenueLabel
      : market?.provisionalRevenueLabel && market.provisionalRevenueLabel !== "—"
        ? market.provisionalRevenueLabel
        : "N/A";
  const revenueCardSub =
    market?.grossRevenueLabel != null && market.grossRevenueLabel !== "—"
      ? [yieldRow?.value, areaRow?.value].filter(Boolean).join(" · ") ||
        market?.estimatedGrossSubLabel ||
        "Revenue unavailable"
      : [
          `Yield ${conciseYieldLabel ?? "N/A"}`,
          `Price ${conciseQuoteLabel ?? "N/A"}`,
          `Basis ${conciseBasisLabel ?? "N/A"}`,
        ].join(" · ");
  const intelligenceState = action?.intelligenceState ?? "none";
  const intelligenceFindingCount = action?.activeFindingCount ?? report?.findings.length ?? 0;
  const intelligenceZoneCount = action?.activeZoneCount ?? report?.zones.length ?? 0;
  const intelligenceTopRisk =
    action?.topRiskTitle ??
    (intelligenceState === "watchlist"
      ? "Watchlist only"
      : "No active intelligence signal");
  const intelligenceMeta =
    [action?.intelligenceSourceLabel, action?.intelligenceFreshnessLabel]
      .filter((value): value is string => Boolean(value))
      .join(" · ") || null;
  const intelligenceTopRiskLabel =
    intelligenceState === "active" ? "Top Risk" : "Status";
  const intelligenceAccentColor =
    intelligenceState === "active" &&
    (action?.topRiskSeverity === "critical" || action?.topRiskSeverity === "high")
      ? "#ef4444"
      : "#f59e0b";
  const intelligenceCardSeverity =
    intelligenceState === "active" &&
    (action?.topRiskSeverity === "critical" || action?.topRiskSeverity === "high")
      ? "danger"
      : "warning";
  const hasAccumulatedGdd =
    parseNumericValue(crop?.accumulatedGddLabel) != null &&
    (parseNumericValue(crop?.accumulatedGddLabel) ?? 0) > 0;
  const gddCardLabel =
    hasAccumulatedGdd || !hasDisplayValue(gdd72hTile?.value)
      ? "GDD Accumulated"
      : gdd72hTile?.label ?? "GDD 72H";
  const gddCardValue =
    hasAccumulatedGdd
      ? crop?.accumulatedGddLabel ?? "—"
      : gdd72hTile?.value ?? crop?.accumulatedGddLabel ?? "—";
  const gddCardSubLeft =
    hasAccumulatedGdd
      ? crop?.gddUnitLabel ?? "No crop context"
      : gdd72hTile?.sub ?? crop?.gddUnitLabel ?? "No crop context";
  const cropSignalSub =
    crop?.healthIndex.subLabel ??
    crop?.healthIndexTitle ??
    "No canopy index available";
  const moistureBalanceSub =
    crop?.moistureBalance.subLabel ??
    crop?.moistureBalanceTitle ??
    "No moisture balance context";
  const marketHistoryEmptyText =
    market?.availabilityReasonLabel ??
    market?.quoteStatusLabel ??
    market?.footerText ??
    (market?.cropSymbol
      ? "Only one stored quote has been captured so far."
      : "No supported quote symbol is available for this crop yet.");
  const temperatureCard = hasDisplayValue(temperatureReading?.value)
    ? {
        label: "Temperature",
        value: temperatureReading?.value ?? "—",
        sub: summary?.precipitationSub ?? "Current observation",
      }
    : hasDisplayValue(frostRiskTile?.value)
      ? {
          label: frostRiskTile?.label ?? "Frost Risk",
          value: frostRiskTile?.value ?? "—",
          sub: frostRiskTile?.sub ?? "No frost signal available",
        }
      : {
          label: "Temperature",
          value: "—",
          sub:
            frostRiskTile?.sub ??
            summary?.precipitationSub ??
            "Weather still initializing",
        };
  const waterBalanceCard = hasDisplayValue(waterBalanceTile?.value)
    ? {
        label: "Water Balance",
        value: waterBalanceTile?.value ?? "—",
        sub: waterBalanceTile?.sub ?? "72h forecast balance unavailable",
      }
    : hasDisplayValue(cropWaterBalanceTile?.value)
      ? {
          label: cropWaterBalanceTile?.label ?? "Water Balance",
          value: cropWaterBalanceTile?.value ?? "—",
          sub: cropWaterBalanceTile?.sub ?? "72h forecast balance unavailable",
        }
      : {
          label: "Water Balance",
          value: "—",
          sub:
            cropWaterBalanceTile?.sub ??
            waterBalanceTile?.sub ??
            "No forecast water balance yet",
        };
  const nextRainCard = hasDisplayValue(summary?.nextRain)
    ? {
        label: "Next Rain",
        value: summary?.nextRain ?? "—",
        sub: summary?.nextRainSub ?? "Forecast precipitation signal",
      }
    : hasDisplayValue(summary?.rainChance)
      ? {
          label: "Rain Chance",
          value: summary?.rainChance ?? "—",
          sub: summary?.rainChanceSub ?? "Next forecast window",
        }
      : hasDisplayValue(summary?.sevenDayTotal)
        ? {
            label: "7D Total",
            value: summary?.sevenDayTotal ?? "—",
            sub: summary?.sevenDayTotalSub ?? "Loaded forecast window",
          }
        : {
            label: "Next Rain",
            value: "—",
            sub:
              summary?.nextRainSub ??
              summary?.rainChanceSub ??
              summary?.sevenDayTotalSub ??
              "No forecast signal",
          };
  const windCard = hasDisplayValue(windReading?.value)
    ? {
        label: "Wind",
        value: windReading?.value ?? "—",
        sub: "Current observation",
      }
    : hasDisplayValue(atmosphericDemandTile?.value)
      ? {
          label: atmosphericDemandTile?.label ?? "Atmospheric Demand",
          value: atmosphericDemandTile?.value ?? "—",
          sub: atmosphericDemandTile?.sub ?? "No VPD signal available",
        }
      : {
          label: "Wind",
          value: "—",
          sub:
            atmosphericDemandTile?.sub ??
            summary?.rainChanceSub ??
            "No weather signal",
        };
  const sourceChips = Array.from(
    new Set(
      [
        liveModeData.sourceSummary,
        opticalValidityLabel ? `Optical ${opticalValidityLabel}` : null,
        stageSourceLabel ? `Stage ${stageSourceLabel}` : null,
        lastCaptureLabel ? `Captured ${lastCaptureLabel}` : null,
        providerLabel ? `Provider ${providerLabel}` : null,
        cloudCoverLabel && cloudCoverLabel !== "—" ? `Cloud ${cloudCoverLabel}` : null,
        coverageLabel && coverageLabel !== "—" ? `Coverage ${coverageLabel}` : null,
        captureModeLabel && captureModeLabel !== "—" ? `Mode ${captureModeLabel}` : null,
        gridCellsLabel ? `${gridCellsLabel} grid cells` : null,
        summary?.confidence ? `${summary.confidence} confidence` : null,
        moistureSourceLabel ? `Moisture ${moistureSourceLabel}` : null,
        summary?.updatedLabel ?? null,
        ...(report?.sources.slice(0, 2).map((source) => source.label) ?? []),
      ].filter((value): value is string => Boolean(value)),
    ),
  );
  const summaryAlerts = summary?.alerts ?? [];
  const outlookDays = (summary?.outlook ?? []).slice(0, 4);
  const dangerAlertCount =
    summary?.alerts.filter((alert) => alert.severity === "danger").length ?? 0;
  const warningAlertCount =
    summary?.alerts.filter((alert) => alert.severity === "warning").length ?? 0;

  return (
    <div className="fdp">
      {/* ── HEADER ── */}
      <div className={`fdp__header${headerScrolled ? " fdp__header--scrolled" : ""}`}>
        <div className="fdp__header-top">
          <div>
            <h1 className="fdp__field-name">{fieldName}</h1>
            {resolvedFieldMeta && <p className="fdp__field-meta">{resolvedFieldMeta}</p>}
          </div>
          <div className="fdp__header-actions">
            {dangerAlertCount > 0 ? (
              <div className="fdp__alert-pill fdp__alert-pill--danger">
                <AlertTriangle size={11} />
                {dangerAlertCount}
              </div>
            ) : null}
            {warningAlertCount > 0 ? (
              <div className="fdp__alert-pill fdp__alert-pill--warning">
                <AlertTriangle size={11} />
                {warningAlertCount}
              </div>
            ) : null}
            {onClose ? (
              <button
                type="button"
                className="fdp__close-btn"
                onClick={onClose}
                aria-label="Close panel"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
        </div>

        {/* Signal chips — hidden on sub-pages */}
        {!page && (
          <div className="fdp__modes">
            {MODES.filter((m) => availableModes.includes(m.k)).map((m) => {
              const isActive = m.k === mode;
              // Active mode gets the live ramp color; inactive gets muted
              const chipColor = isActive ? modeAccent : "var(--text-muted)";
              const Icon = m.icon;
              const modeLabel = resolveModeShortLabel(m.k, mapModel);
              return (
                <button
                  key={m.k}
                  onClick={() => handleModeSwitch(m.k)}
                  className={`fdp__mode-btn ${isActive ? "fdp__mode-btn--active" : ""}`}
                  style={isActive ? { background: pal.tint } : undefined}
                >
                  <Icon
                    size={16}
                    color={chipColor}
                    strokeWidth={isActive ? 2.5 : 1.5}
                  />
                  <span
                    className="fdp__mode-label"
                    style={{ color: chipColor }}
                  >
                    {modeLabel}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── HYDRATION STAGE TRACKER ── */}
      {onboardingStatus && !page && (
        <HydrationStageTracker
          fieldName={fieldName}
          onboardingStatus={onboardingStatus}
          progressMessage={progressMessage}
        />
      )}

      {/* ── CONTENT ── */}
      {page ? (
        <SubPageView
          key={page}
          fieldId={fieldId}
          workspaceId={workspaceId}
          mapModel={mapModel}
          page={page}
          mode={mode}
          onBack={handlePageClose}
          onOpenPage={handlePageOpen}
          ac={ac}
          isDark={isDark}
          liveModeData={liveModeData}
          hoveredCell={hoveredCell}
          summary={summary}
          report={report}
          market={market}
          crop={crop}
          action={action}
          notes={notes}
          activity={activity}
          selectedZoneId={selectedSubpageZoneId}
          onSelectZoneId={setSelectedSubpageZoneId}
          selectedNotesTarget={selectedSubpageNotesTarget}
          onSelectNotesTarget={setSelectedSubpageNotesTarget}
          onMarketScenarioSaved={onMarketScenarioSaved}
        />
      ) : (
        <MetricHintProvider>
        <div
          key={`body-${modeSwitchKey}-${bodyKey}`}
          ref={bodyRef}
          onScroll={handleBodyScroll}
          className={`fdp__body fdp__body--cols-2${bodyKey > 0 ? " fdp__body--entering" : ""}${modeSwitchKey > 0 ? " fdp__body--switching" : ""}`}
        >
          {/* ━━ HERO ━━ */}
          <div
            className="fdp__hero"
            style={heroSev !== "positive" ? { background: sevColors.gradient } : undefined}
          >
            <div style={{ flexShrink: 0 }}>
              <HeroDonut
                value={liveModeData.hero.v}
                display={liveModeData.hero.d}
                unit={liveModeData.hero.u}
                color={heroRing}
                label={resolveModeLabel(mode, mapModel).toUpperCase()}
              />
            </div>
            <div className="fdp__hero-text">
              <h2
                className="fdp__hero-headline fdp__hero-headline--compact"
                style={heroSev !== "positive" ? { color: sevColors.text } : undefined}
              >
                {liveModeData.headline}
              </h2>
              <p className="fdp__hero-sub">{liveModeData.sub}</p>
            </div>
          </div>

          {/* ━━ VITALS ━━ */}
          <div className="fdp__vitals-grid">
            {liveModeData.vitals.map((v, i) => {
              const vColor = vitalValueColor(v, modeAccent, isDark);
              const vSev = resolveVitalSeverity(v);
              return (
                <Card key={i} sevTint={vSev ? sevCardGradient(vSev, isDark) : undefined} data-metric-hint={v.label.toLowerCase()} data-metric-value={typeof v.value === 'string' ? v.value : String(v.value)}>
                  <LblM>{v.label}</LblM>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {v.icon === "down" && (
                      <TrendingDown size={14} color={vColor} />
                    )}
                    {v.icon === "up" && <TrendingUp size={14} color={vColor} />}
                    <Big color={vColor} size={24}>
                      {v.value}
                    </Big>
                  </div>
                </Card>
              );
            })}
          </div>


          {/* ━━ TREND ━━ */}
          <Card span={2} data-metric-hint="trend" data-metric-value={liveModeData.trendLabel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Lbl color={liveModeData.trendColor ?? ac}>{liveModeData.trendLabel}</Lbl>
              <span className="fdp-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                {liveModeData.trendMeta}
              </span>
            </div>
            <div>
              <Spark data={liveModeData.spark} color={liveModeData.trendColor ?? ac} height={40} />
            </div>
          </Card>

          {/* ━━ SPATIAL ━━ */}
          <Card data-metric-hint="spread" data-metric-value={liveModeData.spatialColumns[1]?.value ?? ''}>
            <Lbl color={ac}>Spread</Lbl>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                {liveModeData.spatialColumns.map((column) => (
                  <span
                    key={column.label}
                    style={{ fontFamily: "var(--font-body)", fontSize: 9, color: "var(--text-muted)" }}
                  >
                    {column.label}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Mono color={ac}>{liveModeData.spatialColumns[0].value}</Mono>
                <Mono>{liveModeData.spatialColumns[1].value}</Mono>
                <Mono color={ac}>{liveModeData.spatialColumns[2].value}</Mono>
              </div>
              <ProgBar value={liveModeData.spatialProgressPct} color={ac} height={3} />
            </div>
          </Card>

          <Card>
            <LblM>{gddCardLabel}</LblM>
            <div>
              <Big size={24}>{gddCardValue}</Big>
              <div style={{ marginTop: 4 }}>
                <ProgBar value={stageProgressPct} color={ac} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 8, color: "var(--text-muted)" }}>{gddCardSubLeft}</span>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 8, color: "var(--text-muted)" }}>{crop?.thresholdStageLabel ?? "Stage unavailable"}</span>
                </div>
              </div>
            </div>
          </Card>


          {/* ━━ WEATHER ━━ */}
          <Card data-metric-hint="temperature" data-metric-value={temperatureCard.value}><LblM>{temperatureCard.label}</LblM><div><Big size={24}>{temperatureCard.value}</Big><div><Sub>{temperatureCard.sub}</Sub></div></div></Card>
          <Card data-metric-hint="water balance" data-metric-value={waterBalanceCard.value}><LblM>{waterBalanceCard.label}</LblM><div><Big size={24}>{waterBalanceCard.value}</Big><div><Sub>{waterBalanceCard.sub}</Sub></div></div></Card>
          <Card data-metric-hint="precipitation" data-metric-value={nextRainCard.value}><LblM>{nextRainCard.label}</LblM><div><Big size={24}>{nextRainCard.value}</Big><div><Sub>{nextRainCard.sub}</Sub></div></div></Card>
          <Card data-metric-hint="wind" data-metric-value={windCard.value}><LblM>{windCard.label}</LblM><div><Big size={24}>{windCard.value}</Big><div><Sub>{windCard.sub}</Sub></div></div></Card>
          {outlookDays.length > 0 ? (
            <Card span={2}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Lbl color={ac}>Outlook</Lbl>
                <span className="fdp-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  {summary?.updatedLabel ?? "Forecast"}
                </span>
              </div>
              <div className="fdp__forecast-strip">
                {outlookDays.map((day, index) => {
                  const precipPct = parseNumericValue(day.precip) ?? 0;
                  return (
                    <div key={`${day.day}-${index}`} className="fdp__forecast-day">
                      <span
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: 9,
                          fontWeight: 700,
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {day.day}
                      </span>
                      <span
                        className="fdp-mono"
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "var(--text-primary)",
                        }}
                      >
                        {`${Math.round(day.high)}/${Math.round(day.low)}`}
                      </span>
                      <span
                        className="fdp-mono"
                        style={{ fontSize: 9, color: "var(--text-muted)" }}
                      >
                        {day.precip}
                      </span>
                      <div style={{ width: "80%", marginTop: 2 }}>
                        <ProgBar value={Math.max(0, Math.min(precipPct, 100))} color="#3b82f6" height={3} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : null}

          {/* ━━ GROWTH ━━ */}
          <Card>
            <LblM>Growth Stage</LblM>
            <div><Big size={20}>{summary?.cropStage || crop?.thresholdStageLabel || "—"}</Big><div><Sub>{summary?.crop || crop?.cropName || "Crop unavailable"}</Sub></div></div>
          </Card>
          <Card>
            <Lbl color={ac}>Cell Health</Lbl>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <Big color="#ef4444" size={22}>
                  {liveModeData.belowThresholdValue}
                </Big>
                <div>
                  <Sub>{liveModeData.belowThresholdLabel}</Sub>
                </div>
              </div>
              <div>
                <Mono color={ac}>{liveModeData.inZonesValue}</Mono>
                <div>
                  <Sub>{liveModeData.inZonesLabel}</Sub>
                </div>
              </div>
            </div>
          </Card>


          {/* ━━ INTELLIGENCE ━━ */}
          <AlertCard sev={intelligenceCardSeverity} span={2}>
            <Lbl color={intelligenceAccentColor}>Intelligence</Lbl>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <Big color={intelligenceAccentColor} size={32}>{intelligenceFindingCount}</Big>
                <span style={{ fontFamily: "var(--font-body)", fontSize: 8, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Findings</span>
              </div>
              <div style={{ width: 1, height: 36, background: "#ef444420" }} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <Big color="#f59e0b" size={32}>{intelligenceZoneCount}</Big>
                <span style={{ fontFamily: "var(--font-body)", fontSize: 8, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Zones</span>
              </div>
              <div style={{ width: 1, height: 36, background: "#ef444420" }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontFamily: "var(--font-body)", fontSize: 9, fontWeight: 700, color: intelligenceAccentColor, textTransform: "uppercase", letterSpacing: 0.5 }}>{intelligenceTopRiskLabel}</span>
                <p style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--text-body)", margin: "3px 0 0", lineHeight: 1.4 }}>{intelligenceTopRisk}</p>
                {intelligenceMeta ? (
                  <p className="fdp-mono" style={{ fontSize: 9, color: "var(--text-muted)", margin: "4px 0 0" }}>
                    {intelligenceMeta}
                  </p>
                ) : null}
              </div>
            </div>
          </AlertCard>
          {summaryAlerts.length > 0 ? (
            <AlertCard
              sev={dangerAlertCount > 0 ? "danger" : "warning"}
              span={2}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <Lbl color={dangerAlertCount > 0 ? "#ef4444" : "#f59e0b"}>Field Alerts</Lbl>
                <span className="fdp-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  {summaryAlerts.length} active
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                {summaryAlerts.slice(0, 2).map((alert, index) => (
                  <div
                    key={`${alert.label}-${index}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "var(--text-primary)",
                        }}
                      >
                        {alert.label}
                      </div>
                      <Sub>{alert.desc}</Sub>
                    </div>
                    <span
                      className="fdp-mono"
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: alert.severity === "danger" ? "#ef4444" : "#f59e0b",
                        textTransform: "uppercase",
                        flexShrink: 0,
                      }}
                    >
                      {alert.severity === "danger" ? "High" : "Watch"}
                    </span>
                  </div>
                ))}
                {summaryAlerts.length > 2 ? (
                  <Sub>{`+${summaryAlerts.length - 2} more alert${summaryAlerts.length - 2 === 1 ? "" : "s"}`}</Sub>
                ) : null}
              </div>
            </AlertCard>
          ) : null}

          {/* ━━ ACTION ━━ */}
          <Card span={2} style={{ border: "1px solid var(--border-light)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `${ac}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Zap size={14} color={ac} />
              </div>
              <div style={{ flex: 1 }}>
                <Lbl color={ac}>Recommended Action</Lbl>
                <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-primary)", margin: "4px 0 0", lineHeight: 1.6 }}>
                  {action?.recommendation ?? "No active recommendation is available for this field yet."}
                </p>
              </div>
            </div>
          </Card>

          {/* ━━ MARKET ━━ */}
          <Card data-metric-hint="price" data-metric-value={marketCardValue}><LblM>{market?.sectionLabel ?? "Market"}</LblM><div><div style={{ display: "flex", alignItems: "baseline", gap: 6 }}><Big size={24}>{marketCardValue}</Big><Mono color={ac}>{marketCardMeta}</Mono></div><Sub>{marketCardSub}</Sub></div></Card>
          <Card data-metric-hint="revenue" data-metric-value={revenueCardValue}><LblM>Revenue Est.</LblM><div><Big size={22}>{revenueCardValue}</Big><div><Sub>{revenueCardSub}</Sub></div></div></Card>


          {/* ━━ SOURCE ━━ */}
          <Card span={2}>
            <LblM>Source</LblM>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {sourceChips.map((chip, i) => (
                <span key={i} className="fdp__chip">
                  {i === 0 ? (
                    <Satellite size={10} color="var(--text-secondary)" />
                  ) : i === 1 ? (
                    <Clock size={10} color="var(--text-secondary)" />
                  ) : i === 2 ? (
                    <Eye size={10} color="var(--text-secondary)" />
                  ) : i === 3 ? (
                    <Radio size={10} color="var(--text-secondary)" />
                  ) : (
                    <Target size={10} color="var(--text-secondary)" />
                  )}
                  {chip}
                </span>
              ))}
            </div>
          </Card>

          <div style={{ height: 4 }} />
        </div>
        </MetricHintProvider>
      )}

      {/* ── EXPLORE FOOTER ── */}
      <div className="fdp__footer">
        {SUB_PAGES.filter((sp) => sp.k !== "notes").map((sp) => {
          const Icon = sp.icon;
          const isActive = page === sp.k;
          // Contextual badges: count of actionable items per section
          const badge = resolveFooterBadge(sp.k, { report, action, summary, crop });
          return (
            <button
              key={sp.k}
              className={`fdp__footer-item${isActive ? " fdp__footer-item--active" : ""}`}
              onClick={() => isActive ? handlePageClose() : handlePageOpen(sp.k)}
            >
              <div style={{ position: "relative", display: "inline-flex" }}>
                <Icon size={16} className="fdp__footer-icon" strokeWidth={1.8} />
                {badge && (
                  <span
                    className="fdp__footer-badge"
                    style={{ background: badge.color }}
                  >
                    {badge.count > 9 ? "9+" : badge.count}
                  </span>
                )}
              </div>
              <span className="fdp__footer-label">{sp.l}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
