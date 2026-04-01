/**
 * Zones subpage for FieldDetailPanel.
 *
 * Extracted from SubPageView — pure render, no local state.
 * Receives all zone-derived values as props from the parent.
 */

import type { CellHoverEvent } from "@fieldpulse/map";
import type { ReportAlertItem, ReportFindingItem, ReportZoneItem } from "./ReportTab";
import type { FieldActivityZoneItem, FieldActivityFamilySummary } from "../../features/fields/FieldActivityPanelModel";
import { Card, Lbl, LblM, Big, Sub, Mono } from "./fieldDetailCardPrimitives";

/** Format an ISO timestamp into a short human-readable string, e.g. "30 Mar, 4:52 pm". */
function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
      + ", "
      + d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
  } catch {
    return "—";
  }
}

export function ZonesSubPage({
  reportZones,
  reportFindings,
  trackedZoneCount,
  healthyZoneCount,
  stressedZoneCount,
  criticalZoneCount,
  affectedCellTotal,
  focusedZone,
  focusedActivityZone,
  focusedFamilySummary,
  focusedZoneFindings,
  focusedZoneAlerts,
  trackedPocketPct,
  outsideZonePct,
  selectedZoneId,
  onSelectZoneId,
  hoveredCell,
  updatedDate,
  statusColor,
  statusBg,
}: {
  reportZones: readonly ReportZoneItem[];
  reportFindings: readonly ReportFindingItem[];
  trackedZoneCount: number;
  healthyZoneCount: number;
  stressedZoneCount: number;
  criticalZoneCount: number;
  affectedCellTotal: number;
  focusedZone: ReportZoneItem | null;
  focusedActivityZone: FieldActivityZoneItem | null;
  focusedFamilySummary: FieldActivityFamilySummary | null;
  focusedZoneFindings: readonly ReportFindingItem[];
  focusedZoneAlerts: readonly ReportAlertItem[];
  trackedPocketPct: number | null;
  outsideZonePct: number | null;
  selectedZoneId: string | null;
  onSelectZoneId: (zoneId: string | null) => void;
  hoveredCell?: CellHoverEvent | null;
  updatedDate: string | null;
  statusColor: (s: string) => string;
  statusBg: (s: string) => string;
}) {
  return (
    <>
      <div className="fdp__vitals-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <Card><LblM>Total Zones</LblM><Big size={24}>{trackedZoneCount}</Big></Card>
        <Card><LblM>Healthy</LblM><Big size={24} color="#16a34a">{healthyZoneCount}</Big></Card>
        <Card><LblM>Stressed</LblM><Big size={24} color="#f59e0b">{stressedZoneCount}</Big></Card>
        <Card><LblM>Critical</LblM><Big size={24} color="#ef4444">{criticalZoneCount}</Big></Card>
      </div>
      <Card span={-1}>
        <LblM>Affected Cells</LblM>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <Big size={22}>{affectedCellTotal}</Big><Sub>total across {trackedZoneCount} zones</Sub>
        </div>
      </Card>
      {focusedZone ? (
        <>
          <Card span={-1} accent={statusColor(focusedZone.status)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <Lbl color={statusColor(focusedZone.status)}>Focused Zone</Lbl>
                <div style={{ marginTop: 4 }}>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                    {focusedZone.family.replace(/_/g, " ")}
                  </span>
                  <div><Sub>{focusedZone.trackingKey}</Sub></div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <span className="fdp-mono" style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 999, textTransform: "uppercase", background: statusBg(focusedZone.status), color: statusColor(focusedZone.status) }}>
                  {focusedZone.status}
                </span>
                {selectedZoneId ? (
                  <button
                    type="button"
                    onClick={() => onSelectZoneId(null)}
                    style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
                  >
                    <Sub>Clear pin</Sub>
                  </button>
                ) : hoveredCell?.zoneId === focusedZone.id ? (
                  <Sub>Following hovered cell</Sub>
                ) : null}
              </div>
            </div>
            <Sub>
              {hoveredCell?.zoneId === focusedZone.id
                ? "Current hovered cell is linked to this tracked zone."
                : selectedZoneId === focusedZone.id
                  ? "Pinned from the zones list."
                  : "Using the highest-priority tracked zone as current context."}
            </Sub>
          </Card>
          <div className="fdp__vitals-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            <Card><LblM>Severity</LblM><Big size={20} color={statusColor(focusedZone.status)}>{focusedZone.severity ?? "—"}</Big></Card>
            <Card><LblM>Detections</LblM><Big size={20}>{focusedActivityZone?.detectionCount ?? "—"}</Big></Card>
            <Card><LblM>Findings</LblM><Big size={20}>{focusedZoneFindings.length}</Big></Card>
            <Card><LblM>Alerts</LblM><Big size={20}>{focusedZoneAlerts.length}</Big></Card>
          </div>
          <Card span={-1}>
            <LblM>Focused Zone Evidence</LblM>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { k: "Affected cells", v: String(focusedZone.affectedCellCount) },
                { k: "Last seen", v: formatShortDate(focusedZone.lastSeenAt) },
                { k: "Findings", v: focusedZoneFindings.length > 0 ? focusedZoneFindings.map((finding) => finding.title).join(" · ") : "None" },
                { k: "Alerts", v: focusedZoneAlerts.length > 0 ? `${focusedZoneAlerts.length} active` : "None" },
                { k: "Related zones", v: focusedFamilySummary ? `${focusedFamilySummary.activeZoneCount} of ${focusedFamilySummary.totalZoneCount} active` : "—" },
              ].map((detail, index) => (
                <div key={index} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <Sub>{detail.k}</Sub>
                  <Mono>{detail.v}</Mono>
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : null}
      {reportZones.map((z, i) => (
        <Card
          key={i}
          span={-1}
          accent={statusColor(z.status)}
          onClick={() => onSelectZoneId(selectedZoneId === z.id ? null : z.id)}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <span style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{z.family.replace(/_/g, " ")}</span>
              <div><Sub>{z.trackingKey}</Sub></div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {selectedZoneId === z.id ? <Sub>Pinned</Sub> : null}
              <span className="fdp-mono" style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 999, textTransform: "uppercase", background: statusBg(z.status), color: statusColor(z.status) }}>{z.status}</span>
            </div>
          </div>
          <div className="fdp__zone-metrics">
            <div>
              <span className="fdp__zone-metric-label">Severity</span>
              <div><Mono color={z.severity ? statusColor(z.status) : undefined}>{z.severity ?? "—"}</Mono></div>
            </div>
            <div>
              <span className="fdp__zone-metric-label">Cells</span>
              <div><Mono color={z.status !== "healthy" ? statusColor(z.status) : undefined}>{z.affectedCellCount}</Mono></div>
            </div>
            <div>
              <span className="fdp__zone-metric-label">Seen</span>
              <div><Mono color={z.status !== "healthy" ? statusColor(z.status) : undefined}>{z.lastSeenAt}</Mono></div>
            </div>
          </div>
          {hoveredCell?.zoneId === z.id && (
            <div style={{ padding: "6px 10px", borderRadius: 8, background: statusBg(z.status) }}>
              <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: statusColor(z.status), lineHeight: 1.5 }}>
                Hovered cell is linked to this tracked zone.
              </span>
            </div>
          )}
          {focusedZone?.id === z.id && focusedZoneFindings.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {focusedZoneFindings.slice(0, 3).map((finding) => (
                <span
                  key={finding.id}
                  className="fdp-mono"
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: finding.severity === "High" ? "rgba(239,68,68,0.12)" : finding.severity === "Med" ? "rgba(245,158,11,0.12)" : "rgba(22,163,74,0.12)",
                    color: finding.severity === "High" ? "#ef4444" : finding.severity === "Med" ? "#f59e0b" : "#16a34a",
                  }}
                >
                  {finding.title}
                </span>
              ))}
            </div>
          ) : null}
        </Card>
      ))}
      {reportZones.length === 0 ? (
        <Card span={-1}>
          <LblM>Tracked Zones</LblM>
          <Sub>No tracked zones are active for this field right now.</Sub>
        </Card>
      ) : null}
      <Card span={-1}>
        <LblM>Zone Summary</LblM>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { k: "Families", v: Array.from(new Set(reportZones.map((zone) => zone.family.replace(/_/g, " ")))).join(" · ") || "—" },
            { k: "In-zone stress", v: trackedPocketPct != null ? `${Math.round(trackedPocketPct)}%` : "—" },
            { k: "Outside zones", v: outsideZonePct != null ? `${Math.round(outsideZonePct)}%` : "—" },
            { k: "Focus", v: focusedZone ? focusedZone.trackingKey : "None" },
            { k: "Affected cells", v: String(affectedCellTotal) },
            { k: "Top finding", v: reportFindings[0]?.title ?? "None" },
            { k: "Last observed", v: formatShortDate(reportZones[0]?.lastSeenAt ?? updatedDate) },
          ].map((d, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
              <Sub>{d.k}</Sub>
              <Mono>{d.v}</Mono>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
