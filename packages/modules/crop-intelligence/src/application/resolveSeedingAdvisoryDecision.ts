import type { FrostRiskRulePack, SeedingThresholdRulePack } from "../contracts/RulePack";

export type FieldAccessVerdict = "workable" | "marginal" | "wait";

export type FieldAccessDecision = {
  verdict: FieldAccessVerdict;
  surfaceMoisturePct: number | null;
  recentPrecipTotal72hMm: number | null;
  freezeThawCycles7d: number | null;
  detailParts: readonly string[];
  detailSummary: string;
  blockedBySurfaceMoisture: boolean;
  blockedByRecentPrecip: boolean;
  blockedByFreezeThaw: boolean;
  warnedBySurfaceMoisture: boolean;
  warnedByRecentPrecip: boolean;
  warnedByFreezeThaw: boolean;
};

export type SeedingAdvisoryReasonCode =
  | "missing-soil-temp"
  | "soil-below-threshold"
  | "soil-not-sustained"
  | "frost-risk"
  | "field-access"
  | "surface-too-dry"
  | "ready";

export type SeedingAdvisoryDecision = {
  verdict: "too-early" | "hold" | "seed-now";
  reasonCode: SeedingAdvisoryReasonCode;
  thresholdC: number;
  requiredDays: number;
  soilTempCurrentC: number | null;
  soilTempSustainedDays: number | null;
  surfaceMoisturePct: number | null;
  frostRiskMinTempC7d: number | null;
  frostRiskNights7d: number;
  frostProbabilityPct7d: number | null;
  fieldAccessVerdict: FieldAccessVerdict | null;
  soilReady: boolean;
  tooDry: boolean;
  tooWet: boolean;
  fieldAccessBlocked: boolean;
  fieldAccessMarginal: boolean;
  frostDamageRisk: boolean;
  frostKillRisk: boolean;
  frostBlocked: boolean;
};

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function resolveFieldAccessDecision(input: {
  surfaceMoisturePct: number | null;
  recentPrecipTotal72hMm: number | null;
  freezeThawCycles7d: number | null;
  thresholds?: Pick<
    SeedingThresholdRulePack,
    | "surfaceMoistureMaxPct"
    | "recentPrecipWarnMm72h"
    | "recentPrecipBlockMm72h"
    | "freezeThawWarnCount"
    | "freezeThawBlockCount"
  > | null;
}): FieldAccessDecision | null {
  const surfaceMoisturePct = finiteOrNull(input.surfaceMoisturePct);
  const recentPrecipTotal72hMm = finiteOrNull(input.recentPrecipTotal72hMm);
  const freezeThawCycles7d = finiteOrNull(input.freezeThawCycles7d);

  if (
    surfaceMoisturePct == null &&
    recentPrecipTotal72hMm == null &&
    freezeThawCycles7d == null
  ) {
    return null;
  }

  const thresholds = input.thresholds;
  const surfaceMoistureMaxPct = finiteOrNull(thresholds?.surfaceMoistureMaxPct) ?? 85;
  const recentPrecipWarnMm72h = finiteOrNull(thresholds?.recentPrecipWarnMm72h) ?? 10;
  const recentPrecipBlockMm72h = finiteOrNull(thresholds?.recentPrecipBlockMm72h) ?? 20;
  const freezeThawWarnCount = finiteOrNull(thresholds?.freezeThawWarnCount) ?? 2;
  const freezeThawBlockCount = finiteOrNull(thresholds?.freezeThawBlockCount) ?? 4;

  const detailParts = [
    surfaceMoisturePct != null ? `Surface ${surfaceMoisturePct.toFixed(0)}%` : null,
    recentPrecipTotal72hMm != null ? `P72h ${recentPrecipTotal72hMm.toFixed(0)}mm` : null,
    freezeThawCycles7d != null
      ? `${freezeThawCycles7d} thaw cycle${freezeThawCycles7d === 1 ? "" : "s"}`
      : null,
  ].filter((value): value is string => value != null);

  const blockedBySurfaceMoisture =
    surfaceMoisturePct != null && surfaceMoisturePct > surfaceMoistureMaxPct;
  const blockedByRecentPrecip =
    recentPrecipTotal72hMm != null && recentPrecipTotal72hMm >= recentPrecipBlockMm72h;
  const blockedByFreezeThaw =
    freezeThawCycles7d != null && freezeThawCycles7d >= freezeThawBlockCount;
  const warnedBySurfaceMoisture =
    surfaceMoisturePct != null && surfaceMoisturePct >= surfaceMoistureMaxPct - 15;
  const warnedByRecentPrecip =
    recentPrecipTotal72hMm != null && recentPrecipTotal72hMm >= recentPrecipWarnMm72h;
  const warnedByFreezeThaw =
    freezeThawCycles7d != null && freezeThawCycles7d >= freezeThawWarnCount;

  const verdict: FieldAccessVerdict =
    blockedBySurfaceMoisture || blockedByRecentPrecip || blockedByFreezeThaw
      ? "wait"
      : warnedBySurfaceMoisture || warnedByRecentPrecip || warnedByFreezeThaw
        ? "marginal"
        : "workable";

  return {
    verdict,
    surfaceMoisturePct,
    recentPrecipTotal72hMm,
    freezeThawCycles7d,
    detailParts,
    detailSummary:
      detailParts.join(" · ") ||
      (verdict === "workable"
        ? "Ground conditions are favorable"
        : verdict === "marginal"
          ? "Use caution with equipment timing"
          : "Field access still tightening"),
    blockedBySurfaceMoisture,
    blockedByRecentPrecip,
    blockedByFreezeThaw,
    warnedBySurfaceMoisture,
    warnedByRecentPrecip,
    warnedByFreezeThaw,
  };
}

