import type { FieldAlert } from "@fieldpulse/module-alerts";
import type { FieldIntelligenceFinding } from "@fieldpulse/module-crop-intelligence";

function normalizeText(title: string, summary?: string | null) {
  return `${title} ${summary ?? ""}`.toLowerCase();
}

export function inferFieldAlertFollowUpAction(
  alert: Pick<FieldAlert, "title" | "summary" | "recommendedAction">,
): string | undefined {
  if (alert.recommendedAction) return alert.recommendedAction;

  const text = normalizeText(alert.title, alert.summary);
  if (text.includes("frost")) return "Check frost protection measures. Monitor overnight low temperatures closely.";
  if (text.includes("moisture stress") || text.includes("below")) {
    return "Review irrigation scheduling. Prioritize affected zones.";
  }
  if (text.includes("hail")) return "Assess crop damage risk and review insurance coverage.";
  if (text.includes("wind")) return "Delay field operations until wind subsides.";
  return undefined;
}

export function inferFieldFindingFollowUpAction(
  finding: Pick<FieldIntelligenceFinding, "title" | "summary" | "recommendedAction">,
): string | undefined {
  if (finding.recommendedAction) return finding.recommendedAction;

  const text = normalizeText(finding.title, finding.summary);
  if (text.includes("frost")) return "Monitor overnight lows. Activate frost mitigation if available.";
  if (text.includes("moisture")) return "Review irrigation for the upcoming week.";
  if (text.includes("stress")) return "Ground-truth stressed zones within the next 48 hours.";
  return undefined;
}

export function inferCropAlertFollowUpAction(
  title: string,
): string | undefined {
  const text = title.toLowerCase();
  if (text.includes("frost")) return "Consider frost protection measures. Monitor overnight lows closely.";
  if (text.includes("moisture stress")) return "Schedule irrigation check. Prioritize affected zones.";
  if (text.includes("hail")) return "Review hail protection options. Check crop insurance coverage.";
  if (text.includes("wind")) return "Assess wind damage risk. Delay spraying until conditions settle.";
  if (text.includes("disease")) return "Scout affected areas. Consult agronomist for fungicide options.";
  if (text.includes("vpd") || text.includes("atmospheric")) return "Monitor crop water demand. Consider irrigation timing.";
  return undefined;
}

export function inferDiseaseRiskFollowUpAction(
  name: string,
  severity: "critical" | "warning" | "info",
): string | undefined {
  const text = name.toLowerCase();
  if (severity === "info") return undefined;
  if (text.includes("sclerotinia")) {
    return "Scout canopy for sclerotinia symptoms. Consult agronomist on fungicide timing if at petal stage.";
  }
  if (text.includes("fusarium")) {
    return "Monitor heads for fusarium symptoms. Consider fungicide if heading stage and conditions persist.";
  }
  if (text.includes("rust") || text.includes("stripe")) {
    return "Scout lower canopy for rust pustules. Apply foliar fungicide if spread is confirmed.";
  }
  if (text.includes("blackleg")) {
    return "Inspect stem bases for lesions. Plan resistant variety selection for next rotation.";
  }
  if (text.includes("clubroot")) {
    return "Avoid equipment movement from affected areas. Use resistant cultivars in future rotations.";
  }
  if (severity === "critical") {
    return "Scout affected areas immediately. Consult agronomist for treatment options.";
  }
  return "Monitor for symptoms. Scout during next field walk.";
}
