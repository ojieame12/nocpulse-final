/**
 * Actions subpage for FieldDetailPanel.
 * Extracted from SubPageView — pure render, shared openQ state passed as props.
 */

import React from "react";
import { ChevronRight } from "lucide-react";
import { Card, Lbl, LblM, Big, Sub, Mono } from "./fieldDetailCardPrimitives";
import type { FieldActionProps } from "./ActionTab";
import type { FieldNotesInspectionTarget } from "./NotesTab";

/** Shorten verbose confidence labels to fit a vital card */
function compactConfidence(raw?: string | null): string {
  if (!raw || raw === "—") return "—";
  // Take first segment before · or ,
  const first = raw.split(/[·,]/)[0].trim();
  if (/watchlist/i.test(first)) return "Watchlist";
  if (/no active intelligence/i.test(first)) return "Quiet";
  if (/finding-backed/i.test(first)) return "Finding";
  if (/alert-backed/i.test(first)) return "Alert";
  // Map known verbose phrases to concise labels
  if (/context.only/i.test(first)) return "Context";
  if (/pending/i.test(first)) return "Pending";
  if (/model.backed/i.test(first)) return "Modelled";
  // "Vegetative optical" → "Vegetative", "Low confidence" → "Low"
  if (/\boptical$/i.test(first)) return first.replace(/\s+optical$/i, "");
  if (/\bconfidence$/i.test(first)) return first.replace(/\s+confidence$/i, "");
  // Already short enough
  return first.length > 12 ? first.split(/\s+/)[0] : first;
}

export interface ActionsSubPageProps {
  /** Accent color for cards */
  ac: string;
  /** Action data */
  action: FieldActionProps | null;
  /** Whether optical layers are context-only */
  contextOnlyOptical: boolean;
  /** Context tone color */
  contextTone: string;
  /** Label for radar wetness mode */
  radarWetnessModeLabel: string;
  /** Action recommendation text */
  actionRecommendationText: string;
  /** Action urgency label */
  actionUrgencyLabel: string;
  /** Action context text */
  actionContextText: string;
  /** Evidence signals array */
  actionEvidenceSignals: Array<{
    label: string;
    color: "green" | "yellow" | "red";
    detail?: string;
  }>;
  /** Open Q&A index (shared state) */
  openQ: number;
  /** Set open Q&A index (shared state) */
  setOpenQ: (index: number) => void;
  /** Focused zone */
  focusedZone: {
    id: string;
    trackingKey: string;
    status: string;
    affectedCellCount: number;
  } | null;
  /** Focused zone jump hint */
  focusedZoneJumpHint: string | null;
  /** Handle open focused zone */
  handleOpenFocusedZone: () => void;
  /** Contextual notes target */
  contextualNotesTarget: FieldNotesInspectionTarget | null;
  /** Handle open context notes */
  handleOpenContextNotes: () => void;
  /** Open the alerts review surface */
  handleOpenAlerts: () => void;
  /** Status color function */
  statusColor: (status: string) => string;
}