export function resolveSeedingAdvisoryDecision(input: {
  seedingThresholds: Pick<
    SeedingThresholdRulePack,
    | "soilTempMinC"
    | "sustainedDays"
    | "surfaceMoistureMinPct"
    | "surfaceMoistureMaxPct"
  >;
  frostThresholds: Pick<FrostRiskRulePack, "damageTempC" | "killTempC">;
  soilTemp6cmCurrentC: number | null;
  soilTemp6cmSustainedDays: number | null;
  surfaceMoisturePct: number | null;
  fieldAccessVerdict?: FieldAccessVerdict | null;
  frostRiskMinTempC7d: number | null;
  frostRiskNights7d: number | null;
  frostProbabilityPct7d?: number | null;
}): SeedingAdvisoryDecision | null {
  const soilTempCurrentC = finiteOrNull(input.soilTemp6cmCurrentC);
  const soilTempSustainedDays = finiteOrNull(input.soilTemp6cmSustainedDays);
  const surfaceMoisturePct = finiteOrNull(input.surfaceMoisturePct);
  const frostRiskMinTempC7d = finiteOrNull(input.frostRiskMinTempC7d);
  const frostRiskNights7d = finiteOrNull(input.frostRiskNights7d) ?? 0;
  const frostProbabilityPct7d = finiteOrNull(input.frostProbabilityPct7d);
  const fieldAccessVerdict = input.fieldAccessVerdict ?? null;
  const thresholdC = input.seedingThresholds.soilTempMinC;
  const requiredDays = input.seedingThresholds.sustainedDays;

  if (
    soilTempCurrentC == null &&
    surfaceMoisturePct == null &&
    fieldAccessVerdict == null &&
    frostRiskMinTempC7d == null &&
    frostRiskNights7d === 0
  ) {
    return null;
  }

  const soilReady =
    soilTempCurrentC != null &&
    soilTempCurrentC >= thresholdC &&
    (soilTempSustainedDays ?? 0) >= requiredDays;
  const tooDry =
    surfaceMoisturePct != null &&
    surfaceMoisturePct < input.seedingThresholds.surfaceMoistureMinPct;
  const tooWet =
    surfaceMoisturePct != null &&
    surfaceMoisturePct > input.seedingThresholds.surfaceMoistureMaxPct;
  const fieldAccessBlocked = fieldAccessVerdict === "wait" || tooWet;
  const fieldAccessMarginal = fieldAccessVerdict === "marginal";
  const frostKillRisk =
    frostRiskMinTempC7d != null && frostRiskMinTempC7d <= input.frostThresholds.killTempC;
  const frostDamageRisk =
    frostRiskMinTempC7d != null && frostRiskMinTempC7d <= input.frostThresholds.damageTempC;
  const frostBlocked = frostDamageRisk || frostRiskNights7d > 0;

  if (!soilReady) {
    return {
      verdict: "too-early",
      reasonCode:
        soilTempCurrentC == null
          ? "missing-soil-temp"
          : soilTempCurrentC < thresholdC
            ? "soil-below-threshold"
            : "soil-not-sustained",
      thresholdC,
      requiredDays,
      soilTempCurrentC,
      soilTempSustainedDays,
      surfaceMoisturePct,
      frostRiskMinTempC7d,
      frostRiskNights7d,
      frostProbabilityPct7d,
      fieldAccessVerdict,
      soilReady,
      tooDry,
      tooWet,
      fieldAccessBlocked,
      fieldAccessMarginal,
      frostDamageRisk,
      frostKillRisk,
      frostBlocked,
    };
  }

  if (frostBlocked) {
    return {
      verdict: "hold",
      reasonCode: "frost-risk",
      thresholdC,
      requiredDays,
      soilTempCurrentC,
      soilTempSustainedDays,
      surfaceMoisturePct,
      frostRiskMinTempC7d,
      frostRiskNights7d,
      frostProbabilityPct7d,
      fieldAccessVerdict,
      soilReady,
      tooDry,
      tooWet,
      fieldAccessBlocked,
      fieldAccessMarginal,
      frostDamageRisk,
      frostKillRisk,
      frostBlocked,
    };
  }

  if (fieldAccessBlocked || fieldAccessMarginal || tooDry) {
    return {
      verdict: "hold",
      reasonCode: tooDry ? "surface-too-dry" : "field-access",
      thresholdC,
      requiredDays,
      soilTempCurrentC,
      soilTempSustainedDays,
      surfaceMoisturePct,
      frostRiskMinTempC7d,
      frostRiskNights7d,
      frostProbabilityPct7d,
      fieldAccessVerdict,
      soilReady,
      tooDry,
      tooWet,
      fieldAccessBlocked,
      fieldAccessMarginal,
      frostDamageRisk,
      frostKillRisk,
      frostBlocked,
    };
  }

  return {
    verdict: "seed-now",
    reasonCode: "ready",
    thresholdC,
    requiredDays,
    soilTempCurrentC,
    soilTempSustainedDays,
    surfaceMoisturePct,
    frostRiskMinTempC7d,
    frostRiskNights7d,
    frostProbabilityPct7d,
    fieldAccessVerdict,
    soilReady,
    tooDry,
    tooWet,
    fieldAccessBlocked,
    fieldAccessMarginal,
    frostDamageRisk,
    frostKillRisk,
    frostBlocked,
  };
}
