"use client";

import { Activity } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { MetricTile } from "../../components/ui/MetricTile";
import { PanelHeader } from "../../components/ui/PanelHeader";
import { PanelEmptyState } from "../../components/ui/PanelEmptyState";
import type { FieldActivityPanelModel } from "./FieldActivityPanelModel";

type FieldActivityPanelProps = {
  activity: FieldActivityPanelModel | null;
  focusedZoneId?: string | null;
  onZoneSelect?: (zoneId: string | null) => void;
  onZoneDrillDown?: (zoneId: string) => void;
  onClose?: () => void;
};

function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function severityVariant(
  severity: "low" | "medium" | "high" | "critical" | null,
): "positive" | "warning" | "danger" | "neutral" {
  if (severity === "critical" || severity === "high") return "danger";
  if (severity === "medium") return "warning";
  if (severity === "low") return "positive";
  return "neutral";
}

function familyLabel(family: string): string {
  return family.replace(/_/g, " ");
}

export function FieldActivityPanel({
  activity,
  focusedZoneId = null,
  onZoneSelect,
  onZoneDrillDown,
  onClose,
}: FieldActivityPanelProps) {
  return (
    <div className="panel">
      <PanelHeader title="FIELD ACTIVITY" onClose={onClose} />
      <div className="panel__body">
        {!activity ? (
          <PanelEmptyState
            icon={Activity}
            title="No activity yet"
            description="No findings or tracked-zone activity is available for this field yet."
          />
        ) : (
          <>
            <div className="metric-tiles">
              <MetricTile value={String(activity.activeFindingCount)} label="Active Findings" />
              <MetricTile value={String(activity.activeZoneCount)} label="Active Zones" />
              <MetricTile value={String(activity.newZoneCount)} label="New Zones" />
              <MetricTile value={String(activity.recoveringZoneCount)} label="Recovering" />
            </div>

            <div className="panel__section">
              <div className="panel__section-header">
                <span className="panel__section-label">ZONE FAMILIES</span>
                <span className="panel__section-meta">
                  Generated {formatTimestamp(activity.generatedAt)}
                </span>
              </div>
              {activity.familySummaries.length === 0 ? (
                <div className="cell-inspector__empty cell-inspector__empty--compact">
                  No tracked zone families are active for this field.
                </div>
              ) : (
                <div className="field-activity__family-grid">
                  {activity.familySummaries.map((summary) => (
                    <div key={summary.family} className="field-activity__family-pill">
                      <span className="field-activity__family-label">
                        {familyLabel(summary.family)}
                      </span>
                      <span className="field-activity__family-count">
                        {summary.activeZoneCount} active / {summary.totalZoneCount} total
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="panel__section">
              <div className="panel__section-header">
                <span className="panel__section-label">ACTIVE FINDINGS</span>
                <span className="panel__section-meta">{activity.findings.length} findings</span>
              </div>
              {activity.findings.length === 0 ? (
                <div className="cell-inspector__empty cell-inspector__empty--compact">
                  No active findings currently reference this field.
                </div>
              ) : (
                activity.findings.map((finding) => (
                  <button
                    key={finding.id}
                    type="button"
                    className={`alerts-card field-activity__card alerts-card--interactive${
                      focusedZoneId && finding.trackedZoneIds.includes(focusedZoneId)
                        ? " alerts-card--focused"
                        : ""
                    }`}
                    onClick={() =>
                      onZoneSelect?.(
                        focusedZoneId && finding.trackedZoneIds.includes(focusedZoneId)
                          ? null
                          : finding.trackedZoneIds[0] ?? null,
                      )
                    }
                  >
                    <div className="alerts-card__top">
                      <span className="alerts-card__title">{finding.title}</span>
                      <Badge variant={severityVariant(finding.severity)}>
                        {finding.severity}
                      </Badge>
                    </div>
                    <span className="alerts-card__subtitle">
                      {finding.summary ?? "No summary available."}
                    </span>
                    <span className="field-activity__detail">
                      Started {formatTimestamp(finding.startedAt)}
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="panel__section">
              <div className="panel__section-header">
                <span className="panel__section-label">TRACKED ZONES</span>
                <span className="panel__section-meta">
                  {activity.zones.length} total · {activity.resolvedZoneCount} resolved
                </span>
              </div>
              {activity.zones.length === 0 ? (
                <div className="cell-inspector__empty cell-inspector__empty--compact">
                  No tracked zones exist for this field yet.
                </div>
              ) : (
                activity.zones.map((zone) => (
                  <button
                    key={zone.id}
                    type="button"
                    className={`alerts-card field-activity__card alerts-card--interactive${
                      focusedZoneId === zone.id ? " alerts-card--focused" : ""
                    }`}
                    onClick={() => {
                      onZoneSelect?.(zone.id);
                      onZoneDrillDown?.(zone.id);
                    }}
                  >
                    <div className="alerts-card__top">
                      <span className="alerts-card__title">
                        {familyLabel(zone.family)} · {zone.trackingKey}
                      </span>
                      <Badge variant={severityVariant(zone.severity)}>
                        {zone.status}
                      </Badge>
                    </div>
                    <span className="alerts-card__subtitle">
                      {zone.affectedCellCount} cells · {zone.detectionCount} detections
                    </span>
                    <span className="field-activity__detail">
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
