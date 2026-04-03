import type { SeedingAdvisoryDecision } from "./resolveSeedingAdvisoryDecision";

export type SeedingAdvisoryNarrative = {
  uiTitle: string;
  pdfTitle: string;
  uiSeverity: "medium" | "high";
  pdfSeverity: "critical" | "warning" | "info";
  urgency: string;
  dueDate: string;
  recommendation: string;
  explanation: string;
  whyNow: string;
  inspectFirst: string;
  pdfAction: string;
};

export type DescribeSeedingAdvisoryNarrativeInput = {
  decision: SeedingAdvisoryDecision;
  cropLabel: string;
  frostDamageTempC: number;
  surfaceMoistureMinPct: number;
  fieldAccessExplanation: string;
};

function formatSignedTemperature(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}°C`;
}

function formatProbabilityLabel(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  return `${Math.round(value)}% probability`;
}

export function describeSeedingAdvisoryNarrative(
  input: DescribeSeedingAdvisoryNarrativeInput,
): SeedingAdvisoryNarrative {
  const cropLabel = input.cropLabel.trim().length > 0 ? input.cropLabel : "Crop";
  const cropLabelLower = cropLabel.toLowerCase();
  const d = input.decision;
  const frostProbabilityLabel = formatProbabilityLabel(d.frostProbabilityPct7d);

  if (d.verdict === "too-early") {
    const whyNow =
      d.reasonCode === "missing-soil-temp"
        ? `Seed-depth soil temperature is still missing, so the seeding window cannot be opened confidently for ${cropLabelLower}.`
        : d.reasonCode === "soil-below-threshold" && d.soilTempCurrentC != null
          ? `Soil @ 6 cm is ${d.soilTempCurrentC.toFixed(1)}°C, below the ${d.thresholdC.toFixed(0)}°C target for ${cropLabelLower}. ${cropLabel} needs sustained ≥${d.thresholdC.toFixed(0)}°C.`
          : `Soil @ 6 cm is ${d.soilTempCurrentC?.toFixed(1) ?? "—"}°C, but it has only held above ${d.thresholdC.toFixed(0)}°C for ${d.soilTempSustainedDays ?? 0} of ${d.requiredDays} required days.`;

    return {
      uiTitle: "Too early to seed",
      pdfTitle: `Too Early to Seed — ${cropLabel}`,
      uiSeverity: "medium",
      pdfSeverity: "critical",
      urgency: "Watch",
      dueDate: "Recheck in 48h",
      recommendation: `Hold seeding until ${cropLabelLower} seed-depth soil temperature reaches ${d.thresholdC.toFixed(0)}°C for ${d.requiredDays} consecutive days.`,
      explanation: `No confirmed finding is active yet. ${whyNow} This recommendation is advisory and uses crop-specific seeding thresholds rather than a tracked intelligence event.`,
      whyNow,
      inspectFirst:
        "Check seed-depth temperature in representative field areas, then compare lighter-ground and low-lying spots before committing equipment across the whole field.",
      pdfAction: "Wait for sustained warming. Track soil temperature daily.",
    };
  }

  if (d.verdict === "hold" && d.reasonCode === "frost-risk") {
    const whyNow =
      d.frostRiskMinTempC7d != null
        ? `The lowest forecast low is ${formatSignedTemperature(d.frostRiskMinTempC7d)} with ${d.frostRiskNights7d} frost-risk night${d.frostRiskNights7d === 1 ? "" : "s"} in the next 7 days${frostProbabilityLabel ? ` and ${frostProbabilityLabel.toLowerCase()} of dropping below the crop damage threshold.` : "."}`
        : "Frost-sensitive nights are still present in the next 7 days.";

    return {
      uiTitle: d.frostKillRisk
        ? "Hold seeding for kill-risk frost"
        : "Hold seeding for frost risk",
      pdfTitle: d.frostKillRisk
        ? `Hold Seeding for Kill-Risk Frost — ${cropLabel}`
        : `Hold Seeding for Frost Risk — ${cropLabel}`,
      uiSeverity: d.frostKillRisk ? "high" : "medium",
      pdfSeverity: d.frostKillRisk ? "critical" : "warning",
      urgency: "Watch",
      dueDate: "Within 7d",
      recommendation:
        "Hold seeding until the 7-day frost window clears, especially in low spots and exposed parts of the field.",
      explanation: `No confirmed finding is active yet. Soil conditions are approaching readiness, but the next 7 days still carry frost exposure for ${cropLabelLower}. This recommendation is advisory and based on crop-specific frost sensitivity.`,
      whyNow,
      inspectFirst:
        "Check low-lying, residue-light, and wind-exposed areas first, then reassess the seeding plan once the frost window clears.",
      pdfAction: "Re-check conditions in 2–3 days. Monitor the 7-day forecast.",
    };
  }

  if (d.verdict === "hold") {
    const whyNow =
      d.reasonCode === "surface-too-dry" && d.surfaceMoisturePct != null
        ? `Surface moisture is ${d.surfaceMoisturePct.toFixed(0)}%, below the ${input.surfaceMoistureMinPct.toFixed(0)}% germination floor.`
        : input.fieldAccessExplanation;
    const severeAccessConstraint = d.fieldAccessBlocked && !d.tooDry;

    return {
      uiTitle: severeAccessConstraint ? "Hold seeding for field access" : "Hold seeding for field fit",
      pdfTitle:
        d.reasonCode === "surface-too-dry"
          ? `Hold Seeding for Surface Moisture — ${cropLabel}`
          : d.fieldAccessBlocked
            ? `Hold Seeding for Field Access — ${cropLabel}`
            : `Hold Seeding for Field Fit — ${cropLabel}`,
      uiSeverity: severeAccessConstraint ? "high" : "medium",
      pdfSeverity: severeAccessConstraint ? "critical" : "warning",
      urgency: "Watch",
      dueDate: "Recheck in 48h",
      recommendation:
        "Hold seeding until field access and surface conditions settle enough for a cleaner pass.",
      explanation: `No confirmed finding is active yet. Seed-depth temperature is close enough to watch, but the field still looks operationally constrained for ${cropLabelLower}. This recommendation is advisory and based on surface moisture, recent precipitation, and thaw-cycle heuristics.`,
      whyNow,
      inspectFirst:
        "Check headlands, low pockets, and the heaviest ground first, then confirm whether the same access constraints persist across the rest of the field.",
      pdfAction: "Re-check conditions in 2–3 days. Monitor the 7-day forecast.",
    };
  }

  const whyNow =
    d.frostRiskMinTempC7d != null
      ? `Soil @ 6 cm has cleared ${d.thresholdC.toFixed(0)}°C for ${d.soilTempSustainedDays ?? d.requiredDays}d, field access is workable, and the next 7 days stay above the ${formatSignedTemperature(input.frostDamageTempC)} damage threshold${frostProbabilityLabel ? ` with only ${frostProbabilityLabel.toLowerCase()} of crossing it.` : "."}`
      : `Soil @ 6 cm has cleared ${d.thresholdC.toFixed(0)}°C for ${d.soilTempSustainedDays ?? d.requiredDays}d and field access is workable.`;

  return {
    uiTitle: "Seeding window open",
    pdfTitle: `Seeding Window Open — ${cropLabel}`,
    uiSeverity: "medium",
    pdfSeverity: "info",
    urgency: "Ready",
    dueDate: "This week",
    recommendation:
      "Seed now if field checks match this read, and keep verifying low spots as the weather window progresses.",
    explanation: `No confirmed finding is active yet. Crop-specific soil temperature, frost, and field-access checks are aligned for ${cropLabelLower}, so the field is in a workable seeding window.`,
    whyNow,
    inspectFirst:
      "Start with representative strips and your colder low spots, then keep checking seed-depth temperature as the window advances.",
    pdfAction: "Conditions favor seeding. Confirm with local soil probe before committing.",
  };
}
