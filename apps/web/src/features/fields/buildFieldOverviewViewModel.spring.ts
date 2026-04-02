import type { CropStagePresentation } from "./buildFieldOverviewViewModel.cropSignals";

export type SpringMetricTone = "danger" | "warning" | "positive" | "info";

export type SoilTempPresentation = {
  label: string;
  value: string;
  sub: string;
  tone: SpringMetricTone;
};

export type FieldAccessPresentation = {
  label: string;
  value: string;
  sub: string;
  tone: SpringMetricTone;
};

export function isSpringSeedingContext(
  cropStagePresentation: CropStagePresentation,
) {
  return (
    cropStagePresentation.ruleStage === "pre-seed" ||
    !cropStagePresentation.hasCredibleAccumulatedGdd ||
    cropStagePresentation.stageSourceLabel === "Weather-derived stage still initializing"
  );
}

export function resolveSoilTempPresentation(input: {
  soilTemp6cmCurrentC: number | null;
  soilTemp6cmSustainedDays: number | null;
  thresholdC?: number | null;
}): SoilTempPresentation | null {
  const current = input.soilTemp6cmCurrentC;

  if (current == null || !Number.isFinite(current)) {
    return null;
  }

  const thresholdC =
    typeof input.thresholdC === "number" && Number.isFinite(input.thresholdC)
      ? input.thresholdC
      : 5;
  const sustainedDays =
    typeof input.soilTemp6cmSustainedDays === "number" &&
    Number.isFinite(input.soilTemp6cmSustainedDays)
      ? input.soilTemp6cmSustainedDays
      : null;

  if (current < thresholdC) {
    return {
      label: "SOIL @ 6 CM",
      value: `${current.toFixed(1)}°C`,
      sub: `Below ${thresholdC.toFixed(0)}°C seed-depth target`,
      tone: "info",
    };
  }

  if (sustainedDays != null && sustainedDays >= 3) {
    return {
      label: "SOIL @ 6 CM",
      value: `${current.toFixed(1)}°C`,
      sub: `≥${thresholdC.toFixed(0)}°C for ${sustainedDays}d`,
      tone: "positive",
    };
  }

  if (sustainedDays != null && sustainedDays > 0) {
    return {
      label: "SOIL @ 6 CM",
      value: `${current.toFixed(1)}°C`,
      sub: `Above ${thresholdC.toFixed(0)}°C for ${sustainedDays}d`,
      tone: "warning",
    };
  }

  return {
    label: "SOIL @ 6 CM",
    value: `${current.toFixed(1)}°C`,
    sub: `Above ${thresholdC.toFixed(0)}°C, hold for more days`,
    tone: "warning",
  };
}

export function resolveFieldAccessPresentation(input: {
  surfaceMoisturePct: number | null;
  recentPrecipTotal72hMm: number | null;
  freezeThawCycles7d: number | null;
}): FieldAccessPresentation | null {
  const surfaceMoisturePct =
    typeof input.surfaceMoisturePct === "number" &&
    Number.isFinite(input.surfaceMoisturePct)
      ? input.surfaceMoisturePct
      : null;
  const recentPrecipTotal72hMm =
    typeof input.recentPrecipTotal72hMm === "number" &&
    Number.isFinite(input.recentPrecipTotal72hMm)
      ? input.recentPrecipTotal72hMm
      : null;
  const freezeThawCycles7d =
    typeof input.freezeThawCycles7d === "number" &&
    Number.isFinite(input.freezeThawCycles7d)
      ? input.freezeThawCycles7d
      : null;

  if (
    surfaceMoisturePct == null &&
    recentPrecipTotal72hMm == null &&
    freezeThawCycles7d == null
  ) {
    return null;
  }

  const detail = [
    surfaceMoisturePct != null ? `Surface ${surfaceMoisturePct.toFixed(0)}%` : null,
    recentPrecipTotal72hMm != null
      ? `P72h ${recentPrecipTotal72hMm.toFixed(0)}mm`
      : null,
    freezeThawCycles7d != null
      ? `${freezeThawCycles7d} thaw cycle${freezeThawCycles7d === 1 ? "" : "s"}`
      : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");

  const notWorkable =
    (surfaceMoisturePct != null && surfaceMoisturePct > 85) ||
    ((recentPrecipTotal72hMm != null && recentPrecipTotal72hMm > 20) &&
      (freezeThawCycles7d != null && freezeThawCycles7d > 4));
  if (notWorkable) {
    return {
      label: "FIELD ACCESS",
      value: "Wait",
      sub: detail || "Field access still tightening",
      tone: "danger",
    };
  }

  const marginal =
    (surfaceMoisturePct != null && surfaceMoisturePct >= 70) ||
    (recentPrecipTotal72hMm != null && recentPrecipTotal72hMm >= 10) ||
    (freezeThawCycles7d != null && freezeThawCycles7d >= 2);
  if (marginal) {
    return {
      label: "FIELD ACCESS",
      value: "Marginal",
      sub: detail || "Use caution with equipment timing",
      tone: "warning",
    };
  }

  return {
    label: "FIELD ACCESS",
    value: "Workable",
    sub: detail || "Ground conditions are favorable",
    tone: "positive",
  };
}
