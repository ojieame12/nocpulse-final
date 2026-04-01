/**
 * Report subpage for FieldDetailPanel. Extracted from SubPageView — pure render, no local state.
 */

import React from "react";
import {
  CloudRain, Cloud, Sun, Thermometer, Leaf, Droplets,
  Wind, TriangleAlert, Waves, Gauge, Snowflake, CloudDrizzle, CloudHail,
  type LucideIcon,
} from "lucide-react";
import { Card, AlertCard, Lbl, LblM, Big, Sub } from "./fieldDetailCardPrimitives";

/* ── Icon map for reading cards ── */

const READING_ICONS: Record<string, { Icon: LucideIcon; color: string }> = {
  "temperature":    { Icon: Thermometer,   color: "#ef4444" },
  "soil-moisture":  { Icon: Droplets,      color: "#0ea5e9" },
  "root-moisture":  { Icon: Droplets,      color: "#3b82f6" },
  "wind":           { Icon: Wind,          color: "#6b7280" },
  "ndvi":           { Icon: Leaf,          color: "#16a34a" },
  "ndre":           { Icon: Leaf,          color: "#14b8a6" },
  "ndmi":           { Icon: Droplets,      color: "#0ea5e9" },
  "radar-wetness":  { Icon: Waves,         color: "#06b6d4" },
  "stress-area":    { Icon: TriangleAlert, color: "#f59e0b" },
};

const READING_ICON_FALLBACK = { Icon: Gauge, color: "var(--text-muted)" };

/* ── Icon map for crop parameter rows ── */

const CROP_PARAM_ICONS: Record<string, { Icon: LucideIcon; color: string }> = {
  "root moisture":     { Icon: Droplets,      color: "#3b82f6" },
  "surface moisture":  { Icon: Droplets,      color: "#0ea5e9" },
  "frost min":         { Icon: Snowflake,     color: "#818cf8" },
  "water balance 72h": { Icon: CloudDrizzle,  color: "#06b6d4" },
  "water balance":     { Icon: CloudDrizzle,  color: "#06b6d4" },
  "ndvi":              { Icon: Leaf,          color: "#16a34a" },
  "temperature":       { Icon: Thermometer,   color: "#ef4444" },
  "wind":              { Icon: Wind,          color: "#6b7280" },
};
import { LineSpark, MultiLineSpark, ProgBar } from "./fieldDetailVisualizations";
import {
  parseNumericValue,
  findLatestReportChartPointValue,
} from "./fieldDetailHelpers";
import type { FieldReportProps } from "./ReportTab";
import type { FieldSummaryProps } from "./SummaryTab";
import type { FieldCropProps } from "../../features/fields/tabs/CropTab";
import type { DetailPanelModeData } from "./fieldDetailTypes";
import type { FieldNotesInspectionTarget } from "./NotesTab";

interface ReportSubPageProps {
  ac: string;
  report: FieldReportProps | null;
  summary: FieldSummaryProps | null;
  crop: FieldCropProps | null;
  mc: DetailPanelModeData;
  contextOnlyOptical: boolean;
  contextTone: string;
  contextToneSoft: string;
  hoveredAttentionLevel: string | null;
  reportStatusTitle: string;
  reportStatusSub: string;
  reportReadings: readonly { iconKey?: string; label: string; value: string; valueColor?: string; color?: string }[];
  reportForecast: readonly { day: string; temp: string; precip: string }[];
  reportAlerts: readonly {
    iconKey: string;
    severity: string;
    text: string;
    trackedZoneIds: readonly string[];
    detail?: string | null;
  }[];
  vegetationChart: any;
  moistureHistoryChart: any;
  temperatureChart: any;
  vegetationRange: { start: string; end: string };
  moistureHistoryRange: { start: string; end: string };
  temperatureRange: { start: string; end: string };
  focusedZone: any;
  focusedZoneJumpHint: string | null;
  handleOpenFocusedZone: () => void;
  contextualNotesTarget: FieldNotesInspectionTarget | null;
  handleOpenContextNotes: () => void;
  statusColor: (status: string) => string;
}

function getChartSeriesValues(
  chart: FieldReportProps["charts"][number] | null,
) {
  return (chart?.series ?? [])
    .map((series) => ({
      color: series.color,
      label: series.label,
      format: series.format,
      values: series.points
        .map((point) => point.value)
        .filter((value): value is number => value != null && Number.isFinite(value)),
    }))
    .filter((series) => series.values.length > 0);
}

