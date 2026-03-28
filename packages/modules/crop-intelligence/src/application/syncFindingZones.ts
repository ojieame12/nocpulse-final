import type { JsonValue, TimestampIso } from "@fieldpulse/platform-db";
import type { FieldIntelligenceFinding } from "../contracts/FieldIntelligenceFinding";
import type { FieldIntelligenceZone } from "../contracts/FieldIntelligenceZone";
import type {
  IntelligenceSeverity,
  IntelligenceZoneStatus,
} from "../contracts/IntelligenceFindingFamily";
import type { UpsertFieldIntelligenceZoneInput } from "../contracts/UpsertFieldIntelligenceZoneInput";

type SyncableZoneRepository = {
  listByTrackingKey(input: {
    workspaceId: string;
    fieldId: string;
    family: FieldIntelligenceFinding["family"];
    trackingKey: string;
  }): Promise<readonly FieldIntelligenceZone[]>;
  upsertZone(
    input: UpsertFieldIntelligenceZoneInput,
  ): Promise<FieldIntelligenceZone>;
};

export type SyncFindingZoneInput = {
  zoneGeoJson: JsonValue;
  affectedCellKeys: readonly string[];
  metadata?: JsonValue;
};

export type SyncFindingZonesInput = {
  repository: SyncableZoneRepository;
  finding: FieldIntelligenceFinding;
  observedAt: TimestampIso;
  zones: readonly SyncFindingZoneInput[];
};

function severityRank(severity: IntelligenceSeverity | null | undefined) {
  switch (severity) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
    default:
      return 1;
  }
}

function toRecord(value: JsonValue | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function buildCellKeySet(keys: readonly string[]) {
  return new Set(keys);
}

function overlapScore(left: readonly string[], right: readonly string[]) {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const leftSet = buildCellKeySet(left);
  const rightSet = buildCellKeySet(right);
  let intersectionCount = 0;

  for (const key of leftSet) {
    if (rightSet.has(key)) {
      intersectionCount += 1;
    }
  }

  if (intersectionCount === 0) {
    return 0;
  }

  const unionCount = leftSet.size + rightSet.size - intersectionCount;

  return intersectionCount / unionCount;
}

function nextMatchedZoneStatus(input: {
  existing: FieldIntelligenceZone;
  finding: FieldIntelligenceFinding;
}): IntelligenceZoneStatus {
  if (
    severityRank(input.finding.severity) <
    severityRank(input.existing.latestSeverity ?? null)
  ) {
    return "recovering";
  }

  return "persistent";
}

function nextMissingZoneStatus(input: {
  existing: FieldIntelligenceZone;
  finding: FieldIntelligenceFinding;
}): IntelligenceZoneStatus {
  if (input.finding.status !== "active") {
    return input.existing.status === "recovering" ? "resolved" : "recovering";
  }

  return "recovering";
}

export async function syncFindingZones(
  input: SyncFindingZonesInput,
): Promise<readonly FieldIntelligenceZone[]> {
  const existingZones = await input.repository.listByTrackingKey({
    workspaceId: input.finding.workspaceId,
    fieldId: input.finding.fieldId,
    family: input.finding.family,
    trackingKey: input.finding.dedupeKey,
  });
  const matchedExistingZoneIds = new Set<string>();
  const syncedZones: FieldIntelligenceZone[] = [];

  for (const zone of input.zones) {
    let bestMatch: FieldIntelligenceZone | null = null;
    let bestScore = 0;

    for (const existing of existingZones) {
      if (matchedExistingZoneIds.has(existing.id)) {
        continue;
      }

      const score = overlapScore(
        zone.affectedCellKeys,
        existing.affectedCellKeys,
      );

      if (score > bestScore) {
        bestScore = score;
        bestMatch = existing;
      }
    }

    const nextStatus =
      bestMatch == null
        ? "new"
        : nextMatchedZoneStatus({
            existing: bestMatch,
            finding: input.finding,
          });
    const metadata = {
      ...toRecord(bestMatch?.metadata),
      ...toRecord(zone.metadata),
      lastMatchScore: bestScore,
    };
    const synced = await input.repository.upsertZone({
      id: bestMatch?.id,
      workspaceId: input.finding.workspaceId,
      fieldId: input.finding.fieldId,
      family: input.finding.family,
      trackingKey: input.finding.dedupeKey,
      latestFindingId: input.finding.id,
      latestRunId: input.finding.runId,
      status: nextStatus,
      latestSeverity: input.finding.severity,
      zoneGeoJson: zone.zoneGeoJson,
      affectedCellKeys: zone.affectedCellKeys,
      detectionCount: bestMatch ? bestMatch.detectionCount + 1 : 1,
      firstSeenAt: bestMatch?.firstSeenAt ?? input.observedAt,
      lastSeenAt: input.observedAt,
      lastStatusChangedAt:
        !bestMatch || bestMatch.status !== nextStatus
          ? input.observedAt
          : bestMatch.lastStatusChangedAt,
      metadata,
    });

    if (bestMatch) {
      matchedExistingZoneIds.add(bestMatch.id);
    }

    syncedZones.push(synced);
  }

  for (const existing of existingZones) {
    if (matchedExistingZoneIds.has(existing.id)) {
      continue;
    }

    const nextStatus = nextMissingZoneStatus({
      existing,
      finding: input.finding,
    });
    const synced = await input.repository.upsertZone({
      id: existing.id,
      workspaceId: existing.workspaceId,
      fieldId: existing.fieldId,
      family: existing.family,
      trackingKey: existing.trackingKey,
      latestFindingId: input.finding.id,
      latestRunId: input.finding.runId,
      status: nextStatus,
      latestSeverity: input.finding.severity,
      zoneGeoJson: existing.zoneGeoJson,
      affectedCellKeys: existing.affectedCellKeys,
      detectionCount: existing.detectionCount,
      firstSeenAt: existing.firstSeenAt,
      lastSeenAt: existing.lastSeenAt,
      lastStatusChangedAt:
        existing.status !== nextStatus
          ? input.observedAt
          : existing.lastStatusChangedAt,
      metadata: {
        ...toRecord(existing.metadata),
        lastMissingAt: input.observedAt,
      },
    });

    syncedZones.push(synced);
  }

  return syncedZones;
}
