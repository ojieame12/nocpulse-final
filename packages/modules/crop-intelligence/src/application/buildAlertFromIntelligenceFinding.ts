import type { UpsertFieldAlertInput } from "@fieldpulse/module-alerts";
import type { BuildAlertFromIntelligenceFindingInput } from "../contracts/BuildAlertFromIntelligenceFindingInput";

export function buildAlertFromIntelligenceFinding(
  input: BuildAlertFromIntelligenceFindingInput,
): UpsertFieldAlertInput {
  const sourceKeyPrefix = input.sourceKeyPrefix ?? "crop-intelligence";
  const finding = input.finding;

  return {
    workspaceId: finding.workspaceId,
    fieldId: finding.fieldId,
    family: finding.family,
    severity: finding.severity,
    status:
      finding.status === "dismissed"
        ? "dismissed"
        : finding.status === "resolved"
          ? "resolved"
          : "active",
    sourceKey: `${sourceKeyPrefix}:${finding.sourceKey}`,
    dedupeKey: finding.dedupeKey,
    title: finding.title,
    summary: finding.summary,
    explanation: finding.explanation,
    recommendedAction: finding.recommendedAction,
    facts: {
      confidence: finding.confidence,
      affectedCellCount: finding.affectedCellKeys.length,
      trackedZoneCount: finding.evidence.trackedZones?.length ?? 0,
    },
    evidence: {
      findingId: finding.id,
      runId: finding.runId,
      zoneGeoJson: finding.zoneGeoJson,
      affectedCellKeys: finding.affectedCellKeys,
      ...finding.evidence,
    },
    startedAt: finding.startedAt,
    endedAt: finding.endedAt,
    resolvedAt: finding.status === "active" ? null : finding.endedAt,
  };
}
