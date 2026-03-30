"use client";

import type {
  CellClickEvent,
  CellHoverEvent,
  FieldAgronomicSurfaceMetricKey,
  FieldBoundaryPreviewRenderModel,
} from "@fieldpulse/map";
import {
  describeCellAnomalyClass,
  describeCellAttentionLevel,
  describeCellSourceTier,
  formatCellPercentile,
  resolveCellAttentionLevel,
  resolveMetricModeContract,
} from "@fieldpulse/map";
import { useMemo } from "react";
import { Crosshair, X, ArrowLeft, AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { Card, Lbl, LblM, Big, Sub, Mono } from "../../components/panels/fieldDetailCardPrimitives";
import { PanelEmptyState } from "../../components/ui/PanelEmptyState";
import { useAppTheme } from "../../components/layout/WorkspaceShell";
import { buildFieldDetailModeData } from "../../components/panels/fieldDetailModeDataBuilder";
import {
  resolveRampAccent,
  resolveHeroRingColor,
  resolveSeverityAccent,
  SEV_COLORS_LIGHT,
  SEV_COLORS_DARK,
  resolveVitalSeverity,
  vitalValueColor,
} from "../../components/panels/fieldDetailColorSystem";
import { MODE_TO_METRIC_KEY, type ModeKey } from "../../components/panels/fieldDetailTypes";
import type { FieldCellInspectorModel } from "./CellInspectorModel";
import type { FieldSummaryProps } from "../../components/panels/SummaryTab";
import type { FieldReportProps } from "../../components/panels/ReportTab";
import type { FieldCropProps } from "../fields/tabs/CropTab";

/* ── Types ── */

type SelectedCellInspectorProps = {
  selection: CellClickEvent | CellHoverEvent | null;
  model: FieldCellInspectorModel | null;
  mapModel?: FieldBoundaryPreviewRenderModel | null;
  summary?: FieldSummaryProps | null;
  report?: FieldReportProps | null;
  crop?: FieldCropProps | null;
  fieldName?: string;
  focusedZoneId?: string | null;
  onZoneSelect?: (zoneId: string | null) => void;
  onClose?: () => void;
};

/* ── Helpers ── */

function metricToModeKey(metric: FieldAgronomicSurfaceMetricKey): ModeKey | null {
  const entry = Object.entries(MODE_TO_METRIC_KEY).find(([, mk]) => mk === metric);
  return (entry?.[0] as ModeKey | undefined) ?? null;
}

function humanCellName(cellId: string, cell: { rowIndex: number; columnIndex: number } | null): string {
  if (cell) return `R${cell.rowIndex + 1} · C${cell.columnIndex + 1}`;
  const parts = cellId.split(":");
  if (parts.length >= 4) {
    const row = parseInt(parts[parts.length - 2], 10);
    const col = parseInt(parts[parts.length - 1], 10);
    if (!Number.isNaN(row) && !Number.isNaN(col)) return `R${row + 1} · C${col + 1}`;
  }
  return cellId.length > 12 ? `${cellId.slice(0, 8)}…` : cellId;
}

function cellSubtitle(cellId: string): string {
  const parts = cellId.split(":");
  const sourceType = parts.length >= 3 ? parts[parts.length - 3] : null;
  if (sourceType === "raster") return "SAR-backed raster cell";
  if (sourceType === "cell") return "Moisture grid cell";
  return "Grid cell";
}

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

function describeSource(sel: CellClickEvent | CellHoverEvent): string {
  const base = describeCellSourceTier(sel.sourceTier, sel.metricKey);
  const isOpt = sel.metricKey === "ndvi" || sel.metricKey === "ndre" || sel.metricKey === "ndmi";
  const isOptSrc = sel.sourceTier === "sentinel-fresh" || sel.sourceTier === "sentinel-stale";
  if (isOpt && isOptSrc && sel.confidence <= 0.4) return "Preseason optical context";
  return base;
}

function sevColor(s: string | null, isDark: boolean): string {
  if (s === "critical" || s === "high" || s === "Localized Critical" || s === "danger") return isDark ? "rgba(252,165,165,0.85)" : "#dc2626";
  if (s === "medium" || s === "stressed" || s === "Localized Watch" || s === "warning") return isDark ? "rgba(252,211,77,0.85)" : "#d97706";
  if (s === "low" || s === "healthy" || s === "Field Typical" || s === "positive") return isDark ? "rgba(74,222,128,0.85)" : "#16a34a";
  return "var(--text-muted)";
}

function sevBg(s: string | null, isDark: boolean): string {
  if (s === "critical" || s === "high" || s === "Localized Critical" || s === "danger") return isDark ? "rgba(239,68,68,0.1)" : "#fef2f2";
  if (s === "medium" || s === "stressed" || s === "Localized Watch" || s === "warning") return isDark ? "rgba(245,158,11,0.1)" : "#fef3c7";
  if (s === "low" || s === "healthy" || s === "Field Typical" || s === "positive") return isDark ? "rgba(22,163,74,0.1)" : "#f0fdf4";
  return "var(--color-slate-50)";
}

/* ── HeroDonut ── */

function CellDonut({ value, color, size = 100 }: { value: number; color: string; size?: number }) {
  const sw = 4;
  const r = (size - sw) / 2;
  const ci = 2 * Math.PI * r;
  const safe = Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0;
  return (
    <svg width={size} height={size} style={{ display: "block", flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw} opacity={0.12} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={ci} strokeDashoffset={ci * (1 - safe)} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.4,0,.2,1)" }} />
      <text x={size / 2} y={size / 2 - 6} textAnchor="middle" dominantBaseline="central"
        style={{ fontFamily: "var(--font-heading)", fontSize: 24, fontWeight: 400, fill: "var(--text-primary)" }}>
        {(safe * 100).toFixed(0)}%
      </text>
      <text x={size / 2} y={size / 2 + 14} textAnchor="middle" dominantBaseline="central"
        style={{ fontFamily: "var(--font-body)", fontSize: 7, fontWeight: 700, fill: "var(--text-muted)", letterSpacing: "0.5px", textTransform: "uppercase" }}>
        {safe >= 0.01 ? "VALUE" : "—"}
      </text>
    </svg>
  );
}

/* ── Component ── */

export function SelectedCellInspector({
  selection,
  model,
  mapModel,
  summary,
  report,
  crop,
  fieldName,
  focusedZoneId = null,
  onZoneSelect,
  onClose,
}: SelectedCellInspectorProps) {
  const isDark = useAppTheme() === "dark";

  const cell = selection ? model?.cells.find((c) => c.id === selection.cellId) ?? null : null;
  const relatedFindings = selection ? (model?.findings ?? []).filter((f) => f.affectedCellKeys.includes(selection.cellId)) : [];
  const relatedZones = selection ? (model?.zones ?? []).filter((z) => z.affectedCellKeys.includes(selection.cellId)) : [];

  // Mode data — reuse the FieldDetailPanel's builder with cell as hoveredCell
  const modeData = useMemo(() => {
    if (!selection) return null;
    const mode = metricToModeKey(selection.metricKey) ?? "moisture";
    return buildFieldDetailModeData({
      mode,
      mapModel: mapModel ?? null,
      hoveredCell: selection,
      summary: summary ?? null,
      report: report ?? null,
      crop: crop ?? null,
      action: null,
      market: null,
    });
  }, [selection, mapModel, summary, report, crop]);

  // Colors
  const rampAccent = useMemo(() => {
    if (!selection || !modeData) return null;
    return resolveRampAccent(selection.metricKey, modeData.hero.v * 100, isDark);
  }, [selection, modeData, isDark]);

  const heroRingColor = useMemo(() => {
    if (!rampAccent || !modeData) return "var(--text-muted)";
    return resolveHeroRingColor(rampAccent.accent, modeData.hero.sev, isDark);
  }, [rampAccent, modeData, isDark]);

  const accentColor = useMemo(() => {
    if (!rampAccent || !modeData) return "var(--text-muted)";
    return resolveSeverityAccent(rampAccent.accent, modeData.hero.sev, isDark);
  }, [rampAccent, modeData, isDark]);

  const sevColors = isDark ? SEV_COLORS_DARK : SEV_COLORS_LIGHT;
  const sourceDesc = selection ? describeSource(selection) : null;
  const attentionLabel = selection ? describeCellAttentionLevel(resolveCellAttentionLevel({
    metricKey: selection.metricKey, severityLabel: selection.severityLabel,
    anomalyClass: selection.anomalyClass, deltaFromFieldAvgPct: selection.deltaFromFieldAvgPct,
    percentileInField: selection.percentileInField,
  })) : null;
  const contract = selection ? resolveMetricModeContract(selection.metricKey, selection.sourceTier) : null;

  return (
    <div className="fdp" style={{ position: "absolute", top: "var(--space-lg)", right: "var(--space-lg)", bottom: "var(--space-xl)" }}>
      {/* ── Header ── */}
      <div className="fdp__header">
        <div className="fdp__header-top">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {onClose && (
              <button type="button" onClick={onClose} style={{
                width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: "var(--surface-white)", border: "1px solid var(--border-light)", cursor: "pointer",
                color: "var(--text-muted)", flexShrink: 0, transition: "all 200ms cubic-bezier(.2,.8,.2,1)",
              }}><ArrowLeft size={14} /></button>
            )}
            <div>
              <h1 className="fdp__field-name">{selection ? `Cell ${humanCellName(selection.cellId, cell)}` : "Cell Inspector"}</h1>
              <p className="fdp__field-meta">
                {selection ? `${cellSubtitle(selection.cellId)} · ${contract?.label ?? selection.metricKey}` : "Tap a cell on the map"}
              </p>
            </div>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} style={{
              background: "var(--surface-white)", border: "1px solid var(--border-light)", borderRadius: "50%",
              width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "var(--text-muted)", flexShrink: 0,
            }}><X size={14} /></button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "6px 16px 16px",
        display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, alignContent: "start",
      }}>
        {!selection || !modeData ? (
          <div style={{ gridColumn: "1 / -1" }}>
            <PanelEmptyState icon={Crosshair} title="No spot selected"
              description="Tap any point on the map to inspect soil moisture, vegetation indices, and change history." />
          </div>
        ) : (
          <>
            {/* ── 1. Hero: Donut + Mode Context ── */}
            <Card span={-1} style={{ flexDirection: "row", gap: 20, alignItems: "center", padding: "16px 18px" }}>
              <CellDonut value={modeData.hero.v} color={heroRingColor} size={110} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <LblM>{contract?.label ?? "METRIC"}</LblM>
                <Big size={24} color={accentColor}>{modeData.hero.d}{modeData.hero.u}</Big>
                <span className="fdp-mono" style={{
                  fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                  textTransform: "uppercase", width: "fit-content",
                  background: sevBg(attentionLabel, isDark), color: sevColor(attentionLabel, isDark),
                }}>{attentionLabel ?? "Unknown"}</span>
                <Sub>{modeData.headline}</Sub>
              </div>
            </Card>

            {/* ── 2. Scout Action ── */}
            <Card span={-1} accent={sevColor(attentionLabel, isDark)} style={{ gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <Lbl color={sevColor(attentionLabel, isDark)}>SCOUT THIS CELL</Lbl>
                  <Sub>
                    {attentionLabel === "Localized Critical"
                      ? "Immediate field visit recommended — localized stress detected."
                      : attentionLabel === "Localized Watch"
                        ? "Monitor closely — this cell is diverging from the field average."
                        : "This cell is tracking with the field. No urgent action needed."}
                  </Sub>
                </div>
                {modeData.riskLevel && (
                  <span className="fdp-mono" style={{
                    fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                    textTransform: "uppercase", flexShrink: 0,
                    background: sevBg(modeData.hero.sev, isDark), color: sevColor(modeData.hero.sev, isDark),
                  }}>{modeData.riskLevel}</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" style={{
                  flex: 1, padding: "8px 12px", borderRadius: 8, border: "none",
                  background: "var(--btn-fill-primary)", color: "#fff",
                  fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700,
                  cursor: "pointer", transition: "all 150ms cubic-bezier(.2,.8,.2,1)",
                  boxShadow: "0 2px 0 var(--color-forest-950)",
                }}>Start Scout Report</button>
                <button type="button" style={{
                  padding: "8px 12px", borderRadius: 8,
                  border: "1px solid var(--border-light)", background: "transparent",
                  fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 600,
                  color: "var(--text-secondary)", cursor: "pointer",
                }}>Copy GPS</button>
              </div>
            </Card>

            {/* ── 3. Vitals from mode data ── */}
            <div className="fdp__vitals-grid" style={{ gridTemplateColumns: `repeat(${Math.min(modeData.vitals.length + 1, 4)}, 1fr)` }}>
              {modeData.vitals.map((vital, i) => {
                const vColor = vitalValueColor(vital, rampAccent?.accent ?? "var(--text-muted)", isDark);
                const isNum = typeof vital.value === "string" && /^[−\-+]?\d/.test(vital.value);
                return (
                  <Card key={i}>
                    <LblM>{vital.label}</LblM>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {vital.icon === "down" && <TrendingDown size={12} style={{ color: vColor }} />}
                      {vital.icon === "up" && <TrendingUp size={12} style={{ color: vColor }} />}
                      {isNum
                        ? <Big size={20} color={vColor}>{vital.value}</Big>
                        : <span style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: vColor ?? "var(--text-primary)" }}>{vital.value}</span>
                      }
                    </div>
                  </Card>
                );
              })}
              <Card>
                <LblM>Confidence</LblM>
                <Big size={20}>{Math.round(selection.confidence * 100)}%</Big>
              </Card>
            </div>

            {/* ── 4. Moisture (if available) ── */}
            {cell && (
              <div className="fdp__vitals-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                <Card>
                  <LblM>Root Zone</LblM>
                  <Big size={22} color={cell.rootZonePct < 30 ? sevColor("danger", isDark) : cell.rootZonePct < 45 ? sevColor("warning", isDark) : sevColor("positive", isDark)}>
                    {cell.rootZonePct.toFixed(1)}%
                  </Big>
                </Card>
                <Card>
                  <LblM>Surface</LblM>
                  <Big size={22} color={cell.surfacePct < 15 ? sevColor("warning", isDark) : undefined}>
                    {cell.surfacePct.toFixed(1)}%
                  </Big>
                </Card>
              </div>
            )}

            {/* ── 5. Cell Analytics (fixed: Sub for text, Mono only for numbers) ── */}
            <Card span={-1}>
              <LblM>CELL ANALYTICS</LblM>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { k: "Grid position", v: cell ? `Row ${cell.rowIndex + 1}, Col ${cell.columnIndex + 1}` : humanCellName(selection.cellId, null), numeric: false },
                  { k: "Percentile", v: formatCellPercentile(selection.percentileInField), numeric: true },
                  { k: "Delta vs avg", v: `${selection.deltaFromFieldAvgPct > 0 ? "+" : ""}${selection.deltaFromFieldAvgPct.toFixed(1)}%`, numeric: true },
                  { k: "Anomaly", v: describeCellAnomalyClass(selection.anomalyClass), numeric: false },
                  { k: "Variance", v: selection.varianceBucket, numeric: false },
                  { k: "Source", v: sourceDesc ?? "—", numeric: false },
                  { k: "Observed", v: cell ? fmtTime(cell.observedAt) : "—", numeric: false },
                ].map((d) => (
                  <div key={d.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Sub>{d.k}</Sub>
                    {d.numeric
                      ? <Mono>{d.v}</Mono>
                      : <span style={{ fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>{d.v}</span>
                    }
                  </div>
                ))}
              </div>
            </Card>

            {/* ── 6. Spatial Distribution ── */}
            {modeData.spatialColumns.length === 3 && (
              <>
                <div style={{ gridColumn: "1 / -1" }}><LblM>FIELD DISTRIBUTION</LblM></div>
                <div className="fdp__vitals-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                  {modeData.spatialColumns.map((col, i) => (
                    <Card key={i}>
                      <LblM>{col.label}</LblM>
                      <Big size={18} color={i === 1 ? accentColor : undefined}>{col.value}</Big>
                    </Card>
                  ))}
                </div>
                {modeData.spatialProgressPct > 0 && (
                  <Card span={-1}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <Sub>This cell&apos;s position in field</Sub>
                      <Mono>{formatCellPercentile(selection.percentileInField)}</Mono>
                    </div>
                    <div className="fdp-prog" style={{ height: 4, background: `${accentColor}18` }}>
                      <div className="fdp-prog__fill" style={{ width: `${Math.min(selection.percentileInField, 100)}%`, background: accentColor }} />
                    </div>
                  </Card>
                )}
              </>
            )}

            {/* ── 7. Field Context ── */}
            {modeData.interpretation && (
              <Card span={-1}>
                <LblM>FIELD CONTEXT</LblM>
                <Sub>{modeData.interpretation}</Sub>
              </Card>
            )}

            {/* ── Linked Findings ── */}
            {relatedFindings.length > 0 && (
              <>
                <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <LblM>LINKED FINDINGS</LblM>
                  <Mono>{relatedFindings.length} findings</Mono>
                </div>
                {relatedFindings.map((f) => {
                  const fc = sevColor(f.severity, isDark);
                  return (
                    <Card key={f.id} span={-1} accent={fc} onClick={() => onZoneSelect?.(f.trackedZoneIds[0] ?? null)}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <AlertTriangle size={14} style={{ color: fc, flexShrink: 0, marginTop: 2 }} />
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                          <span className="fdp-big fdp-big--14">{f.title}</span>
                          <Sub>{f.summary ?? f.family.replace(/_/g, " ")}</Sub>
                        </div>
                        <span className="fdp-mono" style={{
                          fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                          textTransform: "uppercase", flexShrink: 0,
                          background: sevBg(f.severity, isDark), color: fc,
                        }}>{f.severity}</span>
                      </div>
                      {f.recommendedAction && <Sub>{f.recommendedAction}</Sub>}
                      <Mono>{fmtTime(f.startedAt)}</Mono>
                    </Card>
                  );
                })}
              </>
            )}

            {relatedFindings.length === 0 && (
              <Card span={-1} className="fdp-card--muted"><Sub>No active findings reference this cell.</Sub></Card>
            )}

            {/* ── Tracked Zones ── */}
            {relatedZones.length > 0 && (
              <>
                <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <LblM>TRACKED ZONES</LblM>
                  <Mono>{relatedZones.length} zones</Mono>
                </div>
                {relatedZones.map((z) => {
                  const zc = sevColor(z.latestSeverity, isDark);
                  const focused = focusedZoneId === z.id;
                  return (
                    <Card key={z.id} span={-1} accent={zc}
                      onClick={() => onZoneSelect?.(focused ? null : z.id)}
                      style={focused ? { boxShadow: `inset 0 0 0 1px ${zc}` } : undefined}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span className="fdp-big fdp-big--14">{z.family.replace(/_/g, " ")}</span>
                          <Sub>{z.trackingKey} · {z.detectionCount} detections</Sub>
                        </div>
                        <span className="fdp-mono" style={{
                          fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                          textTransform: "uppercase", flexShrink: 0,
                          background: sevBg(z.latestSeverity, isDark), color: zc,
                        }}>{z.status}</span>
                      </div>
                      <div className="fdp__zone-metrics">
                        <div><span className="fdp__zone-metric-label">Severity</span><Mono color={zc}>{z.latestSeverity ?? "—"}</Mono></div>
                        <div><span className="fdp__zone-metric-label">Cells</span><Mono>{z.affectedCellKeys.length}</Mono></div>
                        <div><span className="fdp__zone-metric-label">Last seen</span><Mono>{fmtTime(z.lastSeenAt)}</Mono></div>
                      </div>
                    </Card>
                  );
                })}
              </>
            )}

            {relatedZones.length === 0 && (
              <Card span={-1} className="fdp-card--muted"><Sub>This cell is not part of a tracked zone.</Sub></Card>
            )}

            {/* ── Footer ── */}
            <div style={{ gridColumn: "1 / -1", textAlign: "center", paddingTop: 8, borderTop: "1px solid var(--border-light)", fontSize: 8, color: "var(--text-tertiary)" }}>
              {sourceDesc} · Confidence {Math.round(selection.confidence * 100)}% · {fieldName ?? "Field"}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