function chartHasTrend(chart: FieldReportProps["charts"][number] | null) {
  return (chart?.series ?? []).some((series) => {
    const finiteCount = series.points.filter(
      (point) => point.value != null && Number.isFinite(point.value),
    ).length;
    return finiteCount > 1;
  });
}

function formatChartLatestValue(
  chart: FieldReportProps["charts"][number] | null,
  seriesIndex: number,
) {
  const value = findLatestReportChartPointValue(chart, seriesIndex);
  if (value == null) {
    return "—";
  }

  const format = chart?.series[seriesIndex]?.format;
  if (format === "percent") {
    return `${value.toFixed(1)}%`;
  }
  if (format === "temperature") {
    return `${value.toFixed(1)}°C`;
  }
  if (format === "millimetres") {
    return `${value.toFixed(1)} mm`;
  }

  return value.toFixed(2);
}

export function ReportSubPage({
  ac,
  report,
  summary,
  crop,
  mc,
  contextOnlyOptical,
  contextTone,
  contextToneSoft,
  hoveredAttentionLevel,
  reportStatusTitle,
  reportStatusSub,
  reportReadings,
  reportForecast,
  reportAlerts,
  vegetationChart,
  moistureHistoryChart,
  temperatureChart,
  vegetationRange,
  moistureHistoryRange,
  temperatureRange,
  focusedZone,
  focusedZoneJumpHint,
  handleOpenFocusedZone,
  contextualNotesTarget,
  handleOpenContextNotes,
  statusColor,
}: ReportSubPageProps) {
  const reportFindings = report?.findings ?? [];
  const reportZones = report?.zones ?? [];
  const vegetationSeries = getChartSeriesValues(vegetationChart);
  const vegetationHasTrend = chartHasTrend(vegetationChart);
  const moistureSeries = getChartSeriesValues(moistureHistoryChart);
  const moistureHasTrend = chartHasTrend(moistureHistoryChart);
  const temperatureSeries = getChartSeriesValues(temperatureChart);
  const temperatureHasTrend = chartHasTrend(temperatureChart);
  const alertSeverityColor = (severity: string) =>
    severity === "High" ? "#ef4444" : severity === "Med" ? "#f59e0b" : "#16a34a";

  return (
    <>
      <Card span={-1} accent={ac}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Lbl color={ac}>Field Report</Lbl>
          <span className="fdp-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
            {report?.updatedDate ?? summary?.updatedLabel ?? "Update unavailable"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background:
                contextOnlyOptical
                  ? contextToneSoft
                  : hoveredAttentionLevel === "critical" || hoveredAttentionLevel === "watch"
                    ? "rgba(245,158,11,0.10)"
                    : "rgba(22,163,74,0.10)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background:
                  contextOnlyOptical
                    ? contextTone
                    : hoveredAttentionLevel === "critical"
                      ? "#ef4444"
                      : hoveredAttentionLevel === "watch"
                        ? "#f59e0b"
                        : "#16a34a",
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 15,
                fontWeight: 700,
                color: "var(--text-primary)",
                letterSpacing: "-0.01em",
              }}
            >
              {reportStatusTitle}
            </span>
            <Sub>{reportStatusSub}</Sub>
          </div>
        </div>
      </Card>
      {(reportReadings.length > 0
        ? reportReadings
        : [
            { label: "Soil moisture", value: summary?.rootMoisture ?? "—", color: ac },
            { label: "Trend (7d)", value: summary?.trend ?? "—", color: "#f59e0b" },
            {
              label: "Field variation",
              value: summary?.spread ?? "—",
              color: "var(--text-primary)",
            },
            {
              label: "Confidence",
              value: summary?.confidence ?? "—",
              color: "var(--text-primary)",
            },
          ].map((reading, index) => ({
            label: reading.label,
            value: reading.value,
            color: reading.color,
            key: index,
          }))
      ).map((r, i) => {
        const iconKey = "iconKey" in r ? (r as { iconKey?: string }).iconKey : undefined;
        const iconInfo = iconKey ? (READING_ICONS[iconKey] ?? READING_ICON_FALLBACK) : READING_ICON_FALLBACK;
        const valColor =
          "valueColor" in r
            ? r.valueColor
            : "color" in r
              ? (r as { color: string }).color
              : ac;
        return (
          <Card key={i} data-metric-hint={iconKey ?? r.label.toLowerCase()} data-metric-value={r.value}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <iconInfo.Icon size={11} color={iconInfo.color} strokeWidth={2.2} />
              <LblM>{r.label}</LblM>
            </div>
            <Big size={22} color={valColor}>{r.value}</Big>
          </Card>
        );
      })}
      <Card span={-1}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Lbl color={ac}>Crop Parameter Assessment</Lbl>
          <span className="fdp-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
            {report?.cropStage ?? crop?.thresholdStageLabel ?? "Stage unavailable"}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(report?.cropParams ?? []).slice(0, 4).map((p, i) => {
            const paramIcon = CROP_PARAM_ICONS[p.label.toLowerCase()] ?? { Icon: Gauge, color: "var(--text-muted)" };
            return (
              <div key={i}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <paramIcon.Icon size={13} color={paramIcon.color} strokeWidth={2} />
                    <span
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--text-body)",
                      }}
                    >
                      {p.label}
                    </span>
                  </div>
                  <span className="fdp-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    {p.rangeLow}–{p.rangeHigh}
                  </span>
                </div>
                <ProgBar value={p.fillPercent} color={ac} height={4} />
              </div>
            );
          })}
          {(report?.cropParams ?? []).length === 0 ? (
            <Sub>No crop assessment is available for this field yet.</Sub>
          ) : null}
        </div>
      </Card>
      <Card span={-1}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Lbl color={ac}>{vegetationChart?.title ?? mc.trendLabel}</Lbl>
          {contextOnlyOptical ? (
            <span
              className="fdp-mono"
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
                background: contextToneSoft,
                color: contextTone,
                textTransform: "uppercase",
              }}
            >
              Context only
            </span>
          ) : null}
        </div>
        {vegetationChart ? (
          vegetationHasTrend ? (
            <MultiLineSpark
              series={vegetationSeries.map((series) => ({
                data: series.values,
                color: series.color,
              }))}
              height={56}
            />
          ) : (
            <div style={{ height: 56 }} />
          )
        ) : (
          <LineSpark
            data={mc.spark}
            color={contextOnlyOptical ? contextTone : ac}
            height={56}
          />
        )}
        {vegetationChart?.emptyText && !vegetationHasTrend ? (
          <Sub>{vegetationChart.emptyText}</Sub>
        ) : null}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Sub>{vegetationChart ? vegetationRange.start : mc.spatialColumns[0].label}</Sub>
          <Sub>
            {vegetationChart
              ? [
                  vegetationChart.subtitle,
                  `NDVI ${vegetationChart.series[0] ? findLatestReportChartPointValue(vegetationChart, 0)?.toFixed(2) ?? "—" : "—"}`,
                  vegetationChart.series[1]
                    ? `NDRE ${findLatestReportChartPointValue(vegetationChart, 1)?.toFixed(2) ?? "—"}`
                    : null,
                  contextOnlyOptical ? "Informational only" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : mc.trendMeta}
          </Sub>
        </div>
      </Card>
      <Card span={-1}>
        <Lbl color={ac}>
          {moistureHistoryChart?.title ?? "Spread Snapshot"}
        </Lbl>
        {moistureHistoryChart ? (
          moistureHasTrend ? (
            <MultiLineSpark
              series={moistureSeries.map((series) => ({
                data: series.values,
                color: series.color,
              }))}
              height={48}
            />
          ) : (
            <div style={{ height: 48 }} />
          )
        ) : (
          <LineSpark
            data={[
              parseNumericValue(mc.spatialColumns[0].value) ?? 0,
              parseNumericValue(mc.spatialColumns[1].value) ?? 0,
              parseNumericValue(mc.spatialColumns[2].value) ?? 0,
            ]}
            color={ac}
            height={48}
          />
        )}
        {moistureHistoryChart?.emptyText && !moistureHasTrend ? (
          <Sub>{moistureHistoryChart.emptyText}</Sub>
        ) : null}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Sub>
            {moistureHistoryChart ? moistureHistoryRange.start : mc.spatialColumns[0].value}
          </Sub>
          <Sub>
            {moistureHistoryChart
              ? [
                  `Root ${moistureHistoryChart.series[0] ? findLatestReportChartPointValue(moistureHistoryChart, 0)?.toFixed(1) ?? "—" : "—"}%`,
                  moistureHistoryChart.series[1]
                    ? `Surface ${findLatestReportChartPointValue(moistureHistoryChart, 1)?.toFixed(1) ?? "—"}%`
                    : null,
                  moistureHistoryChart.series[2]
                    ? `${moistureHistoryChart.series[2].label} ${formatChartLatestValue(moistureHistoryChart, 2)}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : mc.spatialColumns[2].value}
          </Sub>
        </div>
      </Card>
      <Card span={-1}>
        <LblM>{temperatureChart?.title ?? "Temperature Snapshot"}</LblM>
        {temperatureChart ? (
          temperatureHasTrend ? (
            <MultiLineSpark
              series={temperatureSeries.map((series) => ({
                data: series.values,
                color: series.color,
              }))}
              height={48}
            />
          ) : (
            <div style={{ height: 48 }} />
          )
        ) : (
          <LineSpark
            data={
              reportForecast.length > 0
                ? reportForecast.map((day) => parseNumericValue(day.temp) ?? 0)
                : [0]
            }
            color={ac}
            height={48}
          />
        )}
        {temperatureChart?.emptyText && !temperatureHasTrend ? (
          <Sub>{temperatureChart.emptyText}</Sub>
        ) : null}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Sub>
            {temperatureChart ? temperatureRange.start : reportForecast[0]?.day ?? "Now"}
          </Sub>
          <Sub>
            {temperatureChart
              ? [
                  temperatureChart.subtitle,
                  `High ${formatChartLatestValue(temperatureChart, 0)}`,
                  temperatureChart.series[1]
                    ? `Low ${formatChartLatestValue(temperatureChart, 1)}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : reportForecast.at(-1)?.day ?? "Later"}
          </Sub>
        </div>
      </Card>
      <Card span={-1}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <LblM>7-Day Outlook</LblM>
          <Sub>Precipitation %</Sub>
        </div>
        <div className="fdp__forecast-strip">
          {(reportForecast.length > 0 ? reportForecast : []).map((f, i) => {
            const precipPct = parseNumericValue(f.precip) ?? 0;
            const tempValue = parseNumericValue(f.temp) ?? 0;
            const Icon =
              precipPct >= 40 ? CloudRain : precipPct >= 20 ? Cloud : Sun;
            const iconColor =
              precipPct >= 40 ? "#3b82f6" : precipPct >= 20 ? "#94a3b8" : "#f59e0b";
            return (
              <div key={i} className="fdp__forecast-day">
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
                  {f.day}
                </span>
                <Icon size={16} color={iconColor} strokeWidth={1.8} />
                <span
                  className="fdp-mono"
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  {f.temp}
                </span>
                <span
                  className="fdp-mono"
                  style={{ fontSize: 9, color: "var(--text-muted)" }}
                >
                  {f.precip}
                </span>
                <div style={{ width: "80%", marginTop: 2 }}>
                  <ProgBar value={precipPct} color="#3b82f6" height={3} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      {reportAlerts.length === 0 && report?.alertsEmptyStateTitle ? (
        <Card span={-1}>
          <LblM>{report.alertsEmptyStateTitle}</LblM>
          <Sub>{report.alertsEmptyStateDescription ?? "Alert coverage is unavailable for this report window."}</Sub>
        </Card>
      ) : null}
      {reportAlerts.map((alert, index) => (
        <AlertCard
          key={index}
          sev={alert.severity === "High" ? "danger" : "warning"}
          span={-1}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background:
                  alert.severity === "High"
                    ? "rgba(239,68,68,0.10)"
                    : "rgba(245,158,11,0.10)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              {alert.iconKey === "temperature" ? (
                <Thermometer
                  size={14}
                  color={alert.severity === "High" ? "#ef4444" : "#f59e0b"}
                />
              ) : alert.iconKey === "leaf" ? (
                <Leaf
                  size={14}
                  color={alert.severity === "High" ? "#ef4444" : "#f59e0b"}
                />
              ) : alert.iconKey === "hail" ? (
                <CloudHail
                  size={14}
                  color={alert.severity === "High" ? "#ef4444" : "#818cf8"}
                />
              ) : (
                <Droplets
                  size={14}
                  color={alert.severity === "High" ? "#ef4444" : "#f59e0b"}
                />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  {alert.text}
                </span>
                <span
                  className="fdp-mono"
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background:
                      alert.severity === "High"
                        ? "rgba(239,68,68,0.10)"
                        : "rgba(245,158,11,0.10)",
                    color:
                      alert.severity === "High" ? "#ef4444" : "#f59e0b",
                    flexShrink: 0,
                  }}
                >
                  {alert.severity}
                </span>
              </div>
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 11,
                  color: "var(--text-muted)",
                  marginTop: 2,
                  display: "block",
                }}
              >
                {alert.trackedZoneIds.length > 0
                  ? `${alert.trackedZoneIds.length} tracked zone(s) linked`
                  : "Field-wide signal"}
              </span>
              {alert.detail ? (
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--color-slate-500)",
                    marginTop: 2,
                    display: "block",
                    letterSpacing: "0.01em",
                  }}
                >
                  {alert.detail}
                </span>
              ) : null}
            </div>
          </div>
        </AlertCard>
      ))}
      <Card span={-1}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <Lbl color={ac}>Findings</Lbl>
          <span className="fdp-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
            {reportFindings.length} total
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
          {reportFindings.length > 0 ? (
            reportFindings.map((finding) => (
              <div
                key={finding.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--panel-border)",
                  background: "var(--panel-elevated)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                    {finding.title}
                  </div>
                  <Sub>{finding.summary ?? "No summary available."}</Sub>
                  <Sub>
                    {finding.trackedZoneIds.length > 0
                      ? `${finding.trackedZoneIds.length} tracked zone(s) linked`
                      : "Field-wide finding"}
                  </Sub>
                </div>
                <span
                  className="fdp-mono"
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: alertSeverityColor(finding.severity),
                    flexShrink: 0,
                    textTransform: "uppercase",
                  }}
                >
                  {finding.severity}
                </span>
              </div>
            ))
          ) : (
            <Sub>No active findings are attached to this report.</Sub>
          )}
        </div>
      </Card>
      <Card span={-1}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <Lbl color={ac}>Tracked Zones</Lbl>
          <span className="fdp-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
            {reportZones.length} mapped
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
          {reportZones.length > 0 ? (
            reportZones.map((zone) => (
              <div
                key={zone.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--panel-border)",
                  background: "var(--panel-elevated)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                    {zone.trackingKey}
                  </div>
                  <Sub>
                    {[zone.family, `${zone.affectedCellCount} affected cells`].filter(Boolean).join(" · ")}
                  </Sub>
                  <Sub>{`Last seen ${zone.lastSeenAt}`}</Sub>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                  <span
                    className="fdp-mono"
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: statusColor(zone.status),
                      textTransform: "uppercase",
                    }}
                  >
                    {zone.status}
                  </span>
                  {zone.severity ? (
                    <span className="fdp-mono" style={{ fontSize: 9, color: alertSeverityColor(zone.severity) }}>
                      {zone.severity}
                    </span>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <Sub>No tracked zones are attached to this report.</Sub>
          )}
        </div>
      </Card>
      <Card span={-1}>
        <LblM>Provenance</LblM>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {[mc.sourceSummary, ...(report?.sources.map((source) => source.label) ?? [])]
            .filter(Boolean)
            .map((s, i) => (
              <span key={i} className="fdp__chip">
                {s}
              </span>
            ))}
        </div>
        <Sub>{report?.provenanceText ?? mc.interpretation}</Sub>
      </Card>
      {focusedZone ? (
        <Card
          span={-1}
          accent={statusColor(focusedZone.status)}
          onClick={handleOpenFocusedZone}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Lbl color={statusColor(focusedZone.status)}>Focused Zone</Lbl>
            <span
              className="fdp-mono"
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: statusColor(focusedZone.status),
                textTransform: "uppercase",
              }}
            >
              Open zone evidence
            </span>
          </div>
          <div style={{ marginTop: 4 }}>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {focusedZone.trackingKey}
            </span>
            <div>
              <Sub>
                {focusedZoneJumpHint ??
                  "Open the zones page for current tracked-zone evidence."}
              </Sub>
            </div>
          </div>
        </Card>
      ) : null}
      {contextualNotesTarget ? (
        <Card span={-1} accent={ac} onClick={handleOpenContextNotes}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Lbl color={ac}>Scout This Context</Lbl>
            <span
              className="fdp-mono"
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: ac,
                textTransform: "uppercase",
              }}
            >
              Open notes
            </span>
          </div>
          <div style={{ marginTop: 4 }}>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {contextualNotesTarget.name}
            </span>
            <div>
              <Sub>{contextualNotesTarget.coordinateLabel}</Sub>
            </div>
          </div>
        </Card>
      ) : null}
    </>
  );
}
