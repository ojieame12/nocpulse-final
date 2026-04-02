"use client";

import { Activity, X } from "lucide-react";
import { Card, Lbl, LblM, Big, Sub, Mono } from "../../components/panels/fieldDetailCardPrimitives";
import { PanelEmptyState } from "../../components/ui/PanelEmptyState";
import type {
  FieldActivityPanelModel,
  FieldActivityFindingItem,
  FieldActivityZoneItem,
} from "./FieldActivityPanelModel";

type FieldActivityPanelProps = {
  activity: FieldActivityPanelModel | null;
  contextLabel?: string;
  scopeLabel?: string;
  focusedZoneId?: string | null;
  onZoneSelect?: (zoneId: string | null) => void;
  onZoneDrillDown?: (zoneId: string) => void;
  onClose?: () => void;
  showHeader?: boolean;
};

/* ── Helpers ── */

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function familyLabel(f: string): string {
  return f.replace(/_/g, " ");
}

function sevColor(s: string | null): string {
  if (s === "critical" || s === "high") return "#ef4444";
  if (s === "medium") return "#f59e0b";
  if (s === "low") return "#16a34a";
  return "var(--text-muted)";
}

function sevBg(s: string | null): string {
  if (s === "critical" || s === "high") return "#fef2f2";
  if (s === "medium") return "#fef3c7";
  if (s === "low") return "#f0fdf4";
  return "var(--color-slate-50)";
}

function isAllQuiet(a: FieldActivityPanelModel): boolean {
  return (
    a.activeFindingCount === 0 &&
    a.activeZoneCount === 0 &&
    a.newZoneCount === 0 &&
    a.recoveringZoneCount === 0
  );
}

/* ── Finding Card ── */

function FindingCard({
  finding,
  focused,
  onSelect,
}: {
  finding: FieldActivityFindingItem;
  focused: boolean;
  onSelect: () => void;
}) {
  const color = sevColor(finding.severity);
  return (
    <Card
      span={-1}
      accent={color}
      onClick={onSelect}
      style={focused ? { boxShadow: `inset 0 0 0 1px ${color}` } : undefined}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            {finding.title}
          </span>
          <Sub>{finding.summary ?? "No summary available."}</Sub>
        </div>
        <span
          className="fdp-mono"
          style={{
            fontSize: 9,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 999,
            textTransform: "uppercase",
            flexShrink: 0,
            background: sevBg(finding.severity),
            color,
          }}
        >
          {finding.severity}
        </span>
      </div>
      <Mono>Started {fmtTime(finding.startedAt)}</Mono>
    </Card>
  );
}

/* ── Zone Card ── */

function ZoneCard({
  zone,
  focused,
  onDrillDown,
}: {
  zone: FieldActivityZoneItem;
  focused: boolean;
  onDrillDown: () => void;
}) {
  const color = sevColor(zone.severity);
  return (
    <Card
      span={-1}
      accent={color}
      onClick={onDrillDown}
      style={focused ? { boxShadow: `inset 0 0 0 1px ${color}` } : undefined}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            {familyLabel(zone.family)} · {zone.trackingKey}
          </span>
          <Sub>
            {zone.affectedCellCount} cells · {zone.detectionCount} detections
          </Sub>
        </div>
        <span
          className="fdp-mono"
          style={{
            fontSize: 9,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 999,
            textTransform: "uppercase",
            flexShrink: 0,
            background: sevBg(zone.severity),
            color,
          }}
        >
          {zone.status}
        </span>
      </div>
      <div className="fdp__zone-metrics">
        <div>
          <span className="fdp__zone-metric-label">Severity</span>
          <Mono color={zone.severity ? color : undefined}>
            {zone.severity ?? "—"}
          </Mono>
        </div>
        <div>
          <span className="fdp__zone-metric-label">Cells</span>
          <Mono>{zone.affectedCellCount}</Mono>
        </div>
        <div>
          <span className="fdp__zone-metric-label">Last seen</span>
          <Mono>{fmtTime(zone.lastSeenAt)}</Mono>
        </div>
      </div>
    </Card>
  );
}

/* ── Content ── */

