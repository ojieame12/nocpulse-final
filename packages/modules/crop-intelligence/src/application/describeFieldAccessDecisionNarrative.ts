import type { FieldAccessDecision } from "./resolveSeedingAdvisoryDecision";

export type FieldAccessDecisionNarrative = {
  valueLabel: "Wait" | "Marginal" | "Workable";
  tone: "danger" | "warning" | "positive";
  summary: string;
  detailedExplanation: string;
};

export function describeFieldAccessDecisionNarrative(
  decision: FieldAccessDecision,
): FieldAccessDecisionNarrative {
  if (decision.verdict === "wait") {
    const reasons: string[] = [];
    if (decision.blockedBySurfaceMoisture && decision.surfaceMoisturePct != null) {
      reasons.push(
        `Surface moisture at ${decision.surfaceMoisturePct.toFixed(0)}% — soil saturated. Equipment access will cause compaction.`,
      );
    }
    if (decision.blockedByRecentPrecip && decision.recentPrecipTotal72hMm != null) {
      reasons.push(
        `${decision.recentPrecipTotal72hMm.toFixed(0)} mm precipitation in the last 72 h. Fields need time to dry.`,
      );
    }
    if (decision.blockedByFreezeThaw && decision.freezeThawCycles7d != null) {
      reasons.push(
        `${decision.freezeThawCycles7d} freeze-thaw cycles. Top soil is unstable and prone to rutting.`,
      );
    }

    return {
      valueLabel: "Wait",
      tone: "danger",
      summary: decision.detailSummary,
      detailedExplanation: reasons.join(" "),
    };
  }

  if (decision.verdict === "marginal") {
    const warnings: string[] = [];
    if (decision.warnedBySurfaceMoisture && decision.surfaceMoisturePct != null) {
      warnings.push(`surface moisture elevated (${decision.surfaceMoisturePct.toFixed(0)}%)`);
    }
    if (decision.warnedByRecentPrecip && decision.recentPrecipTotal72hMm != null) {
      warnings.push(`${decision.recentPrecipTotal72hMm.toFixed(0)} mm rain in 72 h`);
    }
    if (decision.warnedByFreezeThaw && decision.freezeThawCycles7d != null) {
      warnings.push(`${decision.freezeThawCycles7d} freeze-thaw cycles`);
    }

    return {
      valueLabel: "Marginal",
      tone: "warning",
      summary: decision.detailSummary,
      detailedExplanation: `Caution: ${warnings.join("; ")}. Scout field edges before committing equipment.`,
    };
  }

  return {
    valueLabel: "Workable",
    tone: "positive",
    summary: decision.detailSummary,
    detailedExplanation: "Field conditions are workable. Soil is firm enough for equipment traffic.",
  };
}
