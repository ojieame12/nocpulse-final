'use client';

/* Types preserved from archived ActionTab. Component stub pending redesign. */

export interface ActionTag { label: string; color: 'green' | 'red' | 'yellow'; detail?: string; }
export interface ActionQAItem { question: string; answer?: string; tags?: ActionTag[]; }
export type FieldIntelligenceState = "none" | "watchlist" | "active";
export type FieldIntelligenceSource = "none" | "findings" | "alerts" | "heuristics";
export interface FieldActionProps {
  name: string; lld: string; recommendation: string; dueDate: string;
  explanation: string; urgency: string; confidence: string;
  signalCount: number; signals: ActionTag[]; questions: ActionQAItem[];
  intelligenceState?: FieldIntelligenceState;
  intelligenceSource?: FieldIntelligenceSource;
  intelligenceSourceLabel?: string | null;
  intelligenceFreshnessLabel?: string | null;
  activeFindingCount?: number;
  activeZoneCount?: number;
  activeAlertCount?: number;
  topRiskTitle?: string;
  topRiskSeverity?: "low" | "medium" | "high" | "critical" | null;
}

export function ActionTab(_props: { field?: FieldActionProps; onClose?: () => void }) {
  return null; // Redesign pending
}
