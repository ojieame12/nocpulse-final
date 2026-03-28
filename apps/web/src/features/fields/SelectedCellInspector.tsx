"use client";

import type { CellClickEvent, FieldAgronomicSurfaceMetricKey } from "@fieldpulse/map";
import { Crosshair } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { PanelHeader } from "../../components/ui/PanelHeader";
import { PanelEmptyState } from "../../components/ui/PanelEmptyState";
import type { FieldCellInspectorModel } from "./CellInspectorModel";

type SelectedCellInspectorProps = {
  selection: CellClickEvent | null;
  model: FieldCellInspectorModel | null;
  focusedZoneId?: string | null;
  onZoneSelect?: (zoneId: string | null) => void;
  onClose?: () => void;
};

const METRIC_LABELS: Record<FieldAgronomicSurfaceMetricKey, string> = {
  ndvi: "NDVI",
  ndre: "NDRE",
  ndmi: "NDMI",
  "root-zone-moisture-pct": "Root Moisture",
  "surface-moisture-pct": "Surface Moisture",
};

function formatMetricValue(metricKey: FieldAgronomicSurfaceMetricKey, pct: number): string {
  if (
    metricKey === "root-zone-moisture-pct" ||
    metricKey === "surface-moisture-pct"
  ) {
    return `${pct.toFixed(1)}%`;
  }

  return (pct / 100).toFixed(2);
}

function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function severityVariant(
  severity:
    | "low"
    | "medium"
    | "high"
    | "critical"
    | "healthy"
    | "stressed"
    | null,
): "positive" | "warning" | "danger" | "neutral" {
  if (severity === "critical" || severity === "high") return "danger";
  if (severity === "medium" || severity === "stressed") return "warning";
  if (severity === "low" || severity === "healthy") return "positive";
  return "neutral";
}

