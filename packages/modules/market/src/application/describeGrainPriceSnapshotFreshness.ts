export type GrainPriceSnapshotFreshnessStatus =
  | "fresh"
  | "stale"
  | "missing";

export type GrainPriceSnapshotFreshness = {
  status: GrainPriceSnapshotFreshnessStatus;
  ageHours: number | null;
  ageLabel: string | null;
};

function isDailySettlementSourceKey(sourceKey: string | null | undefined) {
  const normalized = sourceKey?.trim().toLowerCase() ?? "";
  return (
    normalized.startsWith("investing:") ||
    normalized.startsWith("investing-canada:")
  );
}

function startOfUtcDay(value: number) {
  const date = new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function businessDayIndex(value: number) {
  const date = new Date(startOfUtcDay(value));
  const day = date.getUTCDay();

  if (day === 0) {
    date.setUTCDate(date.getUTCDate() - 2);
  } else if (day === 6) {
    date.setUTCDate(date.getUTCDate() - 1);
  }

  return Math.floor(date.getTime() / 86_400_000);
}

function formatAgeLabel(ageHours: number) {
  if (ageHours < 1) {
    const minutes = Math.max(1, Math.round(ageHours * 60));
    return `${minutes}m old`;
  }

  if (ageHours < 48) {
    return `${Math.round(ageHours)}h old`;
  }

  return `${Math.round(ageHours / 24)}d old`;
}

export function describeGrainPriceSnapshotFreshness(input: {
  capturedAt: string | null | undefined;
  sourceKey?: string | null | undefined;
  now?: string | Date;
  staleAfterHours?: number;
}): GrainPriceSnapshotFreshness {
  if (!input.capturedAt) {
    return {
      status: "missing",
      ageHours: null,
      ageLabel: null,
    };
  }

  const staleAfterHours = input.staleAfterHours ?? 24;

  if (!Number.isFinite(staleAfterHours) || staleAfterHours < 0) {
    throw new Error("[market] staleAfterHours must be non-negative");
  }

  const now =
    input.now instanceof Date
      ? input.now.getTime()
      : input.now != null
        ? Date.parse(input.now)
        : Date.now();
  const capturedAt = Date.parse(input.capturedAt);

  if (Number.isNaN(now) || Number.isNaN(capturedAt)) {
    throw new Error("[market] invalid timestamp provided for freshness calculation");
  }

  const ageHours = Math.max(0, (now - capturedAt) / (60 * 60 * 1000));
  const status =
    isDailySettlementSourceKey(input.sourceKey)
      ? businessDayIndex(now) - businessDayIndex(capturedAt) > 1
        ? "stale"
        : "fresh"
      : ageHours > staleAfterHours
        ? "stale"
        : "fresh";

  return {
    status,
    ageHours,
    ageLabel: formatAgeLabel(ageHours),
  };
}
