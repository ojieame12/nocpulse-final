/**
 * Crops subpage for FieldDetailPanel. Extracted from SubPageView — pure render, no local state.
 */

"use client";

import React from "react";
import { Card, Lbl, LblM, Big, Sub, Mono } from "./fieldDetailCardPrimitives";
import { MiniDonut, ProgBar } from "./fieldDetailVisualizations";
import { parseNumericValue } from "./fieldDetailHelpers";
import type { FieldSummaryProps } from "./SummaryTab";
import type { FieldCropProps } from "../../features/fields/tabs/CropTab";
import type { DetailPanelModeData } from "./fieldDetailTypes";

interface CropsSubPageProps {
  ac: string;
  crop: FieldCropProps | null;
  summary: FieldSummaryProps | null;
  mc: DetailPanelModeData;
  contextOnlyOptical: boolean;
  contextTone: string;
  radarWetnessModeLabel: string;
  cropSignalSummary: string;
  cropMoistureSummary: string;
  cropActiveSignalSub: string;
  cropTrackedContextText: string | null;
  cropThresholds: readonly any[];
  cropFieldTiles: readonly any[];
  cropDiseaseRisks: readonly any[];
  focusedZone: any | null;
  focusedZoneJumpHint: string | null;
  handleOpenFocusedZone: () => void;
  contextualNotesTarget: any | null;
  handleOpenContextNotes: () => void;
  statusColor: (status: string) => string;
}