export function SelectedCellInspector({
  selection,
  model,
  focusedZoneId = null,
  onZoneSelect,
  onClose,
}: SelectedCellInspectorProps) {
  const cell = selection
    ? model?.cells.find((entry) => entry.id === selection.cellId) ?? null
    : null;
  const relatedFindings = selection
    ? (model?.findings ?? []).filter((finding) =>
        finding.affectedCellKeys.includes(selection.cellId),
      )
    : [];
  const relatedZones = selection
    ? (model?.zones ?? []).filter((zone) =>
        zone.affectedCellKeys.includes(selection.cellId),
      )
    : [];

  return (
    <div className="panel">
      <PanelHeader
        title={selection ? `CELL ${selection.cellId.toUpperCase()}` : "CELL INSPECTOR"}
        onClose={onClose}
      />
      <div className="panel__body">
        {!selection ? (
          <PanelEmptyState
            icon={Crosshair}
            title="No spot selected"
            description="Tap any point on the map to inspect soil moisture, vegetation indices, and change history."
          />
        ) : (
          <>
            <div className="cell-inspector__hero">
              <div>
                <span className="cell-inspector__eyebrow">
                  {cell
                    ? `Grid r${cell.rowIndex + 1} · c${cell.columnIndex + 1}`
                    : "Mapped cell"}
                </span>
                <h3 className="cell-inspector__title">
                  {METRIC_LABELS[selection.metricKey] ?? selection.metricKey}
                </h3>
              </div>
              <Badge variant={severityVariant(selection.severityLabel)}>
                {selection.severityLabel ?? "No severity"}
              </Badge>
            </div>

            <div className="metric-tiles">
              <div className="metric-tile">
                <span className="metric-tile__label">Metric</span>
                <span className="metric-tile__value">
                  {formatMetricValue(selection.metricKey, selection.metricValuePct)}
                </span>
              </div>
              <div className="metric-tile">
                <span className="metric-tile__label">Confidence</span>
                <span className="metric-tile__value">
                  {Math.round(selection.confidence * 100)}%
                </span>
              </div>
              <div className="metric-tile">
                <span className="metric-tile__label">Delta vs Avg</span>
                <span className="metric-tile__value">
                  {selection.deltaFromFieldAvgPct > 0 ? "+" : ""}
                  {selection.deltaFromFieldAvgPct.toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="panel__section">
              <div className="panel__section-header">
                <span className="panel__section-label">CELL STATE</span>
                <span className="panel__section-meta">{selection.sourceTier}</span>
              </div>
              <div className="panel__data-grid">
                <div className="panel__data-row">
                  <div className="panel__data-cell">
                    <span className="panel__data-cell-label">Root moisture</span>
                    <span className="panel__data-cell-value">
                      {cell ? `${cell.rootZonePct.toFixed(1)}%` : "—"}
                    </span>
                  </div>
                  <div className="panel__data-cell">
                    <span className="panel__data-cell-label">Surface moisture</span>
                    <span className="panel__data-cell-value">
                      {cell ? `${cell.surfacePct.toFixed(1)}%` : "—"}
                    </span>
                  </div>
                </div>
                <div className="panel__data-row">
                  <div className="panel__data-cell">
                    <span className="panel__data-cell-label">Variance</span>
                    <span className="panel__data-cell-value">
                      {selection.varianceBucket}
                    </span>
                  </div>
                  <div className="panel__data-cell">
                    <span className="panel__data-cell-label">Observed</span>
                    <span className="panel__data-cell-value panel__data-cell-value--text">
                      {cell ? formatTimestamp(cell.observedAt) : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel__section">
              <div className="panel__section-header">
                <span className="panel__section-label">RELATED FINDINGS</span>
                <span className="panel__section-meta">
                  {relatedFindings.length} linked
                </span>
              </div>
              {relatedFindings.length === 0 ? (
                <div className="cell-inspector__empty cell-inspector__empty--compact">
                  No active findings currently reference this cell.
                </div>
              ) : (
                relatedFindings.map((finding) => (
                  <button
                    key={finding.id}
                    type="button"
                    className="alerts-card cell-inspector__interactive-card"
                    onClick={() =>
                      onZoneSelect?.(finding.trackedZoneIds[0] ?? null)
                    }
                  >
                    <div className="alerts-card__top">
                      <span className="alerts-card__title">{finding.title}</span>
                      <Badge variant={severityVariant(finding.severity)}>
                        {finding.severity}
                      </Badge>
                    </div>
                    <span className="alerts-card__subtitle">
                      {finding.summary ?? finding.family.replace(/_/g, " ")}
                    </span>
                    {finding.recommendedAction ? (
                      <span className="cell-inspector__detail">
                        {finding.recommendedAction}
                      </span>
                    ) : null}
                  </button>
                ))
              )}
            </div>

            <div className="panel__section">
              <div className="panel__section-header">
                <span className="panel__section-label">TRACKED ZONES</span>
                <span className="panel__section-meta">{relatedZones.length} linked</span>
              </div>
              {relatedZones.length === 0 ? (
                <div className="cell-inspector__empty cell-inspector__empty--compact">
                  This cell is not currently part of a tracked zone.
                </div>
              ) : (
                relatedZones.map((zone) => (
                  <button
                    key={zone.id}
                    type="button"
                    className={`cell-inspector__zone-card cell-inspector__interactive-card${
                      focusedZoneId === zone.id ? " cell-inspector__interactive-card--active" : ""
                    }`}
                    onClick={() =>
                      onZoneSelect?.(focusedZoneId === zone.id ? null : zone.id)
                    }
                  >
                    <div className="alerts-card__top">
                      <span className="alerts-card__title">
                        {zone.family.replace(/_/g, " ")}
                      </span>
                      <Badge variant={severityVariant(zone.latestSeverity)}>
                        {zone.status}
                      </Badge>
                    </div>
                    <span className="alerts-card__subtitle">
                      {zone.trackingKey} · detections {zone.detectionCount}
                    </span>
                    <span className="cell-inspector__detail">
                      Last seen {formatTimestamp(zone.lastSeenAt)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