function ActivityContent({
  activity,
  contextLabel,
  focusedZoneId = null,
  onZoneSelect,
  onZoneDrillDown,
}: Pick<
  FieldActivityPanelProps,
  "activity" | "contextLabel" | "focusedZoneId" | "onZoneSelect" | "onZoneDrillDown"
>) {
  if (!activity) {
    return (
      <PanelEmptyState
        icon={Activity}
        title="No activity yet"
        description="No findings or tracked-zone activity is available for this field yet."
      />
    );
  }

  // All zeros — show a calm "all clear" state instead of blank cards
  if (isAllQuiet(activity)) {
    const heldBackOnly =
      (activity.hiddenFindingCount > 0 || activity.hiddenZoneCount > 0) &&
      activity.dataQualityLabel != null &&
      activity.dataQualityLabel !== "Ready";

    return (
      <>
        <div
          className="fdp__vitals-grid"
          style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
        >
          <Card>
            <LblM>Findings</LblM>
            <Big size={24}>0</Big>
          </Card>
          <Card>
            <LblM>Active</LblM>
            <Big size={24}>0</Big>
          </Card>
          <Card>
            <LblM>New</LblM>
            <Big size={24}>0</Big>
          </Card>
          <Card>
            <LblM>Recovering</LblM>
            <Big size={24}>0</Big>
          </Card>
        </div>

        <Card span={-1}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              padding: "24px 16px",
              textAlign: "center",
            }}
          >
            <Activity
              size={32}
              strokeWidth={1.5}
              style={{ color: "var(--text-muted)", opacity: 0.5 }}
            />
            <span
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: 16,
                fontWeight: 400,
                color: "var(--text-primary)",
              }}
            >
              {heldBackOnly ? "Activity held back" : "All clear"}
            </span>
            <Sub>
              {heldBackOnly
                ? `Field-dependent findings and tracked zones are being held back while data quality is ${String(activity.dataQualityLabel).toLowerCase()}.`
                : "No active findings or tracked zones. The analysis engine will detect patterns as satellite passes accumulate."}
            </Sub>
          </div>
        </Card>

        <Card span={-1}>
          <LblM>Activity Summary</LblM>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Sub>Generated</Sub>
              <Mono>{fmtTime(activity.generatedAt)}</Mono>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Sub>Resolved zones</Sub>
              <Mono>{activity.resolvedZoneCount}</Mono>
            </div>
            {heldBackOnly ? (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Sub>Held back activity</Sub>
                <Mono>
                  {activity.hiddenFindingCount} findings · {activity.hiddenZoneCount} zones
                </Mono>
              </div>
            ) : null}
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      {/* ── Vitals ── */}
      <div
        className="fdp__vitals-grid"
        style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
      >
        <Card>
          <LblM>Findings</LblM>
          <Big size={24}>{activity.activeFindingCount}</Big>
        </Card>
        <Card>
          <LblM>Active</LblM>
          <Big
            size={24}
            color={activity.activeZoneCount > 0 ? "#f59e0b" : undefined}
          >
            {activity.activeZoneCount}
          </Big>
        </Card>
        <Card>
          <LblM>New</LblM>
          <Big
            size={24}
            color={activity.newZoneCount > 0 ? "#3b82f6" : undefined}
          >
            {activity.newZoneCount}
          </Big>
        </Card>
        <Card>
          <LblM>Recovering</LblM>
          <Big
            size={24}
            color={
              activity.recoveringZoneCount > 0 ? "#16a34a" : undefined
            }
          >
            {activity.recoveringZoneCount}
          </Big>
        </Card>
      </div>

      {contextLabel ? (
        <Card span={-1} className="fdp-card--muted">
          <Sub>{contextLabel}</Sub>
        </Card>
      ) : null}

      {activity.hiddenFindingCount > 0 || activity.hiddenZoneCount > 0 ? (
        <Card span={-1} className="fdp-card--muted">
          <Sub>
            {activity.hiddenFindingCount} finding{activity.hiddenFindingCount === 1 ? "" : "s"} and {activity.hiddenZoneCount} zone{activity.hiddenZoneCount === 1 ? "" : "s"} are being held back while field data quality is {String(activity.dataQualityLabel ?? "limited").toLowerCase()}.
          </Sub>
        </Card>
      ) : null}

      {/* ── Zone Families ── */}
      {activity.familySummaries.length > 0 && (
        <>
          <div style={{ gridColumn: "1 / -1" }}>
            <LblM>ZONE FAMILIES</LblM>
          </div>
          {activity.familySummaries.map((summary) => {
            const ratio =
              summary.totalZoneCount > 0
                ? summary.activeZoneCount / summary.totalZoneCount
                : 0;
            const ratioColor =
              ratio >= 1 ? "#ef4444" : ratio >= 0.5 ? "#f59e0b" : "#16a34a";
            return (
              <Card key={summary.family}>
                <Lbl color={ratioColor}>{familyLabel(summary.family)}</Lbl>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 6,
                  }}
                >
                  <Big size={22} color={ratioColor}>
                    {summary.activeZoneCount}
                  </Big>
                  <Sub>/ {summary.totalZoneCount} zones</Sub>
                </div>
                <div
                  style={{
                    height: 3,
                    borderRadius: 2,
                    background: `${ratioColor}18`,
                    marginTop: 2,
                  }}
                >
                  <div
                    style={{
                      height: 3,
                      borderRadius: 2,
                      width: `${Math.round(ratio * 100)}%`,
                      background: ratioColor,
                      transition: "width 600ms cubic-bezier(.16,1,.3,1)",
                    }}
                  />
                </div>
              </Card>
            );
          })}
        </>
      )}

      {/* ── Active Findings ── */}
      {activity.findings.length > 0 && (
        <>
          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <LblM>ACTIVE FINDINGS</LblM>
            <Mono>{activity.findings.length} findings</Mono>
          </div>
          {activity.findings.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              focused={
                !!focusedZoneId &&
                finding.trackedZoneIds.includes(focusedZoneId)
              }
              onSelect={() =>
                onZoneSelect?.(
                  focusedZoneId &&
                    finding.trackedZoneIds.includes(focusedZoneId)
                    ? null
                    : finding.trackedZoneIds[0] ?? null,
                )
              }
            />
          ))}
        </>
      )}

      {/* ── Tracked Zones ── */}
      {activity.zones.length > 0 && (
        <>
          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <LblM>TRACKED ZONES</LblM>
            <Mono>
              {activity.zones.length} total · {activity.resolvedZoneCount}{" "}
              resolved
            </Mono>
          </div>
          {activity.zones.map((zone) => (
            <ZoneCard
              key={zone.id}
              zone={zone}
              focused={focusedZoneId === zone.id}
              onDrillDown={() => {
                onZoneSelect?.(zone.id);
                onZoneDrillDown?.(zone.id);
              }}
            />
          ))}
        </>
      )}

      {/* ── Summary ── */}
      <Card span={-1}>
        <LblM>Activity Summary</LblM>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { k: "Generated", v: fmtTime(activity.generatedAt) },
            {
              k: "Tracked families",
              v:
                activity.familySummaries
                  .map((f) => familyLabel(f.family))
                  .join(" · ") || "—",
            },
            { k: "Active zones", v: String(activity.activeZoneCount) },
            { k: "Resolved zones", v: String(activity.resolvedZoneCount) },
            {
              k: "Top finding",
              v: activity.findings[0]?.title ?? "No active findings",
            },
            ...(activity.hiddenFindingCount > 0 || activity.hiddenZoneCount > 0
              ? [
                  {
                    k: "Held back",
                    v: `${activity.hiddenFindingCount} findings · ${activity.hiddenZoneCount} zones`,
                  },
                ]
              : []),
          ].map((d) => (
            <div
              key={d.k}
              style={{ display: "flex", justifyContent: "space-between" }}
            >
              <Sub>{d.k}</Sub>
              <Mono>{d.v}</Mono>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

/* ── Panel Shell ── */

export function FieldActivityPanel({
  activity,
  contextLabel,
  scopeLabel,
  focusedZoneId = null,
  onZoneSelect,
  onZoneDrillDown,
  onClose,
  showHeader = true,
}: FieldActivityPanelProps) {
  const content = (
    <ActivityContent
      activity={activity}
      contextLabel={contextLabel}
      focusedZoneId={focusedZoneId}
      onZoneSelect={onZoneSelect}
      onZoneDrillDown={onZoneDrillDown}
    />
  );

  if (!showHeader) {
    return content;
  }

  return (
    <div
      className="fdp"
      style={{
        position: "absolute",
        top: "var(--space-lg)",
        right: "var(--space-lg)",
        bottom: "var(--space-xl)",
      }}
    >
      {/* ── FDP-style header ── */}
      <div className="fdp__header">
        <div className="fdp__header-top">
          <div>
            <h1 className="fdp__field-name">Field Activity</h1>
            <p className="fdp__field-meta">
              {scopeLabel
                ? `Zones & findings · ${scopeLabel}`
                : "Zones & findings"}
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "var(--surface-white)",
                border: "1px solid var(--border-light)",
                borderRadius: "50%",
                width: 30,
                height: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--text-muted)",
                flexShrink: 0,
                transition: "all 200ms cubic-bezier(.2,.8,.2,1)",
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "6px 16px 16px",
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "8px",
          alignContent: "start",
        }}
      >
        {content}
      </div>
    </div>
  );
}