export function ActionsSubPage({
  ac,
  action,
  contextOnlyOptical,
  contextTone,
  radarWetnessModeLabel,
  actionRecommendationText,
  actionUrgencyLabel,
  actionContextText,
  actionEvidenceSignals,
  openQ,
  setOpenQ,
  focusedZone,
  focusedZoneJumpHint,
  handleOpenFocusedZone,
  contextualNotesTarget,
  handleOpenContextNotes,
  handleOpenAlerts,
  statusColor,
}: ActionsSubPageProps) {
  const intelligenceMeta =
    [action?.intelligenceSourceLabel, action?.intelligenceFreshnessLabel]
      .filter((value): value is string => Boolean(value))
      .join(" · ") || null;
  return (
    <>
      <Card span={-1} accent={ac}>
        <Lbl color={ac}>Recommendation</Lbl>
        <div>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text-primary)",
              lineHeight: 1.5,
            }}
          >
            {actionRecommendationText}
          </span>
          <div style={{ marginTop: 4 }}>
            <span className="fdp-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
              Due: {action?.dueDate ?? "—"}
            </span>
          </div>
          {intelligenceMeta ? (
            <div style={{ marginTop: 4 }}>
              <span className="fdp-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                {intelligenceMeta}
              </span>
            </div>
          ) : null}
          {contextOnlyOptical ? (
            <div style={{ marginTop: 6 }}>
              <Sub>{`Optical canopy layers are context-only here. Action priority is being weighted toward moisture, ${radarWetnessModeLabel}, and weather signals.`}</Sub>
            </div>
          ) : null}
        </div>
      </Card>
      <div className="fdp__vitals-grid">
        <Card>
          <LblM>Severity</LblM>
          <Big size={18} color={contextOnlyOptical ? contextTone : "#ef4444"}>
            {actionUrgencyLabel}
          </Big>
        </Card>
        <Card>
          <LblM>Confidence</LblM>
          <Big size={18}>{compactConfidence(action?.confidence)}</Big>
        </Card>
        <Card>
          <LblM>Signals</LblM>
          <Big size={18}>{Math.max(action?.signalCount ?? 0, actionEvidenceSignals.length)}</Big>
        </Card>
      </div>
      <Card span={-1}>
        <LblM>Context</LblM>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-body)", lineHeight: 1.7 }}>
          {actionContextText}
        </span>
      </Card>
      <Card span={-1}>
        <LblM>Evidence</LblM>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {actionEvidenceSignals.map((e, i) => (
            <span
              key={i}
              className="fdp-mono"
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "4px 12px",
                borderRadius: 999,
                background:
                  e.color === "red" ? "rgba(239,68,68,0.12)" : e.color === "yellow" ? "rgba(245,158,11,0.12)" : "rgba(22,163,74,0.12)",
                color: e.color === "red" ? "#ef4444" : e.color === "yellow" ? "#f59e0b" : "#16a34a",
              }}
            >
              {e.label}
            </span>
          ))}
        </div>
      </Card>
      {(action?.activeAlertCount ?? 0) > 0 ? (
        <Card span={-1} accent={ac} onClick={handleOpenAlerts}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <Lbl color={ac}>Alert Review</Lbl>
            <span
              className="fdp-mono"
              style={{ fontSize: 9, fontWeight: 700, color: ac, textTransform: "uppercase" }}
            >
              Review alerts
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
              {action?.activeAlertCount} active alert{action?.activeAlertCount === 1 ? "" : "s"}
            </span>
            <div>
              <Sub>{action?.topRiskTitle ?? "Open the alerts panel to review or resolve current field alerts."}</Sub>
            </div>
          </div>
        </Card>
      ) : null}
      {(action?.questions ?? []).map((qa, i) => (
        <Card
          key={i}
          span={-1}
          onClick={() => setOpenQ(openQ === i ? -1 : i)}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 12,
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {qa.question}
            </span>
            <ChevronRight
              size={14}
              color="var(--text-muted)"
              className={`fdp__qa-chevron ${openQ === i ? "fdp__qa-chevron--open" : ""}`}
            />
          </div>
          {openQ === i && qa.answer && (
            <div>
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 11,
                  color: "var(--text-body)",
                  lineHeight: 1.7,
                }}
              >
                {qa.answer}
              </span>
              {qa.tags && qa.tags.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  {qa.tags.map((b, j) => (
                    <span
                      key={j}
                      className="fdp-mono"
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: `${ac}14`,
                        color: ac,
                      }}
                    >
                      {b.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {openQ === i && !qa.answer && <Sub>Analysis not yet available for this question.</Sub>}
        </Card>
      ))}
      {actionEvidenceSignals.map((a, i) => (
        <Card
          key={i}
          span={-1}
          accent={a.color === "red" ? "#ef4444" : a.color === "yellow" ? "#f59e0b" : "#16a34a"}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {a.label}
            </span>
            <span
              className="fdp-mono"
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
                background:
                  a.color === "red" ? "rgba(239,68,68,0.12)" : a.color === "yellow" ? "rgba(245,158,11,0.12)" : "rgba(22,163,74,0.12)",
                color: a.color === "red" ? "#ef4444" : a.color === "yellow" ? "#f59e0b" : "#16a34a",
              }}
            >
              {action?.dueDate ?? "Open"}
            </span>
          </div>
          <Sub>{a.detail ?? action?.explanation ?? "No supporting context is available yet."}</Sub>
        </Card>
      ))}
      {focusedZone ? (
        <Card span={-1} accent={statusColor(focusedZone.status)} onClick={handleOpenFocusedZone}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
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
              <Sub>{focusedZoneJumpHint ?? "Open the zones page for current tracked-zone evidence."}</Sub>
            </div>
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