export function CropsSubPage({
  ac,
  crop,
  summary,
  mc,
  contextOnlyOptical,
  contextTone,
  radarWetnessModeLabel,
  cropSignalSummary,
  cropMoistureSummary,
  cropActiveSignalSub,
  cropTrackedContextText,
  cropThresholds,
  cropFieldTiles,
  cropDiseaseRisks,
  focusedZone,
  focusedZoneJumpHint,
  handleOpenFocusedZone,
  contextualNotesTarget,
  handleOpenContextNotes,
  statusColor,
}: CropsSubPageProps) {
  const healthMetrics = crop?.healthIndex.metrics ?? [];
  const moistureMetrics = crop?.moistureBalance.metrics ?? [];
  const provenanceRows = crop?.provenanceRows ?? [];
  const provenanceChips = crop?.provenanceChips ?? [];
  const cropAlerts = crop?.alerts ?? [];

  return (
    <>
      <Card span={-1}>
        <Lbl color={ac}>Growth Stage</Lbl>
        <div style={{ display: "flex", gap: 3 }}>
          {(crop?.growthSegments ?? []).map((s, i) => (
            <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: s.active ? ac : `${ac}20`, position: "relative" }}>
              {s.active && <div style={{ position: "absolute", top: -20, left: "50%", transform: "translateX(-50%)", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: ac, whiteSpace: "nowrap" }}>▾</div>}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          {(crop?.growthSegments ?? []).map((s, i) => (
            <span key={i} style={{ fontFamily: "var(--font-body)", fontSize: 8, color: s.active ? ac : "var(--text-muted)", fontWeight: s.active ? 700 : 400, textAlign: "center", flex: 1 }}>{s.label}</span>
          ))}
        </div>
      </Card>
      <Card>
        <LblM>Crop</LblM>
        <div>
          <Big size={18}>{crop?.cropName ?? summary?.crop ?? "—"}</Big>
          <div><Sub>{summary?.cropStage ?? crop?.thresholdStageLabel ?? "Stage unavailable"}</Sub></div>
          {crop?.lld ? <div><Sub>{crop.lld}</Sub></div> : null}
        </div>
      </Card>
      <Card><LblM>Health Index</LblM><div><Big size={22}>{crop?.healthIndex.label ?? "—"}</Big><div><Sub>{cropSignalSummary}</Sub></div></div></Card>
      <Card><LblM>GDD Accumulated</LblM><div><Big size={22}>{crop?.accumulatedGddLabel ?? "—"}</Big><div style={{ marginTop: 4 }}><ProgBar value={Math.min(100, Math.max(0, (parseNumericValue(crop?.accumulatedGddLabel) ?? 0) / 1500 * 100))} color={ac} /><div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}><span style={{ fontFamily: "var(--font-body)", fontSize: 8, color: "var(--text-muted)" }}>{crop?.gddUnitLabel ?? "—"}</span><span style={{ fontFamily: "var(--font-body)", fontSize: 8, color: "var(--text-muted)" }}>{crop?.thresholdStageLabel ?? "—"}</span></div></div></div></Card>
      <Card><LblM>Active Signal</LblM><div><Big size={22}>{mc.hero.d}{mc.hero.u}</Big><div><Sub>{cropActiveSignalSub}</Sub></div></div></Card>
      <Card span={-1}>
        <LblM>Crop Thresholds</LblM>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div className="fdp__threshold-header">
            <span style={{ flex: 2, fontFamily: "var(--font-body)", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Parameter</span>
            <span style={{ flex: 1, textAlign: "center", fontFamily: "var(--font-body)", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Min</span>
            <span style={{ flex: 1.5, textAlign: "center", fontFamily: "var(--font-body)", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Optimal</span>
            <span style={{ flex: 1, textAlign: "center", fontFamily: "var(--font-body)", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Max</span>
            <span style={{ width: 32 }}></span>
          </div>
          {cropThresholds.map((t, i) => (
            <div key={i} className="fdp__threshold-row">
              <span style={{ flex: 2, fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700, color: "var(--text-body)" }}>{t.param}</span>
              <span style={{ flex: 1, textAlign: "center" }}><Mono color="var(--text-secondary)">{t.min}</Mono></span>
              <span style={{ flex: 1.5, textAlign: "center" }}><Mono color={t.optimalColor}>{t.optimal}</Mono></span>
              <span style={{ flex: 1, textAlign: "center" }}><Mono color="var(--text-secondary)">{t.max}</Mono></span>
              <div style={{ width: 32, display: "flex", justifyContent: "center" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.status === "ok" ? "#16a34a" : "#f59e0b" }} />
              </div>
            </div>
          ))}
          {cropThresholds.length === 0 ? <Sub>No crop threshold data is available.</Sub> : null}
        </div>
      </Card>
      <Card>
        <Lbl color={ac}>{crop?.healthIndexTitle ?? "Crop Signal"}</Lbl>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <MiniDonut value={crop?.healthIndex.value ?? 0} color={crop?.healthIndex.fillColor ?? ac} size={48} sw={4} />
          <div>
            <Big size={20} color={contextOnlyOptical ? contextTone : undefined}>{crop?.healthIndex.label ?? "—"}</Big>
            <div><Sub>{cropSignalSummary}</Sub></div>
            {contextOnlyOptical ? <Sub>{`Use root moisture, ${radarWetnessModeLabel}, and weather for current decisions.`}</Sub> : null}
          </div>
        </div>
        {healthMetrics.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 10 }}>
            {healthMetrics.map((metric) => (
              <div
                key={metric.label}
                style={{
                  border: "1px solid var(--panel-border)",
                  borderRadius: 10,
                  padding: "8px 10px",
                  background: "var(--panel-elevated)",
                  minWidth: 0,
                }}
              >
                <LblM>{metric.label}</LblM>
                <div style={{ marginTop: 2 }}>
                  <span
                    className="fdp-mono"
                    style={{ color: metric.valueColor, fontSize: 11, lineHeight: 1.4 }}
                  >
                    {metric.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
      <Card>
        <Lbl color="#3b82f6">{crop?.moistureBalanceTitle ?? "Moisture Balance"}</Lbl>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <MiniDonut value={crop?.moistureBalance.value ?? 0} color={crop?.moistureBalance.fillColor ?? "#3b82f6"} size={48} sw={4} />
          <div><Big size={20}>{crop?.moistureBalance.label ?? "—"}</Big><div><Sub>{cropMoistureSummary}</Sub></div></div>
        </div>
        {moistureMetrics.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 10 }}>
            {moistureMetrics.map((metric) => (
              <div
                key={metric.label}
                style={{
                  border: "1px solid var(--panel-border)",
                  borderRadius: 10,
                  padding: "8px 10px",
                  background: "var(--panel-elevated)",
                  minWidth: 0,
                }}
              >
                <LblM>{metric.label}</LblM>
                <div style={{ marginTop: 2 }}>
                  <span
                    className="fdp-mono"
                    style={{ color: metric.valueColor, fontSize: 11, lineHeight: 1.4 }}
                  >
                    {metric.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
      {cropFieldTiles.slice(0, 4).map((tile, i) => (
        <Card key={i}><LblM>{tile.label}</LblM><div><Big size={22} color={tile.valueColor}>{tile.value}</Big><div><Sub>{tile.sub}</Sub></div></div></Card>
      ))}
      {cropDiseaseRisks.map((d, i) => (
        <Card key={i} accent={contextOnlyOptical ? contextTone : d.color}>
          <LblM>{d.name}</LblM>
          <div>
            <Big size={22} color={contextOnlyOptical ? contextTone : d.color}>{contextOnlyOptical ? "CTX" : d.pct}</Big>
            <div><Sub>{contextOnlyOptical ? "Disease urgency is muted until optical canopy validity is in-season." : cropTrackedContextText ? `${cropTrackedContextText} ${d.desc}` : d.desc}</Sub></div>
          </div>
        </Card>
      ))}
      {provenanceRows.length > 0 ? (
        <Card span={-1}>
          <Lbl color={ac}>{crop?.provenanceLabel ?? "Crop Provenance"}</Lbl>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 6 }}>
            {provenanceRows.map((row) => (
              <div key={row.key} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--text-muted)" }}>{row.key}</span>
                <span
                  className="fdp-mono"
                  style={{ color: "var(--text-secondary)", fontSize: 11, textAlign: "right", lineHeight: 1.4 }}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
          {provenanceChips.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {provenanceChips.map((chip) => (
                <span
                  key={chip}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    fontWeight: 700,
                    color: ac,
                    border: `1px solid ${ac}35`,
                    background: `${ac}14`,
                    borderRadius: 999,
                    padding: "4px 8px",
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                  }}
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}
      {cropAlerts.length > 0 ? (
        <Card span={-1}>
          <Lbl color={ac}>Active Crop Alerts</Lbl>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
            {cropAlerts.map((alert) => (
              <div
                key={`${alert.title}-${alert.desc}`}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: `${alert.iconColor}14`,
                  border: `1px solid ${alert.iconColor}22`,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: alert.iconColor,
                    marginTop: 5,
                    flex: "0 0 auto",
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                    {alert.title}
                  </div>
                  <Sub>{alert.desc}</Sub>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
      {focusedZone ? (
        <Card span={-1} accent={statusColor(focusedZone.status)} onClick={handleOpenFocusedZone}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <Lbl color={statusColor(focusedZone.status)}>Focused Zone</Lbl>
            <span className="fdp-mono" style={{ fontSize: 9, fontWeight: 700, color: statusColor(focusedZone.status), textTransform: "uppercase" }}>
              Open zone evidence
            </span>
          </div>
          <div style={{ marginTop: 4 }}>
            <span style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
              {focusedZone.trackingKey}
            </span>
            <div><Sub>{focusedZoneJumpHint ?? "Open the zones page for current tracked-zone evidence."}</Sub></div>
          </div>
        </Card>
      ) : null}
      {contextualNotesTarget ? (
        <Card span={-1} accent={ac} onClick={handleOpenContextNotes}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <Lbl color={ac}>Scout This Context</Lbl>
            <span className="fdp-mono" style={{ fontSize: 9, fontWeight: 700, color: ac, textTransform: "uppercase" }}>
              Open notes
            </span>
          </div>
          <div style={{ marginTop: 4 }}>
            <span style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
              {contextualNotesTarget.name}
            </span>
            <div><Sub>{contextualNotesTarget.coordinateLabel}</Sub></div>
          </div>
        </Card>
      ) : null}
      {crop?.footer ? (
        <Card span={-1}>
          <Sub>{crop.footer}</Sub>
        </Card>
      ) : null}
    </>
  );
}
