import {
  describeFieldAccessDecisionNarrative,
  describeSeedingAdvisoryNarrative,
  resolveFieldAccessDecision,
  resolveSeedingAdvisoryDecision,
  type FieldAccessVerdict,
  type SeedingThresholdRulePack,
} from "@fieldpulse/module-crop-intelligence";
import { describeFrostRiskSummary } from "@fieldpulse/module-weather";
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

  const narrative = describeFieldAccessDecisionNarrative(decision);

  return {
    label: "FIELD ACCESS",
    value: narrative.valueLabel,
    sub: narrative.summary,
    tone: narrative.tone,
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
  const frostSummary = describeFrostRiskSummary({
    frostRiskMinTempC: null,
    frostRiskMinTempC7d,
    frostRiskNights7d,
    frostProbabilityPct7d,
  });
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
            frostSummary.riskNightsLabel ?? "No frost-risk nights next 7d",
            frostSummary.probabilityLabel,
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
  const advisoryNarrative = describeSeedingAdvisoryNarrative({
    decision,
    cropLabel,
    frostDamageTempC: input.frostDamageTempC,
    surfaceMoistureMinPct: input.seedingThresholds.surfaceMoistureMinPct,
    fieldAccessExplanation:
      input.fieldAccessPresentation?.sub ??
      "Field access conditions are not yet stable enough for a clean seeding run.",
  });

  if (!soilReady) {
    return {
      title: advisoryNarrative.uiTitle,
      severity: advisoryNarrative.uiSeverity,
      urgency: advisoryNarrative.urgency,
      dueDate: advisoryNarrative.dueDate,
      recommendation: advisoryNarrative.recommendation,
      explanation: advisoryNarrative.explanation,
      whyNow: advisoryNarrative.whyNow,
      inspectFirst: advisoryNarrative.inspectFirst,
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
      title: advisoryNarrative.uiTitle,
      severity: advisoryNarrative.uiSeverity,
      urgency: advisoryNarrative.urgency,
      dueDate: advisoryNarrative.dueDate,
      recommendation: advisoryNarrative.recommendation,
      explanation: advisoryNarrative.explanation,
      whyNow: advisoryNarrative.whyNow,
      inspectFirst: advisoryNarrative.inspectFirst,
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
    return {
      title: advisoryNarrative.uiTitle,
      severity: advisoryNarrative.uiSeverity,
      urgency: advisoryNarrative.urgency,
      dueDate: advisoryNarrative.dueDate,
      recommendation: advisoryNarrative.recommendation,
      explanation: advisoryNarrative.explanation,
      whyNow: advisoryNarrative.whyNow,
      inspectFirst: advisoryNarrative.inspectFirst,
      confidence: "Heuristic watchlist · crop-aware weather",
      signals: [soilSignal, accessSignal].filter(
        (value): value is NonNullable<typeof value> => value != null,
      ),
      tags: [
        { label: "Seeding", color: "yellow" },
        { label: "Field access", color: advisoryNarrative.uiSeverity === "high" ? "red" : "yellow" },
      ],
    };
  }

  return {
    title: advisoryNarrative.uiTitle,
    severity: advisoryNarrative.uiSeverity,
    urgency: advisoryNarrative.urgency,
    dueDate: advisoryNarrative.dueDate,
    recommendation: advisoryNarrative.recommendation,
    explanation: advisoryNarrative.explanation,
    whyNow: advisoryNarrative.whyNow,
    inspectFirst: advisoryNarrative.inspectFirst,
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
