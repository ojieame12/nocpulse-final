import {
  resolveFieldAccessDecision,
  resolveSeedingAdvisoryDecision,
  type FieldAccessVerdict,
  type SeedingThresholdRulePack,
} from "@fieldpulse/module-crop-intelligence";
import type { CropStagePresentation } from "./buildFieldOverviewViewModel.cropSignals";

export type SpringMetricTone = "danger" | "warning" | "positive" | "info";
export type SpringSignalColor = "red" | "yellow" | "green";

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

export type SeedingRecommendationPresentation = {
  title: string;
  severity: "medium" | "high";
  urgency: string;
  dueDate: string;
  recommendation: string;
  explanation: string;
  whyNow: string;
  inspectFirst: string;
  confidence: string;
  signals: readonly {
    label: string;
    color: SpringSignalColor;
    detail: string;
  }[];
  tags: readonly {
    label: string;
    color: SpringSignalColor;
  }[];
};

function toFieldAccessVerdict(value: FieldAccessPresentation["value"]): FieldAccessVerdict {
  if (value === "Wait") return "wait";
  if (value === "Marginal") return "marginal";
  return "workable";
}

function signalColor(tone: SpringMetricTone): SpringSignalColor {
  switch (tone) {
    case "danger":
      return "red";
    case "warning":
    case "info":
      return "yellow";
    case "positive":
    default:
      return "green";
  }
}

