import type {
  SmapFieldTimeseriesPoint,
  SmapValidationExclusionReason,
  ValidationPair,
} from "@fieldpulse/module-validation";

export type SnapshotValidationMeta = {
  sourceKey: string | null;
  derivationMode: string | null;
};

export type BuiltValidationPoint = {
  point: SmapFieldTimeseriesPoint;
  pair: ValidationPair | null;
  rawMatched: boolean;
};

function isBootstrapSourceKey(sourceKey: string | null): boolean {
  return typeof sourceKey === "string" && sourceKey.toLowerCase().includes("bootstrap");
}

function resolveExclusionReason(
  nocpulsePct: number | null,
  smapPct: number | null,
  snapshotMeta: SnapshotValidationMeta | null | undefined,
): SmapValidationExclusionReason | null {
  if (nocpulsePct === null) {
    return "missing-nocpulse";
  }

  if (smapPct === null) {
    return "missing-smap";
  }

  if (isBootstrapSourceKey(snapshotMeta?.sourceKey ?? null)) {
    return "bootstrap-snapshot";
  }

  if (!snapshotMeta?.derivationMode) {
    return "missing-snapshot-provenance";
  }

  if (snapshotMeta.derivationMode !== "source-backed") {
    return "non-source-backed-snapshot";
  }

  return null;
}

export function buildValidationPoint(
  date: string,
  nocpulsePct: number | null,
  smapPct: number | null,
  snapshotMeta: SnapshotValidationMeta | null | undefined,
): BuiltValidationPoint {
  const exclusionReason = resolveExclusionReason(nocpulsePct, smapPct, snapshotMeta);
  const scored = exclusionReason === null && nocpulsePct !== null && smapPct !== null;

  return {
    point: {
      date,
      nocpulsePct,
      smapPct,
      scored,
      exclusionReason,
      snapshotSourceKey: snapshotMeta?.sourceKey ?? null,
      snapshotDerivationMode: snapshotMeta?.derivationMode ?? null,
    },
    pair:
      scored && nocpulsePct !== null && smapPct !== null
        ? { predicted: nocpulsePct, observed: smapPct }
        : null,
    rawMatched: nocpulsePct !== null && smapPct !== null,
  };
}