function formatSignedTemperature(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}°C`;
}

function formatProbabilityLabel(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  return `${Math.round(value)}% probability`;
}

function formatSoilTempDetail(input: {
  current: number | null;
  thresholdC: number;
  sustainedDays: number | null;
  requiredDays: number;
}) {
  if (input.current == null) {
    return `Target ${input.thresholdC.toFixed(0)}°C for ${input.requiredDays}d`;
  }

  if (input.sustainedDays != null && input.sustainedDays > 0) {
    return `${input.current.toFixed(1)}°C · ≥${input.thresholdC.toFixed(0)}°C for ${input.sustainedDays}d`;
  }

  return `${input.current.toFixed(1)}°C · target ${input.thresholdC.toFixed(0)}°C for ${input.requiredDays}d`;
}

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
  thresholds?: Pick<
    SeedingThresholdRulePack,
    | "surfaceMoistureMaxPct"
    | "recentPrecipWarnMm72h"
    | "recentPrecipBlockMm72h"
    | "freezeThawWarnCount"
    | "freezeThawBlockCount"
  > | null;
}): FieldAccessPresentation | null {
  const decision = resolveFieldAccessDecision({
    surfaceMoisturePct: input.surfaceMoisturePct,
    recentPrecipTotal72hMm: input.recentPrecipTotal72hMm,
    freezeThawCycles7d: input.freezeThawCycles7d,
    thresholds: input.thresholds,
  });

  if (decision == null) {
    return null;
  }

  return {
    label: "FIELD ACCESS",
    value:
      decision.verdict === "wait"
        ? "Wait"
        : decision.verdict === "marginal"
          ? "Marginal"
          : "Workable",
    sub: decision.detailSummary,
    tone:
      decision.verdict === "wait"
        ? "danger"
        : decision.verdict === "marginal"
          ? "warning"
          : "positive",
  };
}

export function resolveSeedingRecommendation(input: {
  cropLabel: string;
  cropStagePresentation: CropStagePresentation;
  seedingThresholds: SeedingThresholdRulePack;
  frostDamageTempC: number;
  frostKillTempC: number;
  soilTemp6cmCurrentC: number | null;
  soilTemp6cmSustainedDays: number | null;
  surfaceMoisturePct: number | null;
  fieldAccessPresentation: FieldAccessPresentation | null;
  frostRiskMinTempC7d: number | null;
  frostRiskNights7d: number | null;
  frostProbabilityPct7d?: number | null;
  weatherSourceLabel?: string | null;
}): SeedingRecommendationPresentation | null {
  if (!isSpringSeedingContext(input.cropStagePresentation)) {
    return null;
  }

  const decision = resolveSeedingAdvisoryDecision({
    seedingThresholds: input.seedingThresholds,
    frostThresholds: {
      damageTempC: input.frostDamageTempC,
      killTempC: input.frostKillTempC,
    },
    soilTemp6cmCurrentC: input.soilTemp6cmCurrentC,
    soilTemp6cmSustainedDays: input.soilTemp6cmSustainedDays,
    surfaceMoisturePct: input.surfaceMoisturePct,
    fieldAccessVerdict:
      input.fieldAccessPresentation == null
        ? null
        : toFieldAccessVerdict(input.fieldAccessPresentation.value),
    frostRiskMinTempC7d: input.frostRiskMinTempC7d,
    frostRiskNights7d: input.frostRiskNights7d,
    frostProbabilityPct7d: input.frostProbabilityPct7d,
  });
  if (decision == null) {
    return null;
  }

  const soilTempCurrent = decision.soilTempCurrentC;
  const soilTempSustainedDays = decision.soilTempSustainedDays;
  const surfaceMoisturePct = decision.surfaceMoisturePct;
  const frostRiskMinTempC7d = decision.frostRiskMinTempC7d;
  const frostRiskNights7d = decision.frostRiskNights7d;
  const frostProbabilityPct7d = decision.frostProbabilityPct7d;
  const weatherSourceLabel = input.weatherSourceLabel?.trim() || "weather-backed";
  const frostProbabilityLabel = formatProbabilityLabel(frostProbabilityPct7d);
  const thresholdC = decision.thresholdC;
  const requiredDays = decision.requiredDays;
  const soilReady = decision.soilReady;
  const tooDry = decision.tooDry;
  const fieldAccessBlocked = decision.fieldAccessBlocked;
  const fieldAccessMarginal = decision.fieldAccessMarginal;
  const frostKillRisk = decision.frostKillRisk;
  const frostBlocked = decision.frostBlocked;
  const cropLabel = input.cropLabel.trim().length > 0 ? input.cropLabel : "This crop";
  const frostSignal: SeedingRecommendationPresentation["signals"][number] | null =
    frostRiskMinTempC7d != null
    ? {
        label: `Frost min ${formatSignedTemperature(frostRiskMinTempC7d)}`,
        color: frostKillRisk ? "red" : frostBlocked ? "yellow" : "green",
        detail:
          [
            frostRiskNights7d > 0
              ? `${frostRiskNights7d} frost-risk night${frostRiskNights7d === 1 ? "" : "s"} next 7d`
              : "No frost-risk nights next 7d",
            frostProbabilityLabel,
            weatherSourceLabel,
          ]
            .filter((value): value is string => Boolean(value))
            .join(" · "),
      }
    : null;
  const soilSignal = {
    label:
      soilTempCurrent != null
        ? `Soil @ 6 cm ${soilTempCurrent.toFixed(1)}°C`
        : "Soil @ 6 cm pending",
    color:
      soilReady
        ? "green"
        : soilTempCurrent == null
          ? "yellow"
          : soilTempCurrent < thresholdC
            ? "yellow"
            : "yellow",
    detail: formatSoilTempDetail({
      current: soilTempCurrent,
      thresholdC,
      sustainedDays: soilTempSustainedDays,
      requiredDays,
    }),
  } as const;
  const accessSignal: SeedingRecommendationPresentation["signals"][number] | null = input.fieldAccessPresentation
    ? {
        label: `Field access ${input.fieldAccessPresentation.value}`,
        color: signalColor(input.fieldAccessPresentation.tone),
        detail: input.fieldAccessPresentation.sub,
      }
    : null;

  if (!soilReady) {
    const soilReason =
      soilTempCurrent == null
        ? `Seed-depth soil temperature is still missing.`
        : soilTempCurrent < thresholdC
          ? `Soil @ 6 cm is ${soilTempCurrent.toFixed(1)}°C, below the ${thresholdC.toFixed(0)}°C target.`
          : `Soil @ 6 cm is ${soilTempCurrent.toFixed(1)}°C, but it has only held above ${thresholdC.toFixed(0)}°C for ${soilTempSustainedDays ?? 0} of ${requiredDays} required days.`;

    return {
      title: "Too early to seed",
      severity: "medium",
      urgency: "Watch",
      dueDate: "Recheck in 48h",
      recommendation: `Hold seeding until ${cropLabel.toLowerCase()} seed-depth soil temperature reaches ${thresholdC.toFixed(0)}°C for ${requiredDays} consecutive days.`,
      explanation: `No confirmed finding is active yet. ${soilReason} This recommendation is advisory and uses crop-specific seeding thresholds rather than a tracked intelligence event.`,
      whyNow:
        soilTempCurrent == null
          ? `Seed-depth soil temperature is still missing, so the seeding window cannot be opened confidently for ${cropLabel.toLowerCase()}.`
          : `Seed-depth soil temperature has not yet met the ${thresholdC.toFixed(0)}°C for ${requiredDays}d rule for ${cropLabel.toLowerCase()}.`,
      inspectFirst:
        "Check seed-depth temperature in representative field areas, then compare lighter-ground and low-lying spots before committing equipment across the whole field.",
      confidence: "Heuristic watchlist · crop-aware weather",
      signals: [soilSignal, accessSignal, frostSignal].filter(
        (value): value is NonNullable<typeof value> => value != null,
      ),
      tags: [
        { label: "Seeding", color: "yellow" },
        { label: "Too early", color: "yellow" },
      ],
    };
  }

  if (frostBlocked) {
    return {
      title: frostKillRisk ? "Hold seeding for kill-risk frost" : "Hold seeding for frost risk",
      severity: frostKillRisk ? "high" : "medium",
      urgency: "Watch",
      dueDate: "Within 7d",
      recommendation:
        "Hold seeding until the 7-day frost window clears, especially in low spots and exposed parts of the field.",
      explanation: `No confirmed finding is active yet. Soil conditions are approaching readiness, but the next 7 days still carry frost exposure for ${cropLabel.toLowerCase()}. This recommendation is advisory and based on crop-specific frost sensitivity.`,
      whyNow:
        frostRiskMinTempC7d != null
          ? `The lowest forecast low is ${formatSignedTemperature(frostRiskMinTempC7d)} with ${frostRiskNights7d} frost-risk night${frostRiskNights7d === 1 ? "" : "s"} in the next 7 days${frostProbabilityLabel ? ` and ${frostProbabilityLabel.toLowerCase()} of dropping below the crop damage threshold.` : "."}`
          : `Frost-sensitive nights are still present in the next 7 days.`,
      inspectFirst:
        "Check low-lying, residue-light, and wind-exposed areas first, then reassess the seeding plan once the frost window clears.",
      confidence: "Heuristic watchlist · crop-aware weather",
      signals: [soilSignal, frostSignal, accessSignal].filter(
        (value): value is NonNullable<typeof value> => value != null,
      ),
      tags: [
        { label: "Seeding", color: frostKillRisk ? "red" : "yellow" },
        { label: "Frost", color: frostKillRisk ? "red" : "yellow" },
      ],
    };
  }

  if (fieldAccessBlocked || fieldAccessMarginal || tooDry) {
    const accessReason = tooDry
      ? `Surface moisture is ${surfaceMoisturePct?.toFixed(0)}%, below the ${input.seedingThresholds.surfaceMoistureMinPct.toFixed(0)}% germination floor.`
      : input.fieldAccessPresentation?.sub ??
        "Field access conditions are not yet stable enough for a clean seeding run.";
    const severeAccessConstraint = fieldAccessBlocked && !tooDry;

    return {
      title: severeAccessConstraint ? "Hold seeding for field access" : "Hold seeding for field fit",
      severity: severeAccessConstraint ? "high" : "medium",
      urgency: "Watch",
      dueDate: "Recheck in 48h",
      recommendation:
        "Hold seeding until field access and surface conditions settle enough for a cleaner pass.",
      explanation: `No confirmed finding is active yet. Seed-depth temperature is close enough to watch, but the field still looks operationally constrained for ${cropLabel.toLowerCase()}. This recommendation is advisory and based on surface moisture, recent precipitation, and thaw-cycle heuristics.`,
      whyNow: accessReason,
      inspectFirst:
        "Check headlands, low pockets, and the heaviest ground first, then confirm whether the same access constraints persist across the rest of the field.",
      confidence: "Heuristic watchlist · crop-aware weather",
      signals: [soilSignal, accessSignal].filter(
        (value): value is NonNullable<typeof value> => value != null,
      ),
      tags: [
        { label: "Seeding", color: "yellow" },
        { label: "Field access", color: severeAccessConstraint ? "red" : "yellow" },
      ],
    };
  }

  return {
    title: "Seeding window open",
    severity: "medium",
    urgency: "Ready",
    dueDate: "This week",
    recommendation:
      "Seed now if field checks match this read, and keep verifying low spots as the weather window progresses.",
    explanation: `No confirmed finding is active yet. Crop-specific soil temperature, frost, and field-access checks are aligned for ${cropLabel.toLowerCase()}, so the field is in a workable seeding window.`,
    whyNow:
      frostRiskMinTempC7d != null
        ? `Soil @ 6 cm has cleared ${thresholdC.toFixed(0)}°C for ${soilTempSustainedDays ?? requiredDays}d, field access is workable, and the next 7 days stay above the ${formatSignedTemperature(input.frostDamageTempC)} damage threshold${frostProbabilityLabel ? ` with only ${frostProbabilityLabel.toLowerCase()} of crossing it.` : "."}`
        : `Soil @ 6 cm has cleared ${thresholdC.toFixed(0)}°C for ${soilTempSustainedDays ?? requiredDays}d and field access is workable.`,
    inspectFirst:
      "Start with representative strips and your colder low spots, then keep checking seed-depth temperature as the window advances.",
    confidence: "Heuristic watchlist · crop-aware weather",
    signals: [soilSignal, accessSignal, frostSignal].filter(
      (value): value is NonNullable<typeof value> => value != null,
    ),
    tags: [
      { label: "Seeding", color: "green" },
      { label: "Window open", color: "green" },
    ],
  };
}
